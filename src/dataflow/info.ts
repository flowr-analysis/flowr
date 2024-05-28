import type { DataflowProcessorInformation } from './processor'
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id'
import type { IdentifierReference } from './environments/identifier'
import type { REnvironmentInformation } from './environments/environment'
import { DataflowGraph } from './graph/graph'

export const enum ExitPointType {
	Default = 0,
	Return = 1,
	Break = 2,
	Next = 3
}

export interface ExitPoint {
	readonly type:                ExitPointType,
	readonly nodeId:              NodeId,
	readonly controlDependencies: NodeId[] | undefined
}

export function addNonDefaultExitPoints(existing: ExitPoint[], add: readonly ExitPoint[]): void {
	existing.push(...add.filter(({ type }) => type !== ExitPointType.Default))
}

/**
 * The control flow information for the current {@link DataflowInformation}.
 */
export interface DataflowCfgInformation {
	/**
	 * The entry node into the subgraph
	 */
	entryPoint: NodeId,
	/**
	 * All already identified exit points (active 'return'/'break'/'next'-likes) of the respective structure.
	 */
	exitPoints: readonly ExitPoint[]
}

/**
 * The dataflow information is continuously updated during the dataflow analysis
 * and holds its current state for the respective subtree processed.
 */
export interface DataflowInformation extends DataflowCfgInformation {
	/** References that have not been identified as read or write and will be so on higher */
	unknownReferences: readonly IdentifierReference[]
	/** References which are read */
	in:                readonly IdentifierReference[]
	/** References which are written to */
	out:               readonly IdentifierReference[]
	/** Current environments used for name resolution, probably updated on the next expression-list processing */
	environment:       REnvironmentInformation
	/** The current constructed dataflow graph */
	graph:             DataflowGraph
}

export function initializeCleanDataflowInformation<T>(entryPoint: NodeId, data: Pick<DataflowProcessorInformation<T>, 'environment' | 'completeAst'>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap),
		entryPoint,
		exitPoints:        [{ nodeId: entryPoint, type: ExitPointType.Default, controlDependencies: undefined }]
	}
}

export function alwaysExits(data: DataflowInformation): boolean {
	return data.exitPoints?.some(e => e.type !== ExitPointType.Default &&  e.controlDependencies === undefined) ?? false
}

export function filterOutLoopExitPoints(exitPoints: readonly ExitPoint[]): readonly ExitPoint[] {
	return exitPoints.filter(({ type }) => type === ExitPointType.Return || type === ExitPointType.Default)
}
