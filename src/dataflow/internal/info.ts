import { DataflowGraph, DataflowScopeName } from '../graph'
import { DecoratedAst } from '../../r-bridge'
import { REnvironmentInformation, IdentifierReference } from '../environments'
import { DataflowProcessorInformation } from '../processor'

/**
 * Continuously updated during the dataflow analysis to hold the current state.
 */
export interface DataflowInformation<OtherInfo> {
  readonly ast: DecoratedAst<OtherInfo>
  /** Nodes that have not been identified as read or write and will be so on higher */
  activeNodes:  IdentifierReference[]
  /** Nodes which are read */
  in:           IdentifierReference[]
  /** Nodes which are written to */
  out:          IdentifierReference[]
  /** The current scope during the fold */
  scope:        DataflowScopeName
  /** Current environments used for name resolution, probably updated on the next expression-list processing */
  environments: REnvironmentInformation
  /** The current constructed dataflow graph */
  graph:        DataflowGraph
}

export function initializeCleanInfo<OtherInfo>(down: DataflowProcessorInformation<OtherInfo>): DataflowInformation<OtherInfo> {
  return {
    ast:          down.completeAst,
    activeNodes:  [],
    in:           [],
    out:          [],
    scope:        down.activeScope,
    environments: down.environments,
    graph:        new DataflowGraph()
  }
}
