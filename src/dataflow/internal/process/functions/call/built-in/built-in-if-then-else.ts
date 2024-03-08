import type { NodeId, ParentInformation, RFunctionArgument, RNode, RSymbol } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import { processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import {
	appendEnvironment,
	type IdentifierReference,
	makeAllMaybe,
	resolvesToBuiltInConstant
} from '../../../../../environments'
import { dataflowLogger } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { linkIngoingVariablesInSameScope } from '../../../../linker'
import { unpackArgument } from '../argument/unpack-argument'

// TODO handle (, {, ...
export function processIfThenElse<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 2 && args.length !== 3) {
		dataflowLogger.warn(`If-then-else ${name.content} has something different from 2 or 3 arguments, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	const unpackedArgs = args.map(unpackArgument)
	if(unpackedArgs.some(arg => arg === undefined)) {
		dataflowLogger.warn(`If-then-else ${name.content} has undefined arguments in ${JSON.stringify(args)} (${JSON.stringify(unpackedArgs)}), skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	const [condArg, thenArg, otherwiseArg] = unpackedArgs as [RNode<OtherInfo & ParentInformation>, RNode<OtherInfo & ParentInformation>, RNode<OtherInfo & ParentInformation> | undefined]

	const cond = processDataflowFor(condArg, data)

	data = { ...data, environment: cond.environment }

	let then: DataflowInformation | undefined
	let makeThenMaybe = false
	// TODO: defer this to abstract interpretation
	const conditionIsFalse = resolvesToBuiltInConstant(unpackedArgs[0]?.lexeme, data.environment, false)
	const conditionIsTrue = resolvesToBuiltInConstant(unpackedArgs[0]?.lexeme, data.environment, true)
	if(conditionIsFalse !== 'always') {
		then = processDataflowFor(thenArg, data)
		if(conditionIsTrue !== 'always') {
			makeThenMaybe = true
		}
	}

	let otherwise: DataflowInformation | undefined
	let makeOtherwiseMaybe = false
	if(otherwiseArg !== undefined  && conditionIsTrue !== 'always') {
		otherwise = processDataflowFor(otherwiseArg, data)
		if(conditionIsFalse !== 'always') {
			makeOtherwiseMaybe = true
		}
	}

	const nextGraph = cond.graph.mergeWith(then?.graph).mergeWith(otherwise?.graph)

	const thenEnvironment = then?.environment ?? cond.environment
	// if there is no "else" case we have to recover whatever we had before as it may be not executed
	const finalEnvironment = appendEnvironment(thenEnvironment, otherwise ? otherwise.environment : cond.environment)

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
		environment:       finalEnvironment,
		graph:             nextGraph
	}
}
