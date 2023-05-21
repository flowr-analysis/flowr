/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import { DataflowInformation, initializeCleanInfo } from '../info'
import { RExpressionList } from '../../../r-bridge'
import { DataflowProcessorDown } from '../../processor'
import {
  IdentifierReference,
  overwriteEnvironments,
  REnvironmentInformation,
  resolveByName
} from '../../environments'
import { linkReadVariablesInSameScopeWithNames } from '../linker'
import { DefaultMap } from '../../../util/defaultmap'
import { DataflowGraph } from '../../graph'
import { dataflowLogger } from '../../index'


function linkReadNameToWriteIfPossible<OtherInfo>(read: IdentifierReference, down: DataflowProcessorDown<OtherInfo>, environments: REnvironmentInformation, remainingRead: Map<string, IdentifierReference[]>, nextGraph: DataflowGraph) {
  const readName = read.name

  const probableTarget = resolveByName(readName, down.activeScope, environments)

  if (probableTarget === undefined) {
    // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
    if (remainingRead.has(readName)) {
      remainingRead.get(readName)?.push(read)
    } else {
      remainingRead.set(readName, [read])
    }
  } else if (probableTarget.length === 1) {
    nextGraph.addEdge(read, probableTarget[0], 'read', undefined, true)
  } else {
    for (const target of probableTarget) {
      // we can stick with maybe even if readId.attribute is always
      nextGraph.addEdge(read, target, 'read', undefined, true)
    }
  }
}


function processNextExpression<OtherInfo>(currentElement: DataflowInformation<OtherInfo>,
                                          down: DataflowProcessorDown<OtherInfo>,
                                          environments: REnvironmentInformation,
                                          remainingRead: Map<string, IdentifierReference[]>,
                                          nextGraph: DataflowGraph) {
  // all inputs that have not been written until know, are read!
  for (const read of [...currentElement.in, ...currentElement.activeNodes]) {
    linkReadNameToWriteIfPossible(read, down, environments, remainingRead, nextGraph)
  }
  // add same variable reads for deferred if they are read previously but not dependent
  for (const writeTarget of currentElement.out) {
    const writeName = writeTarget.name

    // TODO: must something happen to the remaining reads?

    const resolved = resolveByName(writeName, down.activeScope, environments)
    if (resolved !== undefined) {
      // write-write
      for (const target of resolved) {
        nextGraph.addEdge(target, writeTarget, 'same-def-def', undefined, true)
      }
    }
  }
}

export function processExpressionList<OtherInfo>(exprList: RExpressionList<OtherInfo>, expressions: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  dataflowLogger.trace(`processing expression list with ${expressions.length} expressions`)
  if(expressions.length === 0) {
    return initializeCleanInfo(down)
  }

  let environments = down.environments
  const remainingRead = new Map<string, IdentifierReference[]>()

  // TODO: this is probably wrong
  const nextGraph = expressions[0].graph.mergeWith(...expressions.slice(1).map(c => c.graph))

  let expressionCounter = 0
  for (const expression of expressions) {
    dataflowLogger.trace(`processing expression ${++expressionCounter} of ${expressions.length}`)
    processNextExpression(expression, down, environments, remainingRead, nextGraph)

    // update the environments for the next iteration with the previous writes
    environments = overwriteEnvironments(environments, expression.environments)
  }
  // now, we have to link same reads
  linkReadVariablesInSameScopeWithNames(nextGraph, new DefaultMap(() => [], remainingRead))

  dataflowLogger.trace(`expression list exits with ${remainingRead.size} remaining read names`)

  return {
    /* no active nodes remain, they are consumed within the remaining read collection */
    activeNodes: [],
    in:          [...remainingRead.values()].flatMap(i => i),
    out:         expressions.flatMap(child => [...child.out]),
    ast:         down.ast,
    environments,
    scope:       down.activeScope,
    graph:       nextGraph
  }
}
