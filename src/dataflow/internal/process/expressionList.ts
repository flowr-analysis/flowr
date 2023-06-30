/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import { DataflowInformation, initializeCleanInfo } from '../info'
import { NodeId, ParentInformation, RExpressionList } from '../../../r-bridge'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import {
  IdentifierReference, IEnvironment,
  overwriteEnvironments, popLocalEnvironment,
  REnvironmentInformation,
  resolveByName
} from '../../environments'
import { linkFunctionCallExitPointsAndCalls, linkReadVariablesInSameScopeWithNames } from '../linker'
import { DefaultMap } from '../../../util/defaultmap'
import { DataflowGraph } from '../../graph'
import { dataflowLogger } from '../../index'
import { guard } from '../../../util/assert'


function linkReadNameToWriteIfPossible<OtherInfo>(read: IdentifierReference, data: DataflowProcessorInformation<OtherInfo>, environments: REnvironmentInformation, listEnvironments: Set<NodeId>, remainingRead: Map<string, IdentifierReference[]>, nextGraph: DataflowGraph) {
  const readName = read.name

  const probableTarget = resolveByName(readName, data.activeScope, environments)

  // record if at least one has not been defined
  if(probableTarget === undefined || probableTarget.some(t => !listEnvironments.has(t.nodeId))) {
    if (remainingRead.has(readName)) {
      remainingRead.get(readName)?.push(read)
    } else {
      remainingRead.set(readName, [read])
    }
  }

  // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
  // we keep them if they are defined outside the current parent and maybe throw them away later
  if (probableTarget === undefined) {
    return
  }

  for (const target of probableTarget) {
    // we can stick with maybe even if readId.attribute is always
    nextGraph.addEdge(read, target, 'read', undefined, true)
  }
}


function processNextExpression<OtherInfo>(currentElement: DataflowInformation<OtherInfo>,
                                          down: DataflowProcessorInformation<OtherInfo>,
                                          environments: REnvironmentInformation,
                                          listEnvironments: Set<NodeId>,
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
        nextGraph.addEdge(target, writeTarget, 'same-def-def', undefined, true)
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
  const listEnvironments: Set<NodeId> = new Set<NodeId>()

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
    const functionCallIds = [...processed.graph.nodes(true)]
      .filter(([_,info]) => info.tag === 'function-call')
    const calledEnvs = linkFunctionCallExitPointsAndCalls(nextGraph, functionCallIds, processed.graph)

    // update the environments for the next iteration with the previous writes
    environments = overwriteEnvironments(environments, processed.environments)

    // if the called function has global redefinitions, we have to keep them within our environment
    for(const { functionCall, called } of calledEnvs) {
      for(const calledFn of called) {
        guard(calledFn.tag === 'function-definition', 'called function must call a function definition')
        // only merge the environments they have in common
        let environment = calledFn.environment
        while (environment.level > environments.level) {
          environment = popLocalEnvironment(environment)
        }
        // update alle definitions to be defined at this function call
        let current: IEnvironment | undefined = environment.current
        while(current !== undefined) {
          for(const definitions of current.memory.values()) {
            for(const def of definitions) {
              def.definedAt = functionCall
              nextGraph.addEdge(def.nodeId, functionCall, 'defined-by-on-call', def.used)
            }
          }
          current = current.parent
        }
        // we update all definitions to be linked with teh corresponding function call
        environments = overwriteEnvironments(environments, environment)
      }
    }

    for(const { nodeId } of processed.out) {
      listEnvironments.add(nodeId)
    }
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
