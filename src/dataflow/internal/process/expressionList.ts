/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import { DataflowInformation, initializeCleanInfo } from '../info'
import { RExpressionList } from '../../../r-bridge'
import { DataflowProcessorDown } from '../../processor'
import { IdentifierReference, initializeCleanEnvironments, overwriteEnvironments, resolve } from '../environments'
import { guard } from '../../../util/assert'
import { linkReadVariablesInSameScopeWithNames } from '../linker'
import { DefaultMap } from '../../../util/defaultmap'


export function processExpressionList<OtherInfo>(exprList: RExpressionList<OtherInfo>, expressions: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  if(expressions.length === 0) {
    return initializeCleanInfo(down.ast, down.scope)
  }

  let environments = initializeCleanEnvironments()
  const remainingRead = new Map<string, IdentifierReference[]>()


  // TODO: this is probably wrong
  const nextGraph = expressions[0].graph.mergeWith(...expressions.slice(1).map(c => c.graph))

  for (const expression of expressions) {
    const currentElement: DataflowInformation<OtherInfo> = expression

    // all inputs that have not been written until know, are read!
    for (const read of [...currentElement.in, ...currentElement.activeNodes]) {
      const readName = read.name

      const probableTarget = resolve(readName, down.scope, environments)
      if (probableTarget === undefined) {
        // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
        if(remainingRead.has(readName)) {
          remainingRead.get(readName)?.push(read)
        } else {
          remainingRead.set(readName, [read])
        }
      } else if (probableTarget.length === 1) {
        nextGraph.addEdge(read, probableTarget[0], 'read')
      } else {
        for (const target of probableTarget) {
          // we can stick with maybe even if readId.attribute is always
          nextGraph.addEdge(read, target, 'read')
        }
      }
    }
    // add same variable reads for deferred if they are read previously but not dependent
    // TODO: deal with globals etc.
    for (const writeTarget of currentElement.out) {
      // TODO ? const writeTargetIds = writeTarget.attribute === 'always' ? [writeTarget.id] : writeTarget.ids
      const writeId = writeTarget.nodeId
      const existingRef = down.ast.idMap.get(writeId)
      const writeName = existingRef?.lexeme
      guard(writeName !== undefined, `Could not find name for write variable ${writeId}`)
      if (remainingRead.has(writeName)) {
        const readIds = remainingRead.get(writeName)
        guard(readIds !== undefined, `Could not find readId for write variable ${writeId}`)
        for (const read of readIds) {
          // TODO: is this really correct with write and read roles inverted?
          nextGraph.addEdge(writeTarget, read, 'defined-by')
        }
      } else {
        const resolved = resolve(writeName, down.scope, environments)
        if (resolved) { // write-write
          const writePointers = resolved
          if (writePointers.length === 1) {
            nextGraph.addEdge(writePointers[0], writeTarget, 'same-def-def')
          } else {
            for (const target of writePointers) {
              nextGraph.addEdge(target, writeTarget, 'same-def-def')
            }
          }
        }
      }
    }

    // update the environments for the next iteration with the previous writes
    environments = overwriteEnvironments(environments, expression.environments)
  }
  // now, we have to link same reads

  linkReadVariablesInSameScopeWithNames(nextGraph, new DefaultMap(() => [], remainingRead))

  return {
    // TODO: ensure active killed on that level?
    activeNodes: expressions.flatMap(child => child.activeNodes),
    in:          [...remainingRead.values()].flatMap(i => i),
    out:         expressions.flatMap(child => [...child.out]),
    ast:         down.ast,
    environments,
    scope:       down.scope,
    graph:       nextGraph
  }
}
