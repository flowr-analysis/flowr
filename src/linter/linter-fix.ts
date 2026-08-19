/**
 * Applying the {@link LintQuickFix|quick fixes} a lint run offers, so a fix is something flowR carries out rather
 * than only something it reports.
 * @module
 */
import type { LintingResult } from './linter-format';
import { LintQuickFix, LintingResults } from './linter-format';
import type { LintResultsByRule } from './linter-output';
import { SourceLocation, SourceRange } from '../util/range';
import { guard, isNotUndefined } from '../util/assert';

/** one fix as an edit of the text: the span it covers, and what stands there instead */
interface Edit {
	readonly range:  SourceRange;
	readonly from:   number;
	readonly to:     number;
	readonly insert: string;
}

/**
 * The offset `line:column` sits at, both counted from one. A place beyond the text is pulled back into it, so a
 * range that outruns its line cuts at the line's end rather than reaching into the ones after it.
 */
function offsetOf(code: string, lineStarts: readonly number[], line: number, column: number): number {
	const at = Math.min(Math.max(line, 1), lineStarts.length);
	/* the last place on the line is its final character: the break after it separates lines, it is not one */
	const beyond = at < lineStarts.length ? lineStarts[at] - 1 : code.length;
	return Math.min(lineStarts[at - 1] + Math.max(column, 1) - 1, beyond);
}

function lineStartsOf(code: string): number[] {
	const starts = [0];
	for(let i = code.indexOf('\n'); i >= 0; i = code.indexOf('\n', i + 1)) {
		starts.push(i + 1);
	}
	return starts;
}

/** an edit that leaves nothing but whitespace behind on its lines takes them with it, rather than a blank line */
function widenToLine(code: string, lineStarts: readonly number[], edit: Edit): Edit {
	if(edit.insert.length > 0) {
		return edit;
	}
	const lineStart = offsetOf(code, lineStarts, edit.range[0], 1);
	const nextLine = code.indexOf('\n', edit.to);
	const lineEnd = nextLine < 0 ? code.length : nextLine + 1;
	if(code.slice(lineStart, edit.from).trim() !== '' || code.slice(edit.to, lineEnd).trim() !== '') {
		return edit;
	}
	return { ...edit, from: lineStart, to: lineEnd };
}

export const LintQuickFixes = {
	/** Every quick fix a lint run offers, grouped by the file it changes. Fixes flowR cannot place are left out. */
	byFile(this: void, results: LintResultsByRule): Map<string, LintQuickFix[]> {
		const byFile = new Map<string, LintQuickFix[]>();
		for(const perRule of Object.values(results)) {
			if(LintingResults.isError(perRule)) {
				continue;
			}
			for(const result of perRule.results as readonly LintingResult[]) {
				for(const fix of result.quickFix ?? []) {
					const file = SourceLocation.getFile(fix.loc);
					if(file === undefined || !LintQuickFix.isPlaced(fix)) {
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
	 * The content of one file with the given fixes carried out, as {@link LintQuickFixes.byFile} groups them. Of two
	 * overlapping fixes only the one coming first in the file is kept, since the second would be applied to a range
	 * that no longer says what it did. What survives is then carried out back to front, so the offsets of the edits
	 * still to come stay valid.
	 *
	 * Fixes naming a file must all name the same one, as those of another file would cut at offsets of a text that
	 * is not this one. Fixes naming none are taken to belong to whatever `code` is.
	 */
	apply(this: void, code: string, fixes: readonly LintQuickFix[]): string {
		const files = new Set(fixes.map(fix => SourceLocation.getFile(fix.loc)).filter(isNotUndefined));
		guard(files.size <= 1, () => `quick fixes of ${[...files].join(', ')} cannot be applied to one text`);
		const lineStarts = lineStartsOf(code);
		const edits: Edit[] = [];
		for(const fix of fixes.toSorted((a, b) => SourceLocation.compare(a.loc, b.loc))) {
			if(!LintQuickFix.isPlaced(fix)) {
				continue;
			}
			const range = SourceLocation.getRange(fix.loc);
			/* what is kept is disjoint and runs left to right, so the last of them is the only one that can be met */
			const last = edits[edits.length - 1];
			if(last !== undefined && SourceRange.overlap(last.range, range)) {
				continue;
			}
			const from = offsetOf(code, lineStarts, range[0], range[1]);
			edits.push(widenToLine(code, lineStarts, {
				range,
				from,
				/* the end column names the last character, so the cut runs one past it */
				to:     Math.max(from, offsetOf(code, lineStarts, range[2], range[3] + 1)),
				insert: LintQuickFix.inserted(fix)
			}));
		}
		let out = code;
		for(let i = edits.length - 1; i >= 0; i--) {
			const { from, to, insert } = edits[i];
			out = out.slice(0, from) + insert + out.slice(to);
		}
		return out;
	}
} as const;
