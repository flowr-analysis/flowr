import {
  linkCircularRedefinitionsWithinALoop,
  linkIngoingVariablesInSameScope,
  produceNameSharedIdMap,
  setDefinitionOfNode
} from '../../linker'
import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { appendEnvironments, makeAllMaybe } from '../../../environments'

export function processForLoop<OtherInfo>(loop: unknown, variable: DataflowInformation<OtherInfo>,
                                          vector: DataflowInformation<OtherInfo>, body: DataflowInformation<OtherInfo>,
                                          down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {

  // again within an if-then-else we consider all actives to be read
  // TODO: deal with ...variable.in it is not really ingoing in the sense of bindings i against it, but it should be for the for-loop
  // currently i add it at the end, but is this correct?
  const ingoing = [...vector.in, ...makeAllMaybe(body.in), ...vector.activeNodes, ...makeAllMaybe(body.activeNodes)]

  // we assign all with a maybe marker

  // TODO: use attribute?
  const writtenVariable = variable.activeNodes
  const nextGraph = variable.graph.mergeWith(vector.graph, body.graph)

  // now we have to bind all open reads with the given name to the locally defined writtenVariable!
  const nameIdShares = produceNameSharedIdMap(ingoing)

  for(const write of writtenVariable) {
    // TODO: do not re-join every time!
    for(const link of [...vector.in, ...vector.activeNodes]) {
      nextGraph.addEdge(write.nodeId, link.nodeId, 'defined-by', /* TODO */ 'always', true)
    }

    const name = write.name
    const readIdsToLink = nameIdShares.get(name)
    for(const readId of readIdsToLink) {
      nextGraph.addEdge(readId.nodeId, write.nodeId, 'read', /* TODO */ 'always', true)
    }
    // now, we remove the name from the id shares as they are no longer needed
    nameIdShares.delete(name)
    setDefinitionOfNode(nextGraph, write)
  }

  const outgoing = [...variable.out, ...writtenVariable, ...body.out]
  makeAllMaybe(body.out)

  linkIngoingVariablesInSameScope(nextGraph, ingoing)

  linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out)

  return {
    activeNodes:  [],
    // we only want those not bound by a local variable
    in:           [...variable.in, ...[...nameIdShares.values()].flat()],
    out:          outgoing,
    graph:        nextGraph,
    environments: appendEnvironments(appendEnvironments(variable.environments, vector.environments), body.environments),
    ast:          down.ast,
    scope:        down.activeScope
  }
}
