/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import type { ControlDependency, DataflowInformation } from './info';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from './environments/environment';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

export interface DataflowProcessorInformation<OtherInfo> {
	readonly parser:               Parser<KnownParserType>
	/**
	 * Initial and frozen ast-information
	 */
	readonly completeAst:          NormalizedAst<OtherInfo>
	/**
	 * Correctly contains pushed local scopes introduced by `function` scopes.
	 * Will by default *not* contain any symbol-bindings introduced along the way; they have to be decorated when moving up the tree.
	 */
	readonly environment:          REnvironmentInformation
	/**
	 * Other processors to be called by the given functions
	 */
	readonly processors:           DataflowProcessors<OtherInfo>
	/**
	 * The chain of file paths that lead to this inclusion.
	 * The most recent (last) entry is expected to always be the current one.
	 */
	readonly referenceChain:       (string | undefined)[]
	/**
	 * The chain of control-flow {@link NodeId}s that lead to the current node (e.g., of known ifs).
	 */
	readonly cds:                  ControlDependency[] | undefined
	/**
	 * The flowr context used for environment seeding, files, and precision control, ...
	 */
	readonly ctx:                  FlowrAnalyzerContext
	/**
	 * If set, the function call with this id is known to resolve to built-ins only,
	 * so its vertex needs no environment snapshot (it would be discarded by markAsOnlyBuiltIn anyway).
	 */
	readonly builtInNoEnv?:        NodeId
	/**
	 * Escape hatch for hot recursive paths (currently: long left-associative binary-op / pipe chains).
	 * When set and its `rootId` matches the function call currently being processed by {@link processAllArguments}
	 * (see the common argument processing shared by all function-call-shaped processors), its `info` is used as the
	 * already-processed first argument instead of processing that argument again. This lets a caller pre-compute
	 * a left-associative operator spine with an explicit loop instead of recursing into it one call stack frame
	 * per nesting level.
	 */
	readonly precomputedFirstArg?: { readonly rootId: NodeId, readonly info: DataflowInformation }
	/**
	 * Companion to {@link precomputedFirstArg}: when set and its `nodeId` matches the node
	 * {@link processFunctionArgument} is about to process as an argument's value, its `info` is used instead of
	 * processing (and recursing into) that node again. Needed because the "first argument" of a chained call is
	 * itself wrapped in an {@link RArgument} that still goes through the normal argument processing; without this,
	 * that processing would recurse into the (already processed) value once more per spine level, turning the
	 * linear iterative fold into a quadratic one.
	 */
	readonly precomputedValue?:    { readonly nodeId: NodeId, readonly info: DataflowInformation }
}

export type DataflowProcessor<OtherInfo, NodeType extends RNodeWithParent<OtherInfo>> = (node: NodeType, data: DataflowProcessorInformation<OtherInfo>) => DataflowInformation;

type NodeWithKey<OtherInfo, Key> = RNode<OtherInfo & ParentInformation> & { type: Key };

/**
 * This way, a processor mapped to a {@link RType#Symbol} require a {@link RSymbol} as first parameter and so on.
 */
export type DataflowProcessors<OtherInfo> = {
	[key in RNode['type']]: DataflowProcessor<OtherInfo, NodeWithKey<OtherInfo, key>>
};

/**
 * Originally, dataflow processor was written as a two-way fold, but this produced problems when trying to resolve function calls
 * which require information regarding the calling *and* definition context. While this only is a problem for late bindings as they happen
 * with functions (and probably quote'd R-expressions), it is still a problem that must be dealt with.
 * Therefore, the dataflow processor has no complete control over the traversal and merge strategy of the graph, with each processor being in
 * the position to call the other processors as needed for its children.
 * <p>
 * Now this method can be called recursively within the other processors to parse the dataflow for nodes that you cannot narrow down
 * in type or context.
 * @param current - The current node to start processing from
 * @param data    - The initial (/current) information to be passed down
 */
export function processDataflowFor<OtherInfo>(
	current: RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	return (
		data.processors[current.type] as DataflowProcessor<OtherInfo & ParentInformation, typeof current>
	)(current, data);
}
