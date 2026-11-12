import { prettyPrint, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { CallContracts } from '../../dataflow/fn/guards/call-contracts';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';

export interface CallContractsResult extends LintingResult {
	/** the function called */
	readonly function: Identifier
	/** what the call breaks of what the function asks for, each condition in R syntax with the values the call hands over, see {@link CallContracts.describe} */
	readonly broken:   readonly string[]
}

export type CallContractsConfig = MergeableRecord;

export interface CallContractsMetadata extends MergeableRecord {
	/** calls of a function flowR knows a contract of */
	readonly checkedCalls: number
}

/**
 * Finds calls that hand a function a value its contract rules out, like `combn(4, -1)` for `m >= 0`, or that leave out an
 * argument it needs: such a call fails whenever it runs. The conditions of the guards of the callee are taken to the call
 * as the guard analysis takes them to a caller, and are only reported if they fail for every value the arguments may hold.
 */
export const CALL_CONTRACTS = {
	createSearch: () => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CfgInformation, {
		checkReachable:       true,
		simplificationPasses: [...DefaultCfgSimplificationOrder, 'analyze-dead-code']
	}),
	processSearchResult: async(elements, _config, data) => {
		const { graph } = await data.dataflow();
		const scope = CallContracts.of(graph, data.inspectContext(), graph.idMap ?? (await data.normalize()).idMap);
		let checkedCalls = 0;
		const results: CallContractsResult[] = [];
		for(const element of elements.getElements()) {
			const id = element.node.info.id;
			const vertex = graph.getVertex(id);
			if(!DfgVertex.isFunctionCall(vertex) || enrichmentContent(element, Enrichment.CfgInformation)?.isReachable === false || Dataflow.isWithinQuoted(id, graph)) {
				continue;
			}
			const checked = CallContracts.check(id, scope);
			if(checked === undefined) {
				continue;
			}
			checkedCalls++;
			const loc = SourceLocation.fromNode(element.node);
			if(checked.breaches.length > 0 && loc !== undefined) {
				results.push({ certainty: LintingResultCertainty.Uncertain, involvedId: id, loc, function: vertex.name, broken: checked.breaches.map(CallContracts.describe) });
			}
		}
		return { results, '.meta': { checkedCalls } };
	},
	prettyPrint: prettyPrint(
		result => `call of \`${Identifier.toString(result.function)}\` fails its contract at ${SourceLocation.format(result.loc)}`,
		result => `The call of \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)} fails whenever it runs: ${result.broken.join('; ')}.`
	),
	info: {
		name:          'Call Contracts',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds calls that hand a function a value its contract rules out, or leave out an argument it needs, so they fail whenever they run.',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<CallContractsResult, CallContractsMetadata, CallContractsConfig>;
