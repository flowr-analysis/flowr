import { RNodeWithParent, Type } from '../../../r-bridge'
import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { GlobalScope, LocalScope } from '../../graph'
import { guard } from '../../../util/assert'
import { IdentifierReference, initializeCleanEnvironments, overwriteEnvironments } from '../environments'
import { setDefinitionOfNode } from '../linker'
import { log } from '../../../util/log'

export function processAssignment<OtherInfo>(op: RNodeWithParent<OtherInfo> & { type: Type.BinaryOp },
                                             lhs: DataflowInformation<OtherInfo>, rhs: DataflowInformation<OtherInfo>,
                                             down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  const { readTargets, writeTargets, environments } = identifyReadAndWriteForAssignmentBasedOnOp(op, lhs, rhs, down)
  const nextGraph = lhs.graph.mergeWith(rhs.graph)

  for (const write of writeTargets) {
    // TODO: special treatment? const ids = t.attribute === 'always' ? [t.id] : t.ids
    setDefinitionOfNode(nextGraph, write)
    for(const read of readTargets) {
      nextGraph.addEdge(write, read, 'defined-by')
    }
  }
  return {
    activeNodes: [],
    in:          readTargets,
    out:         writeTargets,
    graph:       nextGraph,
    environments,
    ast:         down.ast,
    scope:       down.scope
  }
}

function identifyReadAndWriteForAssignmentBasedOnOp<OtherInfo>(op: RNodeWithParent<OtherInfo>,
                                                               lhs: DataflowInformation<OtherInfo>, rhs: DataflowInformation<OtherInfo>,
                                                               down: DataflowProcessorDown<OtherInfo>) {
  // what is written/read additionally is based on lhs/rhs - assignments read written variables as well
  const read = [...lhs.in, ...rhs.in]

  let source: DataflowInformation<OtherInfo>
  let target: DataflowInformation<OtherInfo>
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

  if(writeNodes.length !== 1) {
    log.warn(`Unexpected write number in assignment ${JSON.stringify(op)}: ${JSON.stringify(writeNodes)}`)
  }


  const readFromSourceWritten: IdentifierReference[] = [...source.out].map(id => {
    guard(id.scope === LocalScope, 'currently, nested write re-assignments are only supported for local')
    return id
  })
  const environments = overwriteEnvironments(source.environments, target.environments) ?? initializeCleanEnvironments()

  // install assigned variables in environment
  for(const write of writeNodes) {
    if(global) { // globals set the local scope as well!
      environments.global.map.set(write.name, [write])
    }
    environments.local[0].map.set(write.name, [write])
  }

  return {
    readTargets:  [...source.activeNodes, ...read, ...readFromSourceWritten],
    writeTargets: [...writeNodes, ...target.out],
    environments: environments
  }
}
