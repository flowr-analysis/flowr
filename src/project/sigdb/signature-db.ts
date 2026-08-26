import { Identifier } from '../../dataflow/environments/identifier';
import { groupGenericOf } from '../../dataflow/environments/group-generics';
import type { DecodedFunction } from './decode';
import type { PackageSignatureSource } from './reader';
import { MergedSignatureSource } from './reader';
import type { LibraryExports } from './schema';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../context/flowr-analyzer-dependencies-context';
import { log } from '../../util/log';

/**
 * The signature database as the analyzed project sees it.
 *
 * A {@link PackageSignatureSource} answers for a version you name, and falls back to whatever it holds as newest
 * when you name none. This adds the step above that, taking the version from what flowR resolved for the project,
 * which is where `solver.sigdb.versionOverrides`, `solver.sigdb.versionSelection` and
 * `solver.sigdb.assumedRVersion` have already been applied. So a query without a version is answered for the
 * version the analysis actually assumes, not for the newest the database happens to carry.
 *
 * Obtain one from {@link ReadOnlyFlowrAnalyzerDependenciesContext.signatures}, and reach for
 * {@link SignatureDb.sources|sources} only for what this does not cover.
 * @example
 * ```ts
 * const db = analyzer.inspectContext().deps.signatures();
 * db.versionOf('dplyr');                              // the version the analysis assumes
 * db.parametersOf(Identifier.make('lead', 'dplyr'));  // its formals, for MatchArgs
 * ```
 */
export interface SignatureDb {
	/** Whether any signature source is loaded at all, i.e. whether anything below can answer. */
	available(this: void): boolean;
	/**
	 * The version the analysis assumes for `pkg`, `undefined` if flowR could not pin one down. This is what every
	 * lookup here uses when no version is given.
	 */
	versionOf(this: void, pkg: string): string | undefined;
	/** Whether the database can resolve `pkg` at all, at any version. */
	has(this: void, pkg: string): boolean;
	/**
	 * The export view of a package.
	 * @param pkg     - The package to look up.
	 * @param version - The version to answer for, {@link versionOf} if omitted.
	 */
	exportsOf(this: void, pkg: string, version?: string): LibraryExports | undefined;
	/**
	 * The database entry for a *qualified* call, i.e. a `pkg::fn` {@link Identifier}. Decodes only that one
	 * function rather than the whole package.
	 *
	 * A name the package answers only as part of an S4 group falls back to the group: `Matrix::sin` is served by
	 * `Matrix`'s `Math` entry when there is no `sin` of its own, because that is what an `sin(x)` call dispatches
	 * to. The result then carries the group's name, not the one that was asked for.
	 *
	 * The {@link Identifier} decides how far the lookup reaches: `pkg::fn` answers only with what the package
	 * exports, `pkg:::fn` reaches its internals as well, exactly as R has it.
	 * @param id      - The qualified identifier of the function.
	 * @param version - The version to answer for, {@link versionOf} of its package if omitted.
	 */
	functionOf(this: void, id: Identifier, version?: string): DecodedFunction | undefined;
	/**
	 * The formal parameter names of a qualified call, ready to hand to {@link MatchArgs.toNames}.
	 * @param id      - The qualified identifier of the function.
	 * @param version - The version to answer for, {@link versionOf} of its package if omitted.
	 */
	parametersOf(this: void, id: Identifier, version?: string): readonly string[] | undefined;
	/** The packages exporting `name`, ordered by downloads, see {@link PackageSignatureSource.packagesExporting}. */
	packagesExporting(this: void, name: string): readonly string[];
	/** Every loaded source as one, for the questions this interface does not ask. */
	sources(this: void): PackageSignatureSource;
}

const signatureDbLog = log.getSubLogger({ name: 'signature-db' });

/**
 * Builds the {@link SignatureDb} that {@link ReadOnlyFlowrAnalyzerDependenciesContext.signatures} hands out.
 *
 * Call this only where you hold a dependencies context but no analyzer, e.g. inside a plugin or a query
 * executor. Everywhere else go through `analyzer.inspectContext().deps.signatures()`. It exists so the version
 * resolution lives in one place instead of every caller pairing a {@link PackageSignatureSource} with a
 * `getDependency(...)?.resolvedVersion` of its own.
 *
 * The result keeps no state, so it stays correct when a database is mounted or a version is re-resolved later.
 * @param deps - The dependencies context the versions and the sources come from.
 */
export function signatureDbOf(deps: ReadOnlyFlowrAnalyzerDependenciesContext): SignatureDb {
	const merged = () => new MergedSignatureSource(deps.signatureSources());
	const versionOf = (pkg: string) => deps.getDependency(pkg)?.resolvedVersion;
	const answerFor = <T>(pkg: string, version: string | undefined, ask: (src: PackageSignatureSource, v: string | undefined) => T | undefined): T | undefined => {
		const src = merged();
		const assumed = version ?? versionOf(pkg);
		const found = ask(src, assumed);
		if(found !== undefined || assumed === undefined) {
			return found;
		}
		const any = ask(src, undefined);
		if(any !== undefined) {
			signatureDbLog.debug(`no signature for ${pkg} ${assumed}, answering from the newest version the database holds`);
		}
		return any;
	};

	const functionOf = (id: Identifier, version?: string): DecodedFunction | undefined => {
		const [name, pkg, internal] = Identifier.toArray(id);
		if(pkg === undefined) {
			return undefined; // without a package there is nothing to look the function up in
		}
		/* `::` reaches what the package exports, only `:::` reaches the rest */
		const reaches = (fn: DecodedFunction | undefined) =>
			fn !== undefined && (fn.exported || internal === true) ? fn : undefined;
		const found = reaches(answerFor(pkg, version, (src, v) => src.functionByName(pkg, name, v)));
		if(found !== undefined) {
			return found;
		}
		/* `setMethod('Math', 'cls', ...)` answers every member of the group at once, so the group is the entry */
		const group = groupGenericOf(name);
		return group === undefined ? undefined : reaches(answerFor(pkg, version, (src, v) => src.functionByName(pkg, group, v)));
	};

	return {
		available:         () => deps.signatureSources().length > 0,
		versionOf,
		has:               pkg => merged().has(pkg),
		exportsOf:         (pkg, version) => answerFor(pkg, version, (src, v) => src.lookup(pkg, v)),
		packagesExporting: name => deps.packagesExporting(name),
		sources:           () => merged(),
		functionOf,
		parametersOf:      (id, version) => functionOf(id, version)?.signature.map(p => p.name)
	};
}
