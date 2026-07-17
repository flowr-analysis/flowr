import type { SlicingCriterion, SlicingCriteria } from '../../../slicing/criterion/parse';
import { SliceDirection } from '../../../util/slice-direction';
import { type CommandCompletions, describeCompletion } from '../core';
import type { FlowrConfig } from '../../../config';
import type { SliceQueryOptions } from '../../../queries/catalog/slice-query-options';
import type { ReplOutput } from '../commands/repl-main';
import { ColorEffect, Colors } from '../../../util/text/ansi';

/**
 * Splits `(criteria)flags` into its two parts, matching the closing bracket by depth: a criterion may well
 * carry brackets of its own (the `(file-regex)` suffix of e.g. `2@x(tmp/.*)`), so the first `)` is not it.
 * Returns `undefined` if the argument does not start with a bracket, or if that bracket is never closed.
 */
function splitCriteriaArgument(argument: string | undefined): { criteria: string, flags: string } | undefined {
	if(!argument?.startsWith('(')) {
		return undefined;
	}
	let depth = 0;
	for(let i = 0; i < argument.length; i++) {
		if(argument[i] === '(') {
			depth++;
		} else if(argument[i] === ')' && --depth === 0) {
			return { criteria: argument.slice(1, i), flags: argument.slice(i + 1) };
		}
	}
	return undefined;
}

function sliceFlagSuffix(argument: string | undefined): string {
	return splitCriteriaArgument(argument)?.flags ?? '';
}

/** A flag that may follow the closing bracket of a criteria argument. */
export interface SliceFlag {
	readonly flag:       string
	/** what the flag does, kept to a few words as it is offered as a completion */
	readonly describe:   string
	/** the flag this one only makes sense with, if any */
	readonly requires?:  string
	/** the flags this one must not be combined with */
	readonly conflicts?: readonly string[]
}

/** the flags every slicing query understands, see {@link sliceQueryOptionsParser} */
export const SharedSliceFlags = [
	{ flag: 'i', describe: 'inline sources', conflicts: ['I'] },
	{ flag: 'c', describe: 'include callees' },
	{ flag: 'I', describe: 'inline all files', conflicts: ['i'] },
	{ flag: 'B', describe: 'banners', requires: 'I' }
] as const satisfies readonly SliceFlag[];

/** the flags of the `static-slice` query: a dice fixes both directions, so only it can be told to slice forward */
export const StaticSliceFlags = [{ flag: 'f', describe: 'slice forward' }, ...SharedSliceFlags] as const satisfies readonly SliceFlag[];

/**
 * Checks whether the given argument represents a slicing direction with an `f` suffix (in any flag order).
 */
export function sliceDirectionParser(argument: string): SliceDirection {
	return sliceFlagSuffix(argument).includes('f') ? SliceDirection.Forward : SliceDirection.Backward;
}

/**
 * The {@link SliceQueryOptions} the flag suffix of `argument` requests, shared by every slicing query:
 * `i` inlines resolvable `source()` calls, `I` inlines all files (`IB` with a banner comment per file), and
 * `c` slices past function-definition boundaries. Absent flags are left out entirely, so the query defaults apply.
 */
export function sliceQueryOptionsParser(argument: string): SliceQueryOptions {
	const flags = sliceFlagSuffix(argument);
	return {
		...(flags.includes('i') ? { inlineSources: true } : {}),
		...(flags.includes('I') ? { inlineFull: flags.includes('B') ? 'banner' as const : true } : {}),
		...(flags.includes('c') ? { includeCallees: true } : {})
	};
}

/** the given flags and what they do, e.g. for a help text: `f (slice forward), B (banners, needs I)` */
export function describeSliceFlags(flags: readonly SliceFlag[]): string {
	return flags.map(f => `${f.flag} (${f.describe}${f.requires ? `, needs ${f.requires}` : ''})`).join(', ');
}

function warn(output: ReplOutput, message: string): void {
	output.stderr(output.formatter.format(message, { color: Colors.Yellow, effect: ColorEffect.Foreground }));
}

/**
 * Warns about the flags of `argument` that `flags` does not know (a `f` on a dice, a typo, ...) or that
 * {@link SliceFlag#conflicts|conflict} with each other, as they are applied silently otherwise.
 */
export function warnAboutSliceFlags(output: ReplOutput, argument: string, flags: readonly SliceFlag[]): void {
	const given = [...new Set([...sliceFlagSuffix(argument)])];
	const known = new Map(flags.map(f => [f.flag, f]));
	const unknown = given.filter(f => !known.has(f));
	if(unknown.length > 0) {
		warn(output, `Ignoring unknown flag${unknown.length > 1 ? 's' : ''} ${unknown.map(f => `'${f}'`).join(', ')}. Known flags: ${describeSliceFlags(flags)}.`);
	}
	for(const [i, f] of given.entries()) {
		const clash = known.get(f)?.conflicts?.filter(c => given.indexOf(c) > i) ?? [];
		if(clash.length > 0) {
			warn(output, `The flag '${f}' cannot be combined with ${clash.map(c => `'${c}'`).join(', ')}, the latter wins.`);
		}
	}
}

/**
 * The R code of a query line, i.e. everything after the argument at `from`. The line is split at whitespace, so
 * unquoted code arrives as several parts and only re-joining them yields all of it.
 */
export function queryLineCode(line: readonly string[], from = 1): string | undefined {
	const code = line.slice(from).join(' ').trim();
	return code.length > 0 ? code : undefined;
}

/**
 * Parses a single slicing criterion from the given argument.
 */
export function sliceCriterionParser(argument: string | undefined): SlicingCriterion | undefined {
	return splitCriteriaArgument(argument)?.criteria as SlicingCriterion | undefined;
}

/**
 * Parses multiple slicing criteria from the given argument.
 */
export function sliceCriteriaParser(argument: string | undefined): SlicingCriteria | undefined {
	return splitCriteriaArgument(argument)?.criteria.split(';') as SlicingCriteria | undefined;
}

/** Last partial criterion fragment after the most recent `;` or after `(`. */
function lastCriterionFragment(arg: string): string {
	return arg.slice(Math.max(arg.indexOf('(') + 1, arg.lastIndexOf(';') + 1));
}

/**
 * The completions for the flag suffix of `arg`, offering every flag of `flags` the argument does not carry yet,
 * whose {@link SliceFlag#requires|required} flag it does, and which none of its flags
 * {@link SliceFlag#conflicts|conflict} with. A trailing space is offered too, to move on to the code.
 * Returns `undefined` while the criteria are still open.
 */
export function sliceFlagCompletions(arg: string, flags: readonly SliceFlag[]): CommandCompletions | undefined {
	const split = splitCriteriaArgument(arg);
	if(!split) {
		return undefined;
	}
	const has = (flag: string) => split.flags.includes(flag);
	const offered = flags.filter(f =>
		!has(f.flag)
		&& (f.requires === undefined || has(f.requires))
		&& !f.conflicts?.some(has)
	);
	return {
		completions: [...offered.map(f => arg + f.flag), arg + ' '],
		labels:      new Map([
			...offered.map(f => [arg + f.flag, describeCompletion(f.flag, f.describe)] as const),
			[arg + ' ', describeCompletion('<space>', 'then the code')] as const
		]),
		argumentPart: arg
	};
}

/**
 * Tab-completer for query arguments of the form `(line@var;line@var;...)`.
 * Guides the user step by step: `(` then digits then `@` then variable then `)`, then the flags.
 */
export function criteriaQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	if(line.length === 0) {
		return { completions: ['('] };
	}
	if(startingNewArg || line.length !== 1) {
		return { completions: [] };
	}
	const arg = line[0];
	const flags = sliceFlagCompletions(arg, StaticSliceFlags);
	if(flags) {
		return flags;
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
	const inner = splitCriteriaArgument(argument)?.criteria;
	if(inner === undefined) {
		return undefined;
	}
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
