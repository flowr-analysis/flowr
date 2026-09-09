import { printAsMs } from '../../util/text/time';

/**
 * Whether a generated page may state how long generating it took. Off by default: the wiki is committed, and a
 * measurement taken on whoever ran the generator last says nothing about the reader's machine while rewriting the
 * page on every run. Set `FLOWR_DOC_TIMINGS=1` to keep the numbers in a local run.
 */
export const ShowDocTimings = process.env.FLOWR_DOC_TIMINGS === '1';

/** The fields a result carries a measurement in, which is what makes a serialized result differ between runs. */
const TimingFields = ['timing', 'searchTimeMs', 'processTimeMs'] as const;

/** A {@link JSON.stringify} replacer dropping every {@link TimingFields} entry, `undefined` when the numbers are wanted. */
export const timingReplacer: ((key: string, value: unknown) => unknown) | undefined = ShowDocTimings ? undefined
	: (key, value) => (TimingFields as readonly string[]).includes(key) ? undefined : value;

/**
 * The `... required _2 ms_ and` a sentence about the generation puts before its verb, empty unless
 * {@link ShowDocTimings} asks for it.
 */
export function docTook(ms: number): string {
	return ShowDocTimings ? ` required _${printAsMs(ms)}_ and` : '';
}

const TimingPatterns: readonly (readonly [RegExp, string])[] = [
	[/^(Query: [^\n(]*?) \([\d.]+ ?[a-zµ]+\)$/gm, '$1'],
	[/^[^\n]*\bTook [\d.]+ ?[a-zµ]+[^\n]*\n?/gm, ''],
	[/^_?All queries together required [^\n]*\n?/gm, ''],
	[/^[^\n]*(?:searchTimeMs|processTimeMs): [\d.]+[^\n]*\n?/gm, ''],
	[/,\s*"(?:timing|searchTimeMs|processTimeMs)":\s*-?[\d.]+/g, ''],
	[/"(?:timing|searchTimeMs|processTimeMs)":\s*-?[\d.]+,\s*/g, ''],
	[/\s*"(?:timing|searchTimeMs|processTimeMs)":\s*-?[\d.]+\s*/g, '']
];

/**
 * Removes the measurements a generator embeds in a page it writes, so that regenerating an unchanged page is a
 * no-op. This runs over the finished page rather than at every emitter, so a summarizer flowR does not own here
 * (a query's own ascii summary, say) cannot reintroduce one.
 */
export function withoutTimings(text: string): string {
	if(ShowDocTimings) {
		return text;
	}
	return TimingPatterns.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text);
}
