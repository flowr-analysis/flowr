import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { IdentifierReference } from '../environments'
import { linkIngoingVariablesInSameScope } from '../linker'

export function processIfThenElse<OtherInfo>(ifThen: unknown, cond: DataflowInfo<OtherInfo>,
                                             then: DataflowInfo<OtherInfo>, otherwise: DataflowInfo<OtherInfo> | undefined,
                                             down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  // TODO: allow to also attribute in-put with maybe and always
  // again within an if-then-else we consider all actives to be read
  // TODO: makeFoldReadTargetsMaybe(
  const ingoing: IdentifierReference[] = [...cond.in, ...then.in,
    .../* makeFoldReadTargetsMaybe */(otherwise?.in ?? []), ...cond.activeNodes,
    .../* makeFoldReadTargetsMaybe */(then.activeNodes), .../* makeFoldReadTargetsMaybe */(otherwise?.activeNodes ?? [])
  ]

  // we assign all with a maybe marker
  const outgoing = [...cond.out, ...then.out, ...(otherwise?.out ?? [])]

  // we do not merge even if they appear in both branches because the maybe links will refer to different ids
  // TODO:
  /* for(const references of [...then.out, ...(otherwise?.out ?? [])]) {
    const existing = outgoing.get(scope)
    const existingIds = existing?.flatMap(t => t.attribute === 'always' ? [t.id] : t.ids) ?? []
    outgoing.set(scope, targets.map(t => {
      if(t.attribute === 'always') {
        return {attribute: 'maybe', ids: [t.id, ...existingIds]}
      } else {
        return t
      }
    }))
  } */

  const nextGraph = cond.currentGraph.mergeWith(then.currentGraph, otherwise?.currentGraph)
  linkIngoingVariablesInSameScope(nextGraph, ingoing)
  // TODO: join def-def?


  return {
    activeNodes:  [],
    in:           ingoing,
    out:          outgoing,
    currentGraph: nextGraph,
    ast:          down.ast,
    currentScope: down.scope,
  }
}
