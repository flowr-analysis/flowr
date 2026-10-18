import { LintingPrettyPrintContext, LintingResultCertainty } from '../../linter-format';
import { SourceLocation } from '../../../util/range';
import type { CmdCheckResult } from './cmd-check-util';
import type { PackageFiles } from './package-files';

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

/** The lines of a package file, empty if it cannot be read. */
export function linesOf(pf: PackageFiles, file: string): string[] {
	return (pf.read(file) ?? '').split(/\r?\n/);
}

/** The 1-based number of the first line of `file` matching `pattern`, `undefined` if none does. */
export function firstLine(pf: PackageFiles, file: string, pattern: RegExp): number | undefined {
	const i = linesOf(pf, file).findIndex(l => pattern.test(l));
	return i < 0 ? undefined : i + 1;
}

const atLocation = (r: { readonly message: string, readonly loc: SourceLocation }) => `${r.message} at ${SourceLocation.format(r.loc)}`;
/** Pretty printing of a finding as its message and location. */
export const MessageAtLocation = {
	[LintingPrettyPrintContext.Query]: atLocation,
	[LintingPrettyPrintContext.Full]:  atLocation
};
