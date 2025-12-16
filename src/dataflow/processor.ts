/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import type { ControlDependency, DataflowInformation } from './info';
import {
    DeserializeNormalizedAst,
    SerializedNormalizedAst,
	SerializeNormalizedAst,
	type NormalizedAst,
	type ParentInformation,
	type RNodeWithParent,
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from './environments/environment';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { KnownParserType, Parser } from '../r-bridge/parser';
import { FlowrAnalyzerContext, SerializedFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { diffFunctionArguments } from './graph/diff-dataflow-graph';

export interface SerializedDataflowProcessorInformation<OtherInfo>{
    //parser:              EngineConfig['type'];
    //flowrConfig:         FlowrConfigOptions;
    serializedAST:       SerializedNormalizedAst<OtherInfo>;
    controlDependencies: ControlDependency[] | undefined;
    referenceChain:      (string | undefined)[];
    ctx: SerializedFlowrAnalyzerContext;
}

export interface DataflowProcessorInformation<OtherInfo> {
	readonly parser:              Parser<KnownParserType>
    /**
     * Initial and frozen ast-information
     */
	readonly completeAst:         NormalizedAst<OtherInfo>
	/**
	 * Correctly contains pushed local scopes introduced by `function` scopes.
	 * Will by default *not* contain any symbol-bindings introduced along the way; they have to be decorated when moving up the tree.
	 */
	readonly environment:         REnvironmentInformation
	/**
	 * Other processors to be called by the given functions
	 */
	readonly processors:          DataflowProcessors<OtherInfo>
	/**
	 * The chain of file paths that lead to this inclusion.
	 * The most recent (last) entry is expected to always be the current one.
	 */
	readonly referenceChain:      (string | undefined)[]
	/**
	 * The chain of control-flow {@link NodeId}s that lead to the current node (e.g., of known ifs).
	 */
	readonly controlDependencies: ControlDependency[] | undefined
	/**
	 * The flowr context used for environment seeding, files, and precision control, ...
	 */
	readonly ctx:                 FlowrAnalyzerContext
}

export function SerializeDataflowProcessorInformation<OtherInfo>(
    dfInfo: DataflowProcessorInformation<OtherInfo>
) : SerializedDataflowProcessorInformation<OtherInfo>
{
    return {
        serializedAST: SerializeNormalizedAst<OtherInfo>(dfInfo.completeAst),
        controlDependencies: dfInfo.controlDependencies,
        referenceChain: dfInfo.referenceChain,
        ctx: dfInfo.ctx.toSerializable(),
    }
}

export function DeserializeDataflowProcessorInformation<OtherInfo>(
    serializedDfInfo: SerializedDataflowProcessorInformation<OtherInfo>,
    processors: DataflowProcessors<OtherInfo>,
    parser: Parser<KnownParserType>
): DataflowProcessorInformation<OtherInfo>
{
    const ctx = FlowrAnalyzerContext.fromSerializable(serializedDfInfo.ctx);

    return {
        parser,
        completeAst: DeserializeNormalizedAst(serializedDfInfo.serializedAST),
        environment: ctx.env.makeCleanEnv(),
        processors,
        referenceChain: serializedDfInfo.referenceChain,
        controlDependencies: serializedDfInfo.controlDependencies,
        ctx
    }
}

export type DataflowProcessor<OtherInfo, NodeType extends RNodeWithParent<OtherInfo>> = (node: NodeType, data: DataflowProcessorInformation<OtherInfo>) => DataflowInformation

type NodeWithKey<OtherInfo, Key> = RNode<OtherInfo & ParentInformation> & { type: Key }

/**
 * This way, a processor mapped to a {@link RType#Symbol} require a {@link RSymbol} as first parameter and so on.
 */
export type DataflowProcessors<OtherInfo> = {
	[key in RNode['type']]: DataflowProcessor<OtherInfo, NodeWithKey<OtherInfo, key>>
}

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
