/**
 * Processes a list of expressions joining their dataflow graphs accordingly.
 * @module
 */
import { DataflowInformation, initializeCleanInfo } from '../info'
import { RExpressionList } from '../../../r-bridge'
import { DataflowProcessorDown } from '../../processor'


export function processExpressionList<OtherInfo>(exprList: RExpressionList<OtherInfo>, expressions: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  if(expressions.length === 0) {
    return initializeCleanInfo(down.ast, down.scope)
  }
  /*
  // TODO: keep scope for writePointers
  const writePointers = new Map<string, IdentifierReference>() // maps name to write reference (used for quicker access)
  // TODO: if reads are unknown here, keep them for later
  const remainingRead = new Map<string, IdentifierReference>() // maps name to read reference (used for quicker access)

  // TODO: this is probably wrong
  const nextGraph = expressions[0].graph.mergeWith(...expressions.slice(1).map(c => c.graph))

  for (const expression of expressions) {
    const currentElement: DataflowInfo<OtherInfo> = expression

    // all inputs that have not been written until know, are read!
    for (const read of [...currentElement.in, ...currentElement.activeNodes]) {
      const readName = read.name

      const probableTarget = writePointers.get(readName)
      if (probableTarget === undefined) {
        // keep it, for we have no target, as read-ids are unique within same fold, this should work for same links
        if(remainingRead.has(readName)) {
          remainingRead.get(readName)?.push(read)
        } else {
          remainingRead.set(readName, [read])
        }
      } else if (probableTarget.type === 'always') {
        nextGraph.addEdge(read.id, probableTarget.id, 'read', read.attribute)
      } else {
        for (const target of probableTarget.ids) {
          // we can stick with maybe even if readId.attribute is always
          nextGraph.addEdge(read.id, target, 'read', 'maybe')
        }
      }
    }
    // add same variable reads for deferred if they are read previously but not dependent
    // TODO: deal with globals etc.
    for (const [, writeTargets] of currentElement.out) {
      for(const writeTarget of writeTargets) {
        const writeTargetIds = writeTarget.attribute === 'always' ? [writeTarget.id] : writeTarget.ids
        for (const writeId of writeTargetIds) {

          const existingRef = dataflowIdMap.get(writeId)
          const writeName = existingRef?.lexeme
          guard(writeName !== undefined, `Could not find name for write variable ${writeId}`)
          if (remainingRead.has(writeName)) {
            const readIds = remainingRead.get(writeName)
            guard(readIds !== undefined, `Could not find readId for write variable ${writeId}`)
            for (const readId of readIds) {
              // TODO: is this really correct with write and read roles inverted?
              nextGraph.addEdge(writeId, readId.id, 'defined-by', readId.attribute)
            }
          } else if (writePointers.has(writeName)) { // write-write
            const writePointer = writePointers.get(writeName)
            guard(writePointer !== undefined, `Could not find writePointer for write variable ${writeId}`)
            if (writePointer.type === 'always') {
              nextGraph.addEdge(writePointer.id, writeId, 'same-def-def', 'always')
            } else {
              for (const target of writePointer.ids) {
                nextGraph.addEdge(target, writeId, 'same-def-def', 'always')
              }
            }
          }
        }
      }
    }

    // for each variable read add the closest write and if we have one, remove it from read
    updateAllWriteTargets(currentElement, dataflowIdMap, writePointers)
  }
  // now, we have to link same reads

  linkReadVariablesInSameScopeWithNames(nextGraph, new DefaultMap(() => [], remainingRead))

  return {
    // TODO: ensure active killed on that level?
    activeNodes: expressions.flatMap(child => child.activeNodes),
    in:          [...remainingRead.values()].flatMap(i => i),
    out:         new Map(expressions.flatMap(child => [...child.out])),
    scope:       down.scope,
    graph:       nextGraph
  }
  */
  return initializeCleanInfo(down.ast, down.scope)
}
