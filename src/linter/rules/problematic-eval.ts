import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty, LintingResultCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import type { InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { executeQueries } from '../../queries/query';
import type { InputSourcesQuery, InputSourcesQueryResult } from '../../queries/catalog/input-sources-query/input-sources-query-format';
import type { SlicingCriterion } from '../../slicing/criterion/parse';

/**
 * Format a list of input sources either as a single-line string (inline) or a block.
 * - inline: returns a semicolon-separated single-line summary
 * - block: returns an array of lines (to be joined with newlines by the caller)
 */
function formatInputSources(inputs: InputSources, inline = true): string | string[] {
	if(!inputs || inputs.length === 0) {
		return inline ? '' : [];
	}
	if(inline) {
		return inputs.map(s => `${s.id} (type: ${s.type}, trace: ${s.trace}${s.cds ? ', cds: [' + s.cds.join(',') + ']' : ''})`).join('; ');
	}
	return inputs.map(s => `- ${s.id}: type=${s.type}, trace=${s.trace}${s.cds ? ', cds=[' + s.cds.join(',') + ']' : ''}`);
}

/**
 *
 */
export interface ProblematicEvalResult extends LintingResult {
	loc:     SourceLocation
	sources: InputSources
}

export interface ProblematicEvalConfig extends MergeableRecord {
	/**
	 * All calls that should be considered to be valid eval entry points, this will be interpreted as a Regex!
	 */
	considerAsEval: string
}

export type ProblematicEvalMetadata = MergeableRecord;

export const PROBLEMATIC_EVAL = {
	/* create a search that finds calls that look like eval-like functions */
	createSearch: config => Q.fromQuery({
		type:          'call-context',
		callName:      config.considerAsEval,
		callNameExact: false
	}),
	processSearchResult: async(elements, _config, data): Promise<{ results: ProblematicEvalResult[], '.meta': ProblematicEvalMetadata }> => {
		const results: ProblematicEvalResult[] = [];

		for(const element of elements.getElements()) {
			const nid = element.node.info.id;

			// run an input-sources query for this eval-like call
			const q: InputSourcesQuery = { type: 'input-sources', criterion: nid as unknown as SlicingCriterion };
			const all = await executeQueries({ analyzer: data.analyzer }, [q]) as unknown as Record<'input-sources', InputSourcesQueryResult> & { '.meta'?: unknown };
			const inputSourcesResult = all['input-sources'];
			const sources = inputSourcesResult?.results?.[String(nid)] ?? [];

			// if any input is not a constant or derived constant, flag it
			const problematic = sources.some(s => s.type !== InputType.Constant && s.type !== InputType.DerivedConstant);
			if(problematic) {
				results.push({
					involvedId: nid,
					certainty:  sources.some(s => s.type === InputType.Unknown) ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid(),
					sources
				} as ProblematicEvalResult);
			}
		}

		return {
			results,
			'.meta': {}
		};
	},
	/* helper to format input sources for pretty printing */
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => {
			const inputs = result.sources ?? [];
			const srcStr = formatInputSources(inputs, true) as string;
			return `Use of eval-like function at ${SourceLocation.format(result.loc)}${srcStr ? `; inputs: ${srcStr}` : ''}`;
		},
		[LintingPrettyPrintContext.Full]: result => {
			const inputs = result.sources ?? [];
			const srcLines = formatInputSources(inputs, false) as string[];
			return `Use of eval-like function at ${SourceLocation.format(result.loc)} is potentially problematic${srcLines.length ? '\nInputs:\n' + srcLines.join('\n') : ''}`;
		}
	},
	info: {
		name:          'Problematic eval',
		description:   'Detects uses of eval-like functions whose inputs are not statically constant. Prints the computed input-sources for the eval and flags usages that depend on non-constant/trusted inputs.',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Readability],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			considerAsEval: '^eval$'
		}
	}
} as const satisfies LintingRule<ProblematicEvalResult, ProblematicEvalMetadata, ProblematicEvalConfig>;
