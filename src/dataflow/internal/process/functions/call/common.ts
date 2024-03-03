import type { DataflowInformation } from '../../../../info'
import type { NodeId, ParentInformation, RFunctionCall } from '../../../../../r-bridge'
import { EmptyArgument, RType } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import { processDataflowFor } from '../../../../processor'
import type { DataflowGraph } from '../../../../graph'
import { EdgeType, type FunctionArgument } from '../../../../graph'
import { define, overwriteEnvironment, resolveByName } from '../../../../environments'
import { guard } from '../../../../../util/assert'

export function processAllArguments<OtherInfo>(
	functionName: DataflowInformation,
	functionCall: RFunctionCall<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	finalGraph: DataflowGraph,
	functionRootId: NodeId
) {
	let finalEnv = functionName.environment
	// arg env contains the environments with other args defined
	let argEnv = functionName.environment
	const callArgs: FunctionArgument[] = []
	const args = []
	const remainingReadInArgs = []
	for(const arg of functionCall.arguments) {
		if(arg === EmptyArgument) {
			callArgs.push('empty')
			args.push(undefined)
			continue
		}

		const processed = processDataflowFor(arg, { ...data, environment: argEnv })
		args.push(processed)

		finalEnv = overwriteEnvironment(finalEnv, processed.environment)
		argEnv = overwriteEnvironment(argEnv, processed.environment)

		finalGraph.mergeWith(processed.graph)

		guard(processed.out.length > 0, () => `Argument ${JSON.stringify(arg)} has no out references, but needs one for the unnamed arg`)
		if(arg.type !== RType.Argument || !arg.name) {
			callArgs.push(processed.out[0])
		} else {
			callArgs.push([arg.name.content, processed.out[0]])
		}

		// add an argument edge to the final graph
		finalGraph.addEdge(functionRootId, processed.out[0], EdgeType.Argument, 'always')
		// resolve reads within argument
		for(const ingoing of [...processed.in, ...processed.unknownReferences]) {
			const tryToResolve = resolveByName(ingoing.name, argEnv)

			if(tryToResolve === undefined) {
				remainingReadInArgs.push(ingoing)
			} else {
				for(const resolved of tryToResolve) {
					finalGraph.addEdge(ingoing.nodeId, resolved.nodeId, EdgeType.Reads, 'always')
				}
			}
		}
		if(arg.type as RType === RType.Argument && arg.name !== undefined) {
			argEnv = define(
				{ ...processed.out[0], definedAt: arg.info.id, kind: 'argument' },
				false,
				argEnv
			)
		}
	}
	return { finalEnv, callArgs, remainingReadInArgs }
}
