import { ParentInformation, RNa, RNull, RSymbol } from '../../../r-bridge'
import { DataflowGraph } from '../../graph'
import { DataflowInfo, initializeCleanInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'

export function processSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  // TODO: are there other built-ins?
  if (symbol.content === RNull || symbol.content === RNa) {
    return initializeCleanInfo(down.ast, down.scope)
  }

  return {
    ast:          down.ast,
    activeNodes:  [ { nodeId: symbol.info.id, scope: down.scope, name: symbol.content } ],
    in:           [],
    out:          [],
    currentScope: down.scope,
    currentGraph: new DataflowGraph().addNode(symbol.info.id , symbol.content),
  }
}
