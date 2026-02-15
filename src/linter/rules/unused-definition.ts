import { type LintingResult, type LintingRule, type LintQuickFixRemove, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import { isFunctionDefinitionVertex, isVariableDefinitionVertex, VertexType } from '../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { FlowrFilterCombinator } from '../../search/flowr-search-filters';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';

export interface UnusedDefinitionResult extends LintingResult {
	variableName?: string,
	loc:           SourceLocation
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
	return dfg.outgoingEdges(def)?.entries().filter(([,e]) => DfEdge.includesType(e, EdgeType.DefinedBy))
		.map(([target]) => target).toArray() ?? [];
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
		|| definedBys.flatMap(e => Array.from(dfg.outgoingEdges(e) ?? []))
			.some(([target, e]) => {
				return DfEdge.includesType(e, InterestingEdgesTargets) || dfg.unknownSideEffects.has(target);
			});

	if(hasImportantArgs) {
		return undefined; // we can not remove this definition, it has important arguments
	}

	const totalRangeToRemove = SourceLocation.merge(
		[...definedBys.map(d => {
			const vertex = ast.idMap.get(d);
			return vertex ? SourceLocation.fromNode(vertex) : undefined;
		}),
		variable.info.fullRange ?? variable.location]
	);

	return [{
		type:        'remove',
		loc:         totalRangeToRemove ?? SourceLocation.invalid(),
		description: `Remove unused definition of \`${variable.lexeme}\``
	}];
}

/**
 * consider `x <- function() ...` if we say `x` is unused and propose to remove everything, there should be no separate quick fix for the function definition
 */
function onlyKeepSupersetOfUnused(
	elements: UnusedDefinitionResult[]
): UnusedDefinitionResult[] {
	const locs = elements.flatMap(e => e.quickFix?.map(q => q.loc) ?? [e.loc]);
	if(locs.length <= 1) {
		return elements; // nothing to filter, only one element
	}
	return elements.filter(e => {
		const otherLoc = SourceLocation.merge((e.quickFix?.map(q => q.loc) ?? [e.loc])) ?? SourceLocation.invalid();
		return !locs.some(r => SourceLocation.compare(r, otherLoc) !== 0 && SourceLocation.isSubsetOf(otherLoc, r)); // there is no smaller remove
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
				const ingoingInteresting = ingoingEdges?.values().some(e => DfEdge.includesType(e, interestedIn));

				if(ingoingInteresting) {
					return undefined;
				}

				// found an unused definition
				const variableName = element.node.lexeme;
				return [{
					certainty:  LintingResultCertainty.Uncertain,
					variableName,
					involvedId: element.node.info.id,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid(),
					quickFix:   buildQuickFix(element.node, data.dataflow.graph, data.normalize)
				}] satisfies UnusedDefinitionResult[];
			}).filter(isNotUndefined)),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Definition of \`${result.variableName}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Definition of \`${result.variableName}\` at ${SourceLocation.format(result.loc)} is unused`
	},
	info: {
		name:          'Unused Definitions',
		description:   'Checks for unused definitions.',
		tags:          [LintingRuleTag.Readability, LintingRuleTag.Smell, LintingRuleTag.QuickFix],
		// our limited analysis causes unused definitions involving complex reflection etc. not to be included in our result, but unused definitions are correctly validated
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			includeFunctionDefinitions: true
		}
	}
} as const satisfies LintingRule<UnusedDefinitionResult, UnusedDefinitionMetadata, UnusedDefinitionConfig>;
