import type { LintingResult, LintingRule, LintQuickFixRemove } from '../linter-format';
import { LintingPrettyPrintContext , LintingCertainty } from '../linter-format';

import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import type { SourceRange } from '../../util/range';
import { rangeCompare, rangeIsSubsetOf , mergeRanges, rangeFrom } from '../../util/range';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import { isFunctionDefinitionVertex, isVariableDefinitionVertex, VertexType } from '../../dataflow/graph/vertex';
import { edgeIncludesType, EdgeType } from '../../dataflow/graph/edge';
import { FlowrFilterCombinator } from '../../search/flowr-search-filters';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';

export interface UnusedDefinitionResult extends LintingResult {
	variableName?: string,
	range:         SourceRange
}

export interface UnusedDefinitionConfig extends MergeableRecord {
	/**
	 * Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).
	 */
	includeFunctionDefinitions: boolean
}

export interface UnusedDefinitionMetadata extends MergeableRecord {
	totalConsidered: number
}

const InterestingEdgesVariable = EdgeType.Reads | EdgeType.Calls | EdgeType.DefinesOnCall;
const InterestingEdgesFunction = EdgeType.Reads | EdgeType.Calls;// include read as this could print the function definition
const InterestingEdgesTargets = EdgeType.SideEffectOnCall;

function getDefinitionArguments(def: NodeId, dfg: DataflowGraph) {
	return [...dfg.outgoingEdges(def) ?? []].filter(([,{ types }]) => edgeIncludesType(types, EdgeType.DefinedBy))
		.map(([target]) => target);
}

function buildQuickFix(variable: RNode<ParentInformation>, dfg: DataflowGraph, ast: NormalizedAst): LintQuickFixRemove[] | undefined {
	// first we check whether any of the 'Defined by' targets have any obligations - if so, we can not remove the definition
	// otherwise we can automatically remove the full definition!

	if(variable.info.role === RoleInParent.Accessed || variable.info.role === RoleInParent.ForVariable) {
		// this is an access or a for variable, we can not remove it currently
		return undefined;
	}
	const definedBys = getDefinitionArguments(variable.info.id, dfg);

	const hasImportantArgs = definedBys.some(d => dfg.unknownSideEffects.has(d))
		|| definedBys.flatMap(e => [...dfg.outgoingEdges(e) ?? []])
			.some(([target,{ types }]) => {
				return edgeIncludesType(types, InterestingEdgesTargets) || dfg.unknownSideEffects.has(target);
			});

	if(hasImportantArgs) {
		return undefined; // we can not remove this definition, it has important arguments
	}

	const totalRangeToRemove = mergeRanges(
		...definedBys.map(d => {
			const vertex = ast.idMap.get(d);
			return vertex?.info.fullRange ?? vertex?.location;
		}),
		variable.info.fullRange ?? variable.location
	);

	return [{
		type:        'remove',
		range:       totalRangeToRemove,
		description: `Remove unused definition of \`${variable.lexeme}\``
	}];
}

/**
 * consider `x <- function() ...` if we say `x` is unused and propose to remove everything, there should be no separate quick fix for the function definition
 */
function onlyKeepSupersetOfUnused(
	elements: UnusedDefinitionResult[]
): UnusedDefinitionResult[] {
	const ranges = elements.flatMap(e => e.quickFix?.map(q => q.range) ?? [e.range]);
	if(ranges.length <= 1) {
		return elements; // nothing to filter, only one element
	}
	return elements.filter(e => {
		const otherRange = mergeRanges(...(e.quickFix?.map(q => q.range) ?? [e.range]));
		return !ranges.some(r => rangeCompare(r, otherRange) !== 0 && rangeIsSubsetOf(otherRange, r)); // there is no smaller remove
	});
}

export const UNUSED_DEFINITION = {
	/* this can be done better once we have types */
	createSearch: config => Q.all().filter(
		config.includeFunctionDefinitions ? FlowrFilterCombinator.is(VertexType.VariableDefinition).or(VertexType.FunctionDefinition) : VertexType.VariableDefinition),
	processSearchResult: (elements, config, data): { results: UnusedDefinitionResult[], '.meta': UnusedDefinitionMetadata } => {
		const metadata: UnusedDefinitionMetadata = {
			totalConsidered: 0
		};
		return {
			results: onlyKeepSupersetOfUnused(elements.getElements().flatMap(element => {
				metadata.totalConsidered++;

				const dfgVertex = data.dataflow.graph.getVertex(element.node.info.id);
				if(!dfgVertex || (
					!isVariableDefinitionVertex(dfgVertex)
					&& isFunctionDefinitionVertex(dfgVertex) && !config.includeFunctionDefinitions
				)) {
					return undefined;
				}

				const ingoingEdges = data.dataflow.graph.ingoingEdges(dfgVertex.id);

				const interestedIn = isVariableDefinitionVertex(dfgVertex) ? InterestingEdgesVariable : InterestingEdgesFunction;
				const ingoingInteresting = ingoingEdges?.values().some(e => edgeIncludesType(e.types, interestedIn));

				if(ingoingInteresting) {
					return undefined;
				}

				// found an unused definition
				const variableName = element.node.lexeme;
				return [{
					certainty: LintingCertainty.Uncertain,
					variableName,
					range:     element.node.info.fullRange ?? element.node.location ?? rangeFrom(-1, -1, -1, -1),
					quickFix:  buildQuickFix(element.node, data.dataflow.graph, data.normalize)
				}] satisfies UnusedDefinitionResult[];
			}).filter(isNotUndefined)),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Definition of \`${result.variableName}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Definition of \`${result.variableName}\` at ${formatRange(result.range)} is unused`
	},
	info: {
		name:          'Unused Definitions',
		description:   'Checks for unused definitions.',
		tags:          [LintingRuleTag.Readability, LintingRuleTag.Smell, LintingRuleTag.QuickFix],
		defaultConfig: {
			includeFunctionDefinitions: true
		}
	}
} as const satisfies LintingRule<UnusedDefinitionResult, UnusedDefinitionMetadata, UnusedDefinitionConfig>;
