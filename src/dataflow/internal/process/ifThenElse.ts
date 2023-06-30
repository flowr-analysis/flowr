import { DataflowInformation } from '../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import { appendEnvironments, IdentifierReference } from '../../environments'
import { linkIngoingVariablesInSameScope } from '../linker'
import { ParentInformation, RIfThenElse } from '../../../r-bridge'

export function processIfThenElse<OtherInfo>(ifThen: RIfThenElse<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const cond = processDataflowFor(ifThen.condition, data)

  let then: DataflowInformation<OtherInfo> | undefined
  if(ifThen.condition.lexeme !== 'FALSE') {
    then = processDataflowFor(ifThen.then, ifThen.condition.lexeme === 'TRUE' ? data : { ...data, when: 'maybe' })
  }
  let otherwise: DataflowInformation<OtherInfo> | undefined
  if(ifThen.otherwise !== undefined && ifThen.condition.lexeme !== 'TRUE') {
    otherwise = processDataflowFor(ifThen.otherwise, ifThen.condition.lexeme === 'FALSE' ? data : { ...data, when: 'maybe' })
  }

  const nextGraph = cond.graph.mergeWith(then?.graph, otherwise?.graph)

  // TODO: allow to also attribute in-put with maybe and always
  // again within an if-then-else we consider all actives to be read
  // TODO: makeFoldReadTargetsMaybe(
  const ingoing: IdentifierReference[] = [...cond.in, ...(then?.in ?? []),
    ...(otherwise?.in ?? []),
    ...cond.activeNodes,
    ...(then?.activeNodes ?? []),
    ...(otherwise?.activeNodes ?? [])
  ]

  // we assign all with a maybe marker
  // we do not merge even if they appear in both branches because the maybe links will refer to different ids
  const outgoing = [...cond.out, ...(then?.out ?? []), ...(otherwise?.out ?? [])]

  linkIngoingVariablesInSameScope(nextGraph, ingoing)
  // TODO: join def-def?

  const thenEnvironment = appendEnvironments(cond.environments, then?.environments)
  const otherwiseEnvironment = otherwise ? appendEnvironments(thenEnvironment, otherwise.environments) : thenEnvironment
  return {
    activeNodes:  [],
    in:           ingoing,
    out:          outgoing,
    environments: otherwiseEnvironment,
    graph:        nextGraph,
    ast:          data.completeAst,
    scope:        data.activeScope,
  }
}
