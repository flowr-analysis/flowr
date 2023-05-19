import { RNodeWithParent, Type } from '../../../r-bridge'
import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { GlobalScope, LocalScope } from '../../graph'
import { guard } from '../../../util/assert'
import { IdentifierReference } from '../environments'
import { setDefinitionOfNode } from '../linker'

export function processAssignment<OtherInfo>(op: RNodeWithParent<OtherInfo> & { type: Type.BinaryOp },
                                             lhs: DataflowInfo<OtherInfo>, rhs: DataflowInfo<OtherInfo>,
                                             down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  const { readTargets, writeTargets } = identifyReadAndWriteForAssignmentBasedOnOp(op, lhs, rhs, down)
  const nextGraph = lhs.graph.mergeWith(rhs.graph)

  for (const write of writeTargets) {
    // TODO: special treatment? const ids = t.attribute === 'always' ? [t.id] : t.ids
    setDefinitionOfNode(nextGraph, write)
    for(const read of readTargets) {
      nextGraph.addEdge(write.nodeId, read.nodeId, 'defined-by', /* TODO: */ 'always')
    }
  }
  return {
    activeNodes: [],
    in:          readTargets,
    out:         writeTargets,
    graph:       nextGraph,
    ast:         down.ast,
    scope:       down.scope
  }
}

function identifyReadAndWriteForAssignmentBasedOnOp<OtherInfo>(op: RNodeWithParent<OtherInfo>,
                                                               lhs: DataflowInfo<OtherInfo>, rhs: DataflowInfo<OtherInfo>,
                                                               down: DataflowProcessorDown<OtherInfo>) {
  // what is written/read additionally is based on lhs/rhs - assignments read written variables as well
  const read = [...lhs.in, ...rhs.in]

  let source
  let target
  let global = false

  switch (op.lexeme) {
    case '<-':
      [target, source] = [lhs, rhs]
      break
    case '<<-':
      [target, source, global] = [lhs, rhs, true]
      break
    case '=': // TODO: special
      [target, source] = [lhs, rhs]
      break
    case '->':
      [target, source] = [rhs, lhs]
      break
    case '->>':
      [target, source, global] = [rhs, lhs, true]
      break
    default:
      throw new Error(`Unknown assignment operator ${JSON.stringify(op)}`)
  }
  const writeNodes: IdentifierReference[] =
    [...target.activeNodes].map(id => ({
      ...id,
      // TODO: is global lock correct or can this be rebound in assign etc?
      scope: global ? GlobalScope : down.scope
      // TODO: use id.attribute?
    }))
  const readFromSourceWritten: IdentifierReference[] = [...source.out].map(id => {
    guard(id.scope === LocalScope, 'currently, nested write re-assignments are only supported for local')
    return id
  })
  return {
    readTargets:  [...source.activeNodes, ...read, ...readFromSourceWritten],
    writeTargets: [...writeNodes, ...target.out]
  }
}
