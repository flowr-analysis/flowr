import type { RProject } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { NormalizedAst, ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { IdentifierReference } from '../environments/identifier';
import type { DataflowGraphJson } from '../graph/graph';
import type { ControlDependency, DataflowInformation } from '../info';
import type { DataflowProcessorInformation } from '../processor';


export interface ClonableDataflowProcessorInformation {
    readonly normalizedAST:       ClonableNormalizedAST
    readonly environement:        ClonableREnvironemntInformation
    readonly referenceChain:      (string | undefined)[]
    readonly controlDependencies: ControlDependency[] | undefined
    //readonly ctx:                 FlowrAnalyzerContext
}

export interface ClonableDataflowInformation {
    unknownReferences: readonly IdentifierReference[]
    in:                readonly IdentifierReference[]
    out:               readonly IdentifierReference[]
    environment:       ClonableREnvironemntInformation
    graph:             DataflowGraphJson
}

export interface ClonableNormalizedAST<OtherInfo = ParentInformation, Node = RProject<OtherInfo & ParentInformation>>{
    idMap:     Map<NodeId, RNodeWithParent<OtherInfo>>
    ast:       Node
    hasError?: boolean
}

export interface ClonableREnvironemntInformation{
    readonly current: string
    readonly level:   number
}

/**
 *
 */
export function toClonableDataflowProcessorInfo<OtherInfo>(
	dfInfo: DataflowProcessorInformation<OtherInfo>
): ClonableDataflowProcessorInformation {
	return {
		normalizedAST:       toClonableNormalizedAST(dfInfo.completeAst),
		environement:        toClonableREnvironmentInfo(dfInfo.environment),
		referenceChain:      dfInfo.referenceChain,
		controlDependencies: dfInfo.controlDependencies,
		//ctx: undefined as unknown as FlowrAnalyzerContext,
	};
}

/**
 *
 */
export function toClonableDataflowInfo(
	df: DataflowInformation
): ClonableDataflowInformation {
	return {
		unknownReferences: df.unknownReferences,
		in:                df.in,
		out:               df.out,
		environment:       toClonableREnvironmentInfo(df.environment),
		graph:             df.graph.toJSON(),
	};
}

/**
 *
 */
export function toClonableNormalizedAST<OtherInfo = ParentInformation>(
	ast: NormalizedAst<OtherInfo>
): ClonableNormalizedAST {
	return {
		idMap:    new Map(ast.idMap.entries()),
		ast:      ast.ast,
		hasError: ast.hasError,
	};
}

/**
 *
 */
export function toClonableREnvironmentInfo(
	env: REnvironmentInformation
): ClonableREnvironemntInformation {
	return {
		current: JSON.stringify(env.current),
		level:   env.level,
	};
}