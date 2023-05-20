import { ParentInformation, RAssignmentOp, RNode } from '../../../r-bridge'
import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { GlobalScope, LocalScope } from '../../graph'
import { guard } from '../../../util/assert'
import {
  define,
  IdentifierDefinition,
  IdentifierReference,
  initializeCleanEnvironments,
  overwriteEnvironments
} from '../../environments'
import { setDefinitionOfNode } from '../linker'
import { log } from '../../../util/log'

export function processAssignment<OtherInfo>(op: RAssignmentOp<OtherInfo & ParentInformation>,
                                             lhs: DataflowInformation<OtherInfo>, rhs: DataflowInformation<OtherInfo>,
                                             down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  const { readTargets, writeTargets, environments } = processReadAndWriteForAssignmentBasedOnOp(op, lhs, rhs, down)
  const nextGraph = lhs.graph.mergeWith(rhs.graph)

  for (const write of writeTargets) {
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

function identifySourceAndTarget<OtherInfo>(op: RNode<OtherInfo & ParentInformation>, lhs: DataflowInformation<OtherInfo>, rhs: DataflowInformation<OtherInfo>) {
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
    case '=': // TODO: special within function calls
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
  return { source, target, global }
}

function produceWrittenNodes<OtherInfo>(op: RAssignmentOp<OtherInfo & ParentInformation>, target: DataflowInformation<OtherInfo>, global: boolean, down: DataflowProcessorDown<OtherInfo>): IdentifierDefinition[] {
  const writeNodes: IdentifierDefinition[] = []
  for(const active of target.activeNodes) {
    writeNodes.push({
      ...active,
      scope:     global ? GlobalScope : down.scope,
      kind:      /* TODO: deal with functions */ 'variable',
      definedAt: op.info.id
    })
  }
  return writeNodes
}

function processReadAndWriteForAssignmentBasedOnOp<OtherInfo>(op: RAssignmentOp<OtherInfo & ParentInformation>,
                                                              lhs: DataflowInformation<OtherInfo>, rhs: DataflowInformation<OtherInfo>,
                                                              down: DataflowProcessorDown<OtherInfo>) {
  // what is written/read additionally is based on lhs/rhs - assignments read written variables as well
  const read = [...lhs.in, ...rhs.in]
  const { source, target, global } = identifySourceAndTarget(op, lhs, rhs)
  const writeNodes = produceWrittenNodes(op, target, global, down)

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
    define(write, global ? GlobalScope: LocalScope, environments)
  }

  return {
    readTargets:  [...source.activeNodes, ...read, ...readFromSourceWritten],
    writeTargets: [...writeNodes, ...target.out],
    environments: environments
  }
}
