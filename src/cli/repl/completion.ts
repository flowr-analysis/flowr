import { ansiFormatter, FontStyles } from '../../util/text/ansi';

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
