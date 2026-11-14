import { ansiFormatter, FontStyles } from '../../util/text/ansi';
import { fileProtocol } from '../../r-bridge/retriever';

/**
 * Completion suggestions for a specific REPL command
 */
export interface CommandCompletions {
	/** The possible completions for the current argument */
	readonly completions:   string[];
	/**
	 * The current argument fragment being completed, if any.
	 * This is relevant if an argument is composed of multiple parts (e.g. comma-separated lists).
	 */
	readonly argumentPart?: string;
	/** What Tab displays per completion, only used while several remain: readline inserts what it displays. */
	readonly labels?:       ReadonlyMap<string, string>;
	/** Display-only suggestions (e.g. a `<string>` type placeholder): previewed as a ghost hint but never inserted on Tab. */
	readonly hints?:        readonly string[];
	/**
	 * The completer already selected these, so they must not be filtered against the typed fragment again.
	 * Needed when a completion legitimately shares no prefix with what was typed, e.g. a glob expanding to the keys it matches.
	 */
	readonly preFiltered?:  boolean;
}

/** Labels a completion with what it does, see {@link CommandCompletions#labels|labels}. */
export function describeCompletion(insert: string, describe: string): string {
	return `${insert}  ${ansiFormatter.format(describe, { style: FontStyles.Faint })}`;
}

/**
 * Completes the comma-separated list `typed` of names out of `all`: the names not given yet while the last one is unfinished,
 * a comma once it is complete, and a space once all names are given.
 */
export function completeCommaList(typed: string, all: readonly string[]): CommandCompletions {
	const used = typed.split(',').map(r => r.trim());
	const unused = all.filter(r => !used.includes(r));
	const last = used[used.length - 1];
	if(!all.includes(last)) {
		return { completions: unused, argumentPart: last };
	}
	return { completions: [unused.length > 0 ? ',' : ' '], argumentPart: '' };
}

/**
 * Completes a query line of the form `<prefix><names> <code>`: first the `prefix`, then the comma-separated names out of `all`
 * (see {@link completeCommaList}), and finally the {@link fileProtocol} for the code.
 */
export function completePrefixedList(line: readonly string[], startingNewArg: boolean, prefix: string, all: readonly string[]): CommandCompletions {
	if(line.length === 0 || (line.length === 1 && line[0].length < prefix.length)) {
		return { completions: [prefix] };
	} else if((line.length === 1 && startingNewArg) || line.length === 2) {
		return { completions: [fileProtocol] };
	} else if(line.length === 1 && line[0].startsWith(prefix)) {
		return completeCommaList(line[0].slice(prefix.length), all);
	}
	return { completions: [] };
}
