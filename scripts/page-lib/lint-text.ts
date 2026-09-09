/**
 * One linter finding in the linter's own words, as both the landing page and the playground say it.
 * @module
 */
import { LintingRules } from '../../src/linter/linter-rules';
import { LintingPrettyPrintContext } from '../../src/linter/linter-format';

/** `Full` is the phrasing meant for a person; the trailing position is dropped, the underline points at it */
export function explain(rule: string, finding: unknown, meta: unknown): string {
	const rules = LintingRules as unknown as Record<string, { prettyPrint: Record<string, (r: never, m: never) => string> }>;
	const print = rules[rule]?.prettyPrint;
	if(print === undefined) {
		return rule;
	}
	const say = print[LintingPrettyPrintContext.Full] ?? print[LintingPrettyPrintContext.Query];
	return say(finding as never, meta as never).replace(/\s+at \d+\.\d+(-\d+)?/g, '').trim();
}
