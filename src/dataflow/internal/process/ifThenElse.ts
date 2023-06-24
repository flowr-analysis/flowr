import { DataflowInformation } from '../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import { appendEnvironments, IdentifierReference, makeAllMaybe } from '../../environments'
import { linkIngoingVariablesInSameScope } from '../linker'
import { ParentInformation, RIfThenElse } from '../../../r-bridge'

export function processIfThenElse<OtherInfo>(ifThen: RIfThenElse<OtherInfo & ParentInformation>, down: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const cond = processDataflowFor(ifThen.condition, down)
  const then = processDataflowFor(ifThen.then, down)
  const otherwise = ifThen.otherwise === undefined ? undefined : processDataflowFor(ifThen.otherwise, down)

  const nextGraph = cond.graph.mergeWith(then.graph, otherwise?.graph)

  // TODO: allow to also attribute in-put with maybe and always
  // again within an if-then-else we consider all actives to be read
  // TODO: makeFoldReadTargetsMaybe(
  const ingoing: IdentifierReference[] = [...cond.in, ...makeAllMaybe(then.in, nextGraph),
    ...makeAllMaybe(otherwise?.in, nextGraph),
    ...cond.activeNodes,
    ...makeAllMaybe(then.activeNodes, nextGraph),
    ...makeAllMaybe(otherwise?.activeNodes, nextGraph)
  ]

  // we assign all with a maybe marker
  // we do not merge even if they appear in both branches because the maybe links will refer to different ids
  const outgoing = [...cond.out, ...makeAllMaybe(then.out, nextGraph), ...makeAllMaybe(otherwise?.out, nextGraph)]

  linkIngoingVariablesInSameScope(nextGraph, ingoing)
  // TODO: join def-def?

  const thenEnvironment = appendEnvironments(cond.environments, then.environments)
  const otherwiseEnvironment = otherwise ? appendEnvironments(thenEnvironment, otherwise.environments) : thenEnvironment
  return {
    activeNodes:  [],
    in:           ingoing,
    out:          outgoing,
    environments: otherwiseEnvironment,
    graph:        nextGraph,
    ast:          down.completeAst,
    scope:        down.activeScope,
  }
}
