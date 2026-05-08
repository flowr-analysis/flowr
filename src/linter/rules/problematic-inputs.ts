import { type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty, LintingResultCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import type { InputClassifierConfig, InputSource, InputSources } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import { InputType } from '../../queries/catalog/input-sources-query/simple-input-classifier';
import type { InputSourcesQuery } from '../../queries/catalog/input-sources-query/input-sources-query-format';
import { SlicingCriterion } from '../../slicing/criterion/parse';

const defaultConsider = ['^eval$', '^system$', '^system2$', '^shell$'] as const;

function normalizeConsider(cfg?: ProblematicInputsConfig): RegExp[] {
	if(cfg?.consider === undefined) {
		return Array.from(defaultConsider, s => new RegExp(s));
	}
	if(Array.isArray(cfg.consider)) {
		const arr = cfg.consider.length === 0 ? Array.from(defaultConsider) as string[] : cfg.consider;
		// deduplicate while preserving order
		return Array.from(new Set(arr), s => new RegExp(s));
	}
	return [new RegExp(cfg.consider)];
}

/**
 * Format a list of input sources either as a single-line string (inline) or a block.
 * - inline: returns a semicolon-separated single-line summary
 * - block: returns an array of lines (to be joined with newlines by the caller)
 */
function formatInputSources(inputs: InputSources, inline = true): string | string[] {
	if(!inputs || inputs.length === 0) {
		return inline ? '' : [];
	}
	const formatOne = (s: InputSource, inlineMode: boolean) => {
		const typeStr = '[' + s.types.join(',') + ']';
		const cdsStr = s.cds ? ', cds: [' + s.cds.join(',') + ']' : '';
		return inlineMode
			? `${s.id} (type: ${typeStr}, trace: ${s.trace}${cdsStr})`
			: `- ${s.id}: type=${typeStr}, trace=${s.trace}${cdsStr}`;
	};
	if(inline) {
		return inputs.map(s => formatOne(s, true)).join('; ');
	}
	return inputs.map(s => formatOne(s, false));
}

// small helpers to keep checks readable
function hasUnknownSource(sources: InputSources): boolean {
	return sources.some(s => s.types.includes(InputType.Unknown));
}

function isProblematicForAllowed(sources: InputSources, allowed: InputType[]): boolean {
	return sources.some(s => s.types.some(t => !allowed.includes(t)));
}

/**
 * Describes a linting result for a problematic eval usage, including the location of the eval call and the computed input sources that lead to it.
 */
export interface ProblematicInputsResult extends LintingResult {
	name:    string
	loc:     SourceLocation
	sources: InputSources
}
export interface ProblematicInputsConfig extends MergeableRecord {
	consider?: string | string[],
	inputFns?: InputClassifierConfig
}

export type ProblematicInputsMetadata = MergeableRecord;

export const PROBLEMATIC_INPUTS = {
	createSearch: config => {
		const considerArr = normalizeConsider(config);
		const queries = considerArr.map((name, i) => ({
			type:          'call-context',
			callName:      name,
			callNameExact: false,
			subkind:       `fn-${i}`
		} as const));
		return Q.fromQuery(...queries);
	},
	processSearchResult: async(elements, config, data) => {
		const results: ProblematicInputsResult[] = [];

		const defaultAccept: InputType[] = [InputType.Constant, InputType.DerivedConstant];
		for(const element of elements.getElements()) {
			const nid = element.node.info.id;
			const criterion = SlicingCriterion.fromId(nid);
			const q: InputSourcesQuery = { type: 'input-sources', criterion, config: config.inputFns };
			const all = await data.analyzer.query([q]);
			const inputSourcesResult = all['input-sources'];
			const sources = inputSourcesResult?.results?.[criterion] ?? [];

			if(isProblematicForAllowed(sources, defaultAccept)) {
				const certainty = hasUnknownSource(sources) ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain;
				results.push({
					involvedId: nid,
					certainty,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid(),
					name:       element.node.lexeme ?? '',
					sources
				} as ProblematicInputsResult);
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
			return 'Use of configured dynamic call at ' + SourceLocation.format(result.loc) + (srcStr ? '; inputs: ' + srcStr : '');
		},
		[LintingPrettyPrintContext.Full]: result => {
			const inputs = result.sources ?? [];
			const srcLines = formatInputSources(inputs, false) as string[];
			return 'Use of configured dynamic call at ' + SourceLocation.format(result.loc) + ' is potentially problematic' + (srcLines.length ? '\nInputs:\n' + srcLines.join('\n') : '');
		}
	},
	info: {
		name:          'Problematic inputs',
		description:   'Detects uses of configured dynamic calls (e.g. eval, system) whose inputs are not statically constant. Prints the computed input-sources for the call and flags usages that depend on non-constant/trusted inputs.',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell, LintingRuleTag.Readability, LintingRuleTag.Performance],
		version:       '0.1.0',
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			consider: defaultConsider
		}
	}
} as const satisfies LintingRule<ProblematicInputsResult, ProblematicInputsMetadata, ProblematicInputsConfig>;
