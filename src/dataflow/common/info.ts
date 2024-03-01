import { DataflowGraph } from './graph'
import type { REnvironmentInformation, IdentifierReference } from './environments'
import type { DataflowProcessorInformation } from '../v1/processor'

/**
 * Continuously updated during the dataflow analysis to hold the current state.
 */
export interface DataflowInformation {
	/** Nodes that have not been identified as read or write and will be so on higher */
	unknownReferences: IdentifierReference[]
	/** Nodes which are read */
	in:                IdentifierReference[]
	/** Nodes which are written to */
	out:               IdentifierReference[]
	/** Current environments used for name resolution, probably updated on the next expression-list processing */
	environments:      REnvironmentInformation
	/** The current constructed dataflow graph */
	graph:             DataflowGraph
}

export function initializeCleanDataflowInformation<T>(data: Pick<DataflowProcessorInformation<T>, 'environments'>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [],
		out:               [],
		environments:      data.environments,
		graph:             new DataflowGraph()
	}
}
