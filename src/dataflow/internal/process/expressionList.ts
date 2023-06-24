/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import { DataflowInformation, initializeCleanInfo } from '../info'
import { ParentInformation, RExpressionList } from '../../../r-bridge'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import {
  IdentifierReference, initializeCleanEnvironments,
  overwriteEnvironments,
  REnvironmentInformation,
  resolveByName
} from '../../environments'
import { linkReadVariablesInSameScopeWithNames } from '../linker'
import { DefaultMap } from '../../../util/defaultmap'
import { DataflowGraph } from '../../graph'
import { dataflowLogger } from '../../index'


function linkReadNameToWriteIfPossible<OtherInfo>(read: IdentifierReference, data: DataflowProcessorInformation<OtherInfo>, environments: REnvironmentInformation, listEnvironments: REnvironmentInformation, remainingRead: Map<string, IdentifierReference[]>, nextGraph: DataflowGraph) {
  const readName = read.name

  const localTarget = resolveByName(readName, data.activeScope, listEnvironments)
  if(localTarget === undefined) {
    if (remainingRead.has(readName)) {
      remainingRead.get(readName)?.push(read)
    } else {
      remainingRead.set(readName, [read])
    }
  }

  const probableTarget = resolveByName(readName, data.activeScope, environments)

  // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
  // we keep them if they are defined outside the current parent and maybe throw them away later
  if (probableTarget === undefined) {
    return
  }


  if (probableTarget.length === 1) {
    nextGraph.addEdge(read, probableTarget[0], 'read', undefined, true)
  } else {
    for (const target of probableTarget) {
      // we can stick with maybe even if readId.attribute is always
      nextGraph.addEdge(read, target, 'read', undefined, true)
    }
  }
}


function processNextExpression<OtherInfo>(currentElement: DataflowInformation<OtherInfo>,
                                          down: DataflowProcessorInformation<OtherInfo>,
                                          environments: REnvironmentInformation,
                                          listEnvironments: REnvironmentInformation,
                                          remainingRead: Map<string, IdentifierReference[]>,
                                          nextGraph: DataflowGraph) {
  // all inputs that have not been written until know, are read!
  for (const read of [...currentElement.in, ...currentElement.activeNodes]) {
    linkReadNameToWriteIfPossible(read, down, environments, listEnvironments, remainingRead, nextGraph)
  }
  // add same variable reads for deferred if they are read previously but not dependent
  for (const writeTarget of currentElement.out) {
    const writeName = writeTarget.name

    // TODO: must something happen to the remaining reads?

    const resolved = resolveByName(writeName, down.activeScope, environments)
    if (resolved !== undefined) {
      // write-write
      for (const target of resolved) {
        if(nextGraph.hasNode(target.nodeId)) {
          nextGraph.addEdge(target, writeTarget, 'same-def-def', undefined, true)
        } else {
          // TODO: remove
          dataflowLogger.trace(`delay same-def-def edge because target ${JSON.stringify(target)} is not yet in graph (potentially an argument)`)
        }
      }
    }
  }
}

export function processExpressionList<OtherInfo>(exprList: RExpressionList<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const expressions = exprList.children
  dataflowLogger.trace(`processing expression list with ${expressions.length} expressions`)
  if(expressions.length === 0) {
    return initializeCleanInfo(data)
  }

  let environments = data.environments
  // used to detect if a "write" happens within the same expression list
  let listEnvironments = initializeCleanEnvironments()

  const remainingRead = new Map<string, IdentifierReference[]>()

  const nextGraph = new DataflowGraph()
  const out = []

  let expressionCounter = 0
  for (const expression of expressions) {
    dataflowLogger.trace(`processing expression ${++expressionCounter} of ${expressions.length}`)
    // use the current environments for processing
    data = { ...data, environments }
    const processed = processDataflowFor(expression, data)
    nextGraph.mergeWith(processed.graph)
    out.push(...processed.out)

    dataflowLogger.trace(`expression ${expressionCounter} of ${expressions.length} has ${processed.activeNodes.length} active nodes`)


    processNextExpression(processed, data, environments, listEnvironments, remainingRead, nextGraph)
    // update the environments for the next iteration with the previous writes
    environments = overwriteEnvironments(environments, processed.environments)
    listEnvironments = overwriteEnvironments(listEnvironments, processed.environments)
  }
  // now, we have to link same reads
  linkReadVariablesInSameScopeWithNames(nextGraph, new DefaultMap(() => [], remainingRead))

  dataflowLogger.trace(`expression list exits with ${remainingRead.size} remaining read names`)

  return {
    /* no active nodes remain, they are consumed within the remaining read collection */
    activeNodes: [],
    in:          [...remainingRead.values()].flat(),
    out,
    ast:         data.completeAst,
    environments,
    scope:       data.activeScope,
    graph:       nextGraph
  }
}
