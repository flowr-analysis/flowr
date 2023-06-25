import {
  linkCircularRedefinitionsWithinALoop,
  linkIngoingVariablesInSameScope,
  produceNameSharedIdMap
} from '../../linker'
import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { appendEnvironments, define, makeAllMaybe } from '../../../environments'
import { ParentInformation, RForLoop } from '../../../../r-bridge'
import { LocalScope } from '../../../graph'

export function processForLoop<OtherInfo>(loop: RForLoop<OtherInfo & ParentInformation>,
                                          data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const variable = processDataflowFor(loop.variable, data)
  const vector = processDataflowFor(loop.vector, data)
  let headEnvironments = appendEnvironments(variable.environments, vector.environments)
  const headGraph= variable.graph.mergeWith(vector.graph)
  // TODO: use attribute? TODO: use writes in vector?
  const writtenVariable = variable.activeNodes
  for(const write of writtenVariable) {
    headEnvironments = define({ ...write, used: 'always', definedAt: loop.info.id, kind: 'variable' }, LocalScope, headEnvironments)
  }
  data = { ...data, environments: headEnvironments }
  const body = processDataflowFor(loop.body, data)

  const nextGraph = headGraph.mergeWith(body.graph)

  // again within an if-then-else we consider all actives to be read
  // TODO: deal with ...variable.in it is not really ingoing in the sense of bindings i against it, but it should be for the for-loop
  // currently i add it at the end, but is this correct?
  const ingoing = [...vector.in, ...makeAllMaybe(body.in, nextGraph), ...vector.activeNodes, ...makeAllMaybe(body.activeNodes, nextGraph)]


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
    nextGraph.setDefinitionOfNode(write)
  }

  const outgoing = [...variable.out, ...writtenVariable, ...makeAllMaybe(body.out, nextGraph)]

  linkIngoingVariablesInSameScope(nextGraph, ingoing)

  linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out)

  return {
    activeNodes:  [],
    // we only want those not bound by a local variable
    in:           [...variable.in, ...[...nameIdShares.values()].flat()],
    out:          outgoing,
    graph:        nextGraph,
    environments: appendEnvironments(headEnvironments, body.environments),
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
