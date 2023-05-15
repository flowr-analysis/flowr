import { linkIngoingVariablesInSameScope, produceNameSharedIdMap, setDefinitionOfNode } from '../linker'
import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'

export function processForLoop<OtherInfo>(loop: unknown, variable: DataflowInfo<OtherInfo>,
                                          vector: DataflowInfo<OtherInfo>, body: DataflowInfo<OtherInfo>,
                                          down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {

  // TODO: allow to also attribute in-put with maybe and always
  // again within an if-then-else we consider all actives to be read
  // TODO: deal with ...variable.in it is not really ingoing in the sense of bindings i against it, but it should be for the for-loop
  // currently i add it at the end, but is this correct?
  const ingoing = [...vector.in, ...body.in, ...vector.activeNodes, ...body.activeNodes]

  // we assign all with a maybe marker

  // TODO: use attribute?
  const writtenVariable = variable.activeNodes
  const nextGraph = variable.currentGraph.mergeWith(vector.currentGraph, body.currentGraph)

  // TODO: hold name when reading to avoid constant indirection?
  // now we have to bind all open reads with the given name to the locally defined writtenVariable!
  // TODO: assert target name? (should be the correct way to do)
  const nameIdShares = produceNameSharedIdMap(ingoing)

  for(const write of writtenVariable) {
    // TODO?: const ids = target.attribute === 'always' ? [target.id] : target.ids
    // define it in term of all vector.in and vector.activeNodes
    // TODO: do not re-join every time!
    for(const link of [...vector.in, ...vector.activeNodes]) {
      nextGraph.addEdge(write.nodeId, link.nodeId, 'defined-by', /* TODO */ 'always')
    }

    const name = write.name
    const readIdsToLink = nameIdShares.get(name)
    for(const readId of readIdsToLink) {
      nextGraph.addEdge(readId.nodeId, write.nodeId, 'defined-by', /* TODO */ 'always')
    }
    // now, we remove the name from the id shares as they are no longer needed
    nameIdShares.delete(name)
    setDefinitionOfNode(nextGraph, write, down.scope)
  }

  const outgoing = [...variable.out, ...writtenVariable, ...body.out]

  // TODO:
  /*for(const reference of body.out) {
     const existing = outgoing.get(scope)
    const existingIds = existing?.flatMap(t => t.attribute === 'always' ? [t.id] : t.ids) ?? []
    outgoing.set(scope, targets.map(t => {
      if(t.attribute === 'always') {
        // maybe due to loop which does not have to execute!
        return {attribute: 'maybe', ids: [t.id, ...existingIds]}
      } else {
        return t
      }
    }))
  }
   */

  // TODO: scoping?
  linkIngoingVariablesInSameScope(nextGraph, ingoing)

  return {
    activeNodes:  [],
    // we only want those not bound by a local variable
    in:           [...variable.in, ...[...nameIdShares.values()].flatMap(v => v)],
    out:          outgoing,
    currentGraph: nextGraph,
    ast:          down.ast,
    currentScope: down.scope
  }
}
