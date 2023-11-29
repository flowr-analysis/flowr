import { DataflowGraph } from '../graph'
import { REnvironmentInformation, IdentifierReference, DataflowScopeName } from '../../common/environments'
import { DataflowProcessorInformation } from '../processor'

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
	/** The current scope during the fold */
	scope:             DataflowScopeName
	/** Current environments used for name resolution, probably updated on the next expression-list processing */
	environments:      REnvironmentInformation
	/** The current constructed dataflow graph */
	graph:             DataflowGraph
}

export function initializeCleanDataflowInformation<T>(data: Pick<DataflowProcessorInformation<T>, 'activeScope' | 'environments'>): DataflowInformation {
	return {
		unknownReferences: [],
		in:                [],
		out:               [],
		scope:             data.activeScope,
		environments:      data.environments,
		graph:             new DataflowGraph()
	}
}
