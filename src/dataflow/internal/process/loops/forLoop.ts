import {
  linkCircularRedefinitionsWithinALoop,
  linkIngoingVariablesInSameScope,
  produceNameSharedIdMap,
  setDefinitionOfNode
} from '../../linker'
import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { appendEnvironments, makeAllMaybe, overwriteEnvironments } from '../../../environments'
import { ParentInformation, RForLoop } from '../../../../r-bridge'

export function processForLoop<OtherInfo>(loop: RForLoop<OtherInfo & ParentInformation>,
                                          data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const variable = processDataflowFor(loop.variable, data)
  const vector = processDataflowFor(loop.vector, data)
  const body = processDataflowFor(loop.body, data)

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
  const headEnvironments = appendEnvironments(variable.environments, vector.environments)

  for(const [_, nodeInfo] of nextGraph.nodes()) {
    nodeInfo.environment = overwriteEnvironments(nodeInfo.environment, headEnvironments)
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
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
