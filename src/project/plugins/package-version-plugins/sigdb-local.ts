import path from 'path';
import type { FlowrConfig } from '../../../config';
import { FlowrAnalyzerBuilder } from '../../flowr-analyzer-builder';
import { FileRole } from '../../context/flowr-file';
import type { ReadOnlyFlowrAnalyzerFilesContext } from '../../context/flowr-analyzer-files-context';
import { getExportedNames, type FlowrNamespaceFile } from '../file-plugins/files/flowr-namespace-file';
import type { FlowrDescriptionFile } from '../file-plugins/files/flowr-description-file';
import type { Package } from './package';
import { fileProtocol } from '../../../r-bridge/retriever';
import { TreeSitterExecutor } from '../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { log } from '../../../util/log';
import { toRVersion, DepType } from './sigdb';
import type {
	DecodedFunction, LibraryExports, PackageSignatureSource, ResolvedDependency,
	RPackageVersion, RPackageVersionLike, VersionRelease
} from './sigdb';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { isFunctionDefinitionVertex } from '../../../dataflow/graph/vertex';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { Identifier } from '../../../dataflow/environments/identifier';

export const sigDbLocalLog = log.getSubLogger({ name: 'sigdb-local' });

/** the assignment operators that bind a name to a function definition (`name <- function(...)`) */
const AssignmentOperators = new Set(['<-', '=', '<<-']);

/**
 * A package analyzed off disk: its name, version and exports plus, for every top-level function definition
 * in its `R/` sources, the flowR-extracted {@link DecodedFunction} (parameters, forced/optional, default
 * lexemes, and named callees) and the declared dependencies parsed from `DESCRIPTION`.
 */
export interface AnalyzedPackage {
	name:         string;
	version:      string;
	exported:     string[];
	functions:    DecodedFunction[];
	dependencies: ResolvedDependency[];
}

/**
 * The exported identifiers of a parsed `NAMESPACE` (real exports plus S3 methods as `generic.class`).
 * Pattern-based exports (`exportPattern`) are not expanded, as that requires the actual object list.
 */
function namespaceExports(ns: FlowrNamespaceFile | undefined): string[] {
	if(ns === undefined) {
		return [];
	}
	try {
		const info = ns.content().current;
		// reuse the canonical export union + S3 flattening; drop `exportPattern`s (regexes, not literal names)
		return getExportedNames(info).filter(n => !info.exportedPatterns.includes(n));
	} catch(e) {
		sigDbLocalLog.warn(`could not read NAMESPACE exports from ${ns.path()}: ${(e as Error).message}`);
		return [];
	}
}

/** the declared dependencies of a `DESCRIPTION` (Depends/Imports/LinkingTo/Suggests), skipping the `R` version dep */
function describedDependencies(desc: FlowrDescriptionFile): ResolvedDependency[] {
	const out: ResolvedDependency[] = [];
	const add = (pkgs: readonly Package[] | undefined, type: DepType): void => {
		for(const p of pkgs ?? []) {
			if(p.name === 'R') {
				continue;   // the `R (>= x)` clause is a language-version constraint, not a package dependency
			}
			out.push({ name: p.name, type, ...(p.derivedVersion ? { constraint: p.derivedVersion.raw } : {}) });
		}
	};
	add(desc.depends(), DepType.Depends);
	add(desc.imports(), DepType.Imports);
	add(desc.linkingTo(), DepType.LinkingTo);
	add(desc.suggests(), DepType.Suggests);
	return out;
}

/** the per-package directory metadata discovered in a files context (a package = a `DESCRIPTION`) */
interface PackageDir { dir: string, info: AnalyzedPackage }

/** index every discovered `DESCRIPTION` by its directory, reading name/version/exports/dependencies */
function readPackageDirs(files: ReadOnlyFlowrAnalyzerFilesContext): PackageDir[] {
	const namespaceByDir = new Map(files.getFilesByRole(FileRole.Namespace).map(ns => [path.dirname(ns.path()), ns]));
	const dirs: PackageDir[] = [];
	for(const desc of files.getFilesByRole(FileRole.Description)) {
		try {
			const name = desc.packageName();
			if(name === undefined) {
				continue;
			}
			const dir = path.dirname(desc.path());
			dirs.push({ dir, info: {
				name,
				version:      desc.version()?.str ?? desc.content().get('Version')?.[0] ?? '0.0.0',
				exported:     namespaceExports(namespaceByDir.get(dir)),
				dependencies: describedDependencies(desc),
				functions:    []
			} });
		} catch(e) {
			sigDbLocalLog.warn(`could not read the package at ${desc.path()}: ${(e as Error).message}`);
		}
	}
	return dirs;
}

/** the package directory that owns `filePath` (its longest matching ancestor), or `undefined` */
function ownerOf(filePath: string, dirs: readonly PackageDir[]): PackageDir | undefined {
	let best: PackageDir | undefined;
	for(const d of dirs) {
		if((filePath === d.dir || filePath.startsWith(d.dir + path.sep)) && (best === undefined || d.dir.length > best.dir.length)) {
			best = d;
		}
	}
	return best;
}

/** the deduped, sorted names of the functions a body calls (named calls only; anonymous/operator calls are skipped) */
function bodyCallees(body: RNodeWithParent): string[] {
	const callees = new Set<string>();
	RNode.visitAst(body, n => {
		if(n.type === RType.FunctionCall && n.named) {
			callees.add(Identifier.getName(n.functionName.content));
		}
		return false;
	});
	return [...callees].sort();
}

/** describe one `name <- function(...)` as a {@link DecodedFunction}, mirroring crawlr's signature extraction */
function describeFunction(name: string, def: RFunctionDefinition<ParentInformation>, dfg: DataflowGraph, exported: boolean): DecodedFunction {
	const vtx = dfg.getVertex(def.info.id);
	const forced = isFunctionDefinitionVertex(vtx) ? vtx.params : {};   // `params` maps each param's name id to always-read
	const signature = def.parameters.map(p => {
		const def0 = p.defaultValue;
		return {
			name:     Identifier.getName(p.name.content),
			forced:   Boolean(forced[p.name.info.id]),
			optional: def0 !== undefined,   // no default value == crawlr's `missing`
			...(def0 !== undefined ? { default: def0.info.fullLexeme ?? def0.lexeme } : {})
		};
	});
	return {
		name,
		line:    def.location[0],
		exported,
		props:   exported ? ['exported'] : [],
		signature,
		callees: bodyCallees(def.body)
	};
}

/** extract every top-level function definition from `root`, attributing it to `owner` and marking exports */
function extractFileFunctions(root: RNodeWithParent, owner: PackageDir, dfg: DataflowGraph): void {
	const exported = new Set(owner.info.exported);
	RNode.visitAst(root, node => {
		if(node.type === RType.BinaryOp && AssignmentOperators.has(node.operator)
			&& node.lhs.type === RType.Symbol && node.rhs.type === RType.FunctionDefinition) {
			const name = Identifier.getName(node.lhs.content);
			owner.info.functions.push(describeFunction(name, node.rhs, dfg, exported.has(name)));
			return true;   // do not descend: nested definitions are locals, not package-level functions
		}
		return false;
	});
}

/**
 * Analyze an installed R package (or a whole library folder) on disk by running flowR over its `R/` sources:
 * each `DESCRIPTION` yields a package and every top-level function its full signature. Best-effort: an
 * unreadable package is skipped, and an empty list is returned if `dir` cannot be analyzed at all.
 * @param config - the configuration for the spawned analyzer (typically the caller's own config)
 * @param dir    - the installed package directory or library folder to analyze
 */
export async function analyzePackagesOnDisk(config: FlowrConfig, dir: string): Promise<AnalyzedPackage[]> {
	// extract signatures with tree-sitter (bundled, no R needed) rather than the caller's engine
	await TreeSitterExecutor.initTreeSitter();
	const analyzer = await new FlowrAnalyzerBuilder().setConfig(config).setParser(new TreeSitterExecutor()).build().catch(e => {
		sigDbLocalLog.warn(`could not spawn an analyzer for ${dir}: ${(e as Error).message}`);
		return undefined;
	});
	if(analyzer === undefined) {
		return [];
	}
	try {
		analyzer.addRequest(fileProtocol + dir);
		const dirs = readPackageDirs(analyzer.inspectContext().files);
		if(dirs.length === 0) {
			return [];
		}
		// signature extraction is best-effort: a package with no `R/` sources has nothing to analyze (and
		// dataflow would refuse an empty request), so we still return the metadata (exports) with no functions
		try {
			const ast = (await analyzer.normalize()).ast;
			const dfg = (await analyzer.dataflow()).graph;   // populates the forced-parameter estimate per function
			for(const file of ast.files) {
				const owner = file.filePath !== undefined ? ownerOf(file.filePath, dirs) : undefined;
				if(owner === undefined) {
					continue;
				}
				try {
					extractFileFunctions(file.root, owner, dfg);
				} catch(e) {   // isolate per file so one unparseable source does not drop the rest of the folder
					sigDbLocalLog.info(`skipped signatures in ${file.filePath}: ${(e as Error).message}`);
				}
			}
		} catch(e) {
			sigDbLocalLog.info(`no signatures extracted for ${dir} (${(e as Error).message}); exporting metadata only`);
		}
		return dirs.map(d => d.info);
	} catch(e) {
		sigDbLocalLog.warn(`could not analyze ${dir}: ${(e as Error).message}`);
		return [];
	} finally {
		analyzer.close();
	}
}

/**
 * An in-memory {@link PackageSignatureSource} built from packages analyzed on disk (see
 * {@link analyzePackagesOnDisk}). It answers the export view like a bundled database plus, because flowR
 * analyzed the sources, the per-function view ({@link functions}) and declared dependencies. On-disk packages
 * are never treated as base R. Add one via {@link FlowrAnalyzerPackageVersionsSigDbPlugin.addSource}.
 */
export class LocalSignatureSource implements PackageSignatureSource {
	private readonly pkgs: Map<string, AnalyzedPackage>;

	public constructor(packages: readonly AnalyzedPackage[]) {
		this.pkgs = new Map(packages.map(p => [p.name, p]));
	}

	public has(pkg: string): boolean {
		return this.pkgs.has(pkg);
	}

	public packageNames(): string[] {
		return [...this.pkgs.keys()];
	}

	public lookup(pkg: string, _version?: RPackageVersionLike): LibraryExports | undefined {
		const info = this.pkgs.get(pkg);   // a single analyzed version; the on-disk copy is authoritative
		if(info === undefined) {
			return undefined;
		}
		const internal = info.functions.filter(f => !f.exported).map(f => f.name);
		return { version: info.version, exported: info.exported, internal, deprecated: [], cran: false };
	}

	public functions(pkg: string, _version?: RPackageVersionLike): DecodedFunction[] | undefined {
		return this.pkgs.get(pkg)?.functions;
	}

	public dependencies(pkg: string, _version?: RPackageVersionLike): ResolvedDependency[] | undefined {
		return this.pkgs.get(pkg)?.dependencies;
	}

	public isBaseR(_pkg: string): boolean {
		return false;
	}

	public coreVersions(_pkg: string): RPackageVersion[] | undefined {
		return undefined;
	}

	public releaseDate(_pkg: string, _version?: RPackageVersionLike): Date | undefined {
		return undefined;
	}

	public releaseDates(_pkg: string): VersionRelease[] {
		return [];
	}

	public latestVersion(pkg: string): RPackageVersion | undefined {
		const info = this.pkgs.get(pkg);
		return info === undefined ? undefined : toRVersion(info.version);
	}

	public close(): void {
		/* nothing to release */
	}
}

/**
 * Analyze a single installed R package or a whole library folder on disk into an in-memory
 * {@link LocalSignatureSource} (running flowR to extract full signatures). Convenience over
 * {@link analyzePackagesOnDisk} + `new LocalSignatureSource`.
 */
export async function readLocalSignatureSource(config: FlowrConfig, dir: string): Promise<LocalSignatureSource> {
	return new LocalSignatureSource(await analyzePackagesOnDisk(config, dir));
}
