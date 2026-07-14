import type { SlicingCriterion, SlicingCriteria } from '../../../slicing/criterion/parse';
import { SliceDirection } from '../../../util/slice-direction';
import type { CommandCompletions } from '../core';
import type { FlowrConfig } from '../../../config';

/** the single-char flag suffix after the closing `)` of a criteria list (e.g. `f` forward, `i` inline sources) */
function sliceFlagSuffix(argument: string): string {
	const endBracket = argument.indexOf(')');
	return endBracket >= 0 ? argument.slice(endBracket + 1) : '';
}

/**
 * Checks whether the given argument represents a slicing direction with an `f` suffix (in any flag order).
 */
export function sliceDirectionParser(argument: string): SliceDirection {
	return sliceFlagSuffix(argument).includes('f') ? SliceDirection.Forward : SliceDirection.Backward;
}

/**
 * Whether the argument requests inline slicing via an `i` suffix (e.g. `(12@x)i`, `(12@x)fi`), which inlines
 * resolvable `source()` calls into the reconstruction so the slice is a single self-contained R text.
 */
export function sliceInlineParser(argument: string): boolean {
	return sliceFlagSuffix(argument).includes('i');
}

/**
 * Parses a single slicing criterion from the given argument.
 */
export function sliceCriterionParser(argument: string | undefined): SlicingCriterion | undefined {
	if(argument?.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		return argument.slice(1, endBracket) as SlicingCriterion;
	}
}

/**
 * Parses multiple slicing criteria from the given argument.
 */
export function sliceCriteriaParser(argument: string | undefined): SlicingCriteria | undefined {
	if(argument?.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		const criteriaPart = argument.slice(1, endBracket);
		const criteria = criteriaPart.split(';');

		return criteria as SlicingCriteria;
	}
}

/** Last partial criterion fragment after the most recent `;` or after `(`. */
function lastCriterionFragment(arg: string): string {
	return arg.slice(Math.max(arg.indexOf('(') + 1, arg.lastIndexOf(';') + 1));
}

/**
 * Tab-completer for query arguments of the form `(line@var;line@var;...)`.
 * Guides the user step by step: `(` then digits then `@` then variable then `)`.
 */
export function criteriaQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	if(line.length === 0) {
		return { completions: ['('] };
	}
	if(startingNewArg || line.length !== 1) {
		return { completions: [] };
	}
	const arg = line[0];
	if(arg.endsWith(')') || arg.endsWith(')f')) {
		return { completions: [] };
	}
	const fragment = lastCriterionFragment(arg);
	if(/^\d+$/.test(fragment)) {
		return { completions: [`${arg}@`], argumentPart: arg };
	}
	if(/^\d+@\w+$/.test(fragment)) {
		return { completions: [`${arg})`], argumentPart: arg };
	}
	return { completions: [] };
}

/**
 * Parses a dice argument of the form `(from1;from2->to1;to2)`.
 * Returns `{ from, to }` on success, or `undefined` if the argument is malformed.
 * Each side is a semicolon-separated list of slicing criteria; a single criterion needs no semicolon.
 */
export function diceCriteriaParser(argument: string | undefined): { from: SlicingCriteria; to: SlicingCriteria } | undefined {
	if(!argument?.startsWith('(') || !argument.includes(')')) {
		return undefined;
	}
	const endBracket = argument.indexOf(')');
	const inner = argument.slice(1, endBracket);
	const arrowIdx = inner.indexOf('->');
	if(arrowIdx < 0) {
		return undefined;
	}
	const from = inner.slice(0, arrowIdx).split(';').filter(s => s.length > 0) as SlicingCriteria;
	const to   = inner.slice(arrowIdx + 2).split(';').filter(s => s.length > 0) as SlicingCriteria;
	if(from.length === 0 || to.length === 0) {
		return undefined;
	}
	return { from, to };
}
