import { DataflowGraph } from './graph'
import type { REnvironmentInformation, IdentifierReference } from './environments'
import type { DataflowProcessorInformation } from './processor'
import type { NodeId } from '../r-bridge'

export interface DataflowCfgInformation {
	/** all vertices that trigger an active 'return' in the current dataflow graph if not already part of the {@link exitPoints} */
	returns:           readonly NodeId[],
	/** all vertices that trigger an active 'break' in the current dataflow graph */
	breaks:            readonly NodeId[],
	/** all vertices that trigger an active 'next' in the current dataflow graph */
	nexts:             readonly NodeId[],
	/** entry node into the subgraph */
	entryPoint:        NodeId,
	/** all already identified exit points of the respective structure. */
	exitPoints:        readonly NodeId[]
}

/**
 * Continuously updated during the dataflow analysis to hold the current state.
 */
export interface DataflowInformation {
	/** References that have not been identified as read or write and will be so on higher */
	unknownReferences: readonly IdentifierReference[]
	/** References which are read */
	in:                readonly IdentifierReference[]
	/** References which are written to */
	out:               readonly IdentifierReference[]
	/** Control flow information, populated during the dataflow analysis */
	cfg:               DataflowCfgInformation
	/** Current environments used for name resolution, probably updated on the next expression-list processing */
	environment:       REnvironmentInformation
	/** The current constructed dataflow graph */
	graph:             DataflowGraph
}

export function initializeCleanDataflowInformation<T>(entryPoint: NodeId, data: Pick<DataflowProcessorInformation<T>, 'environment'>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [],
		out:               [],
		cfg:               {
			returns: [],
			breaks: [],
			nexts: [],
			entryPoint,
			exitPoints: [entryPoint]
		},
		environment:       data.environment,
		graph:             new DataflowGraph()
	}
}
