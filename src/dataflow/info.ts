import { DataflowGraph } from './graph'
import type { REnvironmentInformation, IdentifierReference } from './environments'
import type { DataflowProcessorInformation } from './processor'

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

	/** Current environments used for name resolution, probably updated on the next expression-list processing */
	environment: REnvironmentInformation
	/** The current constructed dataflow graph */
	graph:       DataflowGraph
}

export function initializeCleanDataflowInformation<T>(data: Pick<DataflowProcessorInformation<T>, 'environment'>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph()
	}
}
