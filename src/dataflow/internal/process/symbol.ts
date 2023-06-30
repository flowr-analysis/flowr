import { ParentInformation, RNa, RNull, RSymbol } from '../../../r-bridge'
import { DataflowGraph } from '../../graph'
import { DataflowInformation, initializeCleanInfo } from '../info'
import { DataflowProcessorInformation } from '../../processor'

export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: are there other built-ins?
  if (symbol.content === RNull || symbol.content === RNa) {
    return initializeCleanInfo(data)
  }

  return {
    ast:          data.completeAst,
    activeNodes:  [ { nodeId: symbol.info.id, scope: data.activeScope, name: symbol.content, used: data.when } ],
    in:           [],
    out:          [],
    environments: data.environments,
    scope:        data.activeScope,
    graph:        new DataflowGraph().addNode({ tag: 'use', id: symbol.info.id, name: symbol.content, environment: data.environments, when: data.when })
  }
}
