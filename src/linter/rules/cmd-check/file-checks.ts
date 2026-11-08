import { prettyPrint, LintingResultCertainty } from '../../linter-format';
import { SourceLocation } from '../../../util/range';
import { type CmdCheckResult, type PackageInfo, packageInfo } from './cmd-check-util';
import { type PackageFiles, packageFiles } from './package-files';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import type { AsyncOrSync } from 'ts-essentials';

/** A finding of a check kind at a file (and line) of the package. */
export interface FileResult<K extends string> extends CmdCheckResult {
	readonly kind: K
	readonly file: string
}

/** Collects findings located at package files; findings of the kinds in `skip` are dropped. */
export function fileFindings<K extends string>(pf: PackageFiles, skip: readonly K[] = []) {
	const results: FileResult<K>[] = [];
	const add = (kind: K, file: string, message: string, line?: number, certainty = LintingResultCertainty.Certain) => {
		if(!skip.includes(kind)) {
			results.push({ certainty, involvedId: undefined, loc: pf.locate(file, line), kind, file, message });
		}
	};
	return { results, add };
}

/** Runs `run` on the files of the package, yielding no results and the `zeroed` metadata if they are not available. */
export function onPackageFiles<C, R, M>(zeroed: M, run: (pf: PackageFiles, pkg: PackageInfo, config: C, data: ReadonlyFlowrAnalysisProvider) => AsyncOrSync<{ results: R[], '.meta': M }>) {
	return (_elements: unknown, config: C, data: ReadonlyFlowrAnalysisProvider) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const pf = packageFiles(ctx, pkg.name);
		return pf === undefined ? { results: [] as R[], '.meta': zeroed } : run(pf, pkg, config, data);
	};
}

/** The lines of a package file, empty if it cannot be read. */
export function linesOf(pf: PackageFiles, file: string): string[] {
	return (pf.read(file) ?? '').split(/\r?\n/);
}

/** The 1-based number of the first line of `file` matching `pattern`, `undefined` if none does. */
export function firstLine(pf: PackageFiles, file: string, pattern: RegExp): number | undefined {
	const i = linesOf(pf, file).findIndex(l => pattern.test(l));
	return i < 0 ? undefined : i + 1;
}

/** Pretty printing of a finding as its message and location. */
export const MessageAtLocation = prettyPrint((r: { readonly message: string, readonly loc: SourceLocation }) => `${r.message} at ${SourceLocation.format(r.loc)}`);
