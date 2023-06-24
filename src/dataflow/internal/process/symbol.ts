import { ParentInformation, RNa, RNull, RSymbol } from '../../../r-bridge'
import { DataflowGraph } from '../../graph'
import { DataflowInformation, initializeCleanInfo } from '../info'
import { DataflowProcessorInformation } from '../../processor'

export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, down: DataflowProcessorInformation<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: are there other built-ins?
  if (symbol.content === RNull || symbol.content === RNa) {
    return initializeCleanInfo(down)
  }

  return {
    ast:          down.completeAst,
    activeNodes:  [ { nodeId: symbol.info.id, scope: down.activeScope, name: symbol.content, used: 'always' } ],
    in:           [],
    out:          [],
    environments: down.environments,
    scope:        down.activeScope,
    graph:        new DataflowGraph().addNode({ tag: 'use', id: symbol.info.id, name: symbol.content, environment: down.environments })
  }
}
