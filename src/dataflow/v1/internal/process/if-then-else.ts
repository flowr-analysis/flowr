import { DataflowInformation } from '../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import { appendEnvironments, IdentifierReference, makeAllMaybe } from '../../../common/environments'
import { linkIngoingVariablesInSameScope } from '../linker'
import { ParentInformation, RIfThenElse } from '../../../../r-bridge'

export function processIfThenElse<OtherInfo>(ifThen: RIfThenElse<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const cond = processDataflowFor(ifThen.condition, data)

	data = { ...data, environments: cond.environments }

	let then: DataflowInformation | undefined
	let makeThenMaybe = false
	if(ifThen.condition.lexeme !== 'FALSE') {
		then = processDataflowFor(ifThen.then, data)
		if(ifThen.condition.lexeme !== 'TRUE') {
			makeThenMaybe = true
		}
	}

	let otherwise: DataflowInformation | undefined
	let makeOtherwiseMaybe = false
	if(ifThen.otherwise !== undefined  && ifThen.condition.lexeme !== 'TRUE') {
		otherwise = processDataflowFor(ifThen.otherwise, data)
		if(ifThen.condition.lexeme !== 'FALSE') {
			makeOtherwiseMaybe = true
		}
	}

	const nextGraph = cond.graph.mergeWith(then?.graph).mergeWith(otherwise?.graph)

	const thenEnvironment = then?.environments ?? cond.environments
	// if there is no "else" case we have to recover whatever we had before as it may be not executed
	const finalEnvironment = appendEnvironments(thenEnvironment, otherwise ? otherwise.environments : cond.environments)

	// again within an if-then-else we consider all actives to be read
	const ingoing: IdentifierReference[] = [
		...cond.in,
		...(makeThenMaybe ? makeAllMaybe(then?.in, nextGraph, finalEnvironment) : then?.in ?? []),
		...(makeOtherwiseMaybe ? makeAllMaybe(otherwise?.in, nextGraph, finalEnvironment) : otherwise?.in ?? []),
		...cond.unknownReferences,
		...(makeThenMaybe ? makeAllMaybe(then?.unknownReferences, nextGraph, finalEnvironment) : then?.unknownReferences ?? []),
		...(makeOtherwiseMaybe ? makeAllMaybe(otherwise?.unknownReferences, nextGraph, finalEnvironment) : otherwise?.unknownReferences ?? []),
	]

	// we assign all with a maybe marker
	// we do not merge even if they appear in both branches because the maybe links will refer to different ids
	const outgoing = [
		...cond.out,
		...(makeThenMaybe ? makeAllMaybe(then?.out, nextGraph, finalEnvironment) : then?.out ?? []),
		...(makeOtherwiseMaybe ? makeAllMaybe(otherwise?.out, nextGraph, finalEnvironment) : otherwise?.out ?? []),
	]

	linkIngoingVariablesInSameScope(nextGraph, ingoing)

	return {
		unknownReferences: [],
		in:                ingoing,
		out:               outgoing,
		environments:      finalEnvironment,
		graph:             nextGraph,
		scope:             data.activeScope,
	}
}
