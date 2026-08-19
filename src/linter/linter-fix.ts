/**
 * Applying the {@link LintQuickFix|quick fixes} a lint run offers, so a fix is something flowR carries out rather
 * than only something it reports.
 * @module
 */
import type { LintQuickFix, LintingResult } from './linter-format';
import { LintingResults } from './linter-format';
import type { LintResultsByRule } from './linter-output';
import { SourceLocation, type SourceRange, SourceRange as Range } from '../util/range';

/** the offset `line:column` sits at, both counted from one */
function offsetOf(lineStarts: readonly number[], line: number, column: number): number {
	return lineStarts[Math.min(Math.max(line, 1), lineStarts.length) - 1] + column - 1;
}

function lineStartsOf(code: string): number[] {
	const starts = [0];
	for(let i = code.indexOf('\n'); i >= 0; i = code.indexOf('\n', i + 1)) {
		starts.push(i + 1);
	}
	return starts;
}

/** a removal that leaves nothing but whitespace behind takes its line with it */
function widenToLine(code: string, lineStarts: readonly number[], range: SourceRange, start: number, end: number): [number, number] {
	const lineStart = offsetOf(lineStarts, range[0], 1);
	const nextLine = code.indexOf('\n', end);
	const lineEnd = nextLine < 0 ? code.length : nextLine + 1;
	const blank = code.slice(lineStart, start).trim() === '' && code.slice(end, lineEnd).trim() === '';
	return blank ? [lineStart, lineEnd] : [start, end];
}

export const LintQuickFixes = {
	/** Every quick fix a lint run offers, grouped by the file it changes. Fixes flowR cannot locate are left out. */
	byFile(this: void, results: LintResultsByRule): Map<string, LintQuickFix[]> {
		const byFile = new Map<string, LintQuickFix[]>();
		for(const perRule of Object.values(results)) {
			if(LintingResults.isError(perRule)) {
				continue;
			}
			for(const result of perRule.results as readonly LintingResult[]) {
				for(const fix of result.quickFix ?? []) {
					const file = SourceLocation.getFile(fix.loc);
					if(file === undefined) {
						continue;
					}
					const known = byFile.get(file);
					if(known === undefined) {
						byFile.set(file, [fix]);
					} else {
						known.push(fix);
					}
				}
			}
		}
		return byFile;
	},
	/**
	 * The content of one file with the given fixes carried out. Of two overlapping fixes only the one coming first in
	 * the file is kept, since the second would be applied to a range that no longer says what it did. What survives is
	 * then carried out back to front, so the offsets of the fixes still to come stay valid.
	 */
	apply(this: void, code: string, fixes: readonly LintQuickFix[]): string {
		const lineStarts = lineStartsOf(code);
		const kept: LintQuickFix[] = [];
		for(const fix of [...fixes].sort((a, b) => SourceLocation.compare(a.loc, b.loc))) {
			if(!kept.some(done => Range.overlap(SourceLocation.getRange(done.loc), SourceLocation.getRange(fix.loc)))) {
				kept.push(fix);
			}
		}
		let out = code;
		for(const fix of kept.reverse()) {
			const range = SourceLocation.getRange(fix.loc);
			const from = offsetOf(lineStarts, range[0], range[1]);
			// the end column names the last character, so the cut runs one past it
			const to = offsetOf(lineStarts, range[2], range[3] + 1);
			if(fix.type === 'replace') {
				out = out.slice(0, from) + fix.replacement + out.slice(to);
			} else {
				const [wideFrom, wideTo] = widenToLine(code, lineStarts, range, from, to);
				out = out.slice(0, wideFrom) + out.slice(wideTo);
			}
		}
		return out;
	}
} as const;
