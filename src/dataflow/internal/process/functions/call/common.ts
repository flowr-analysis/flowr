import type { DataflowInformation } from '../../../../info'
import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../r-bridge'
import { EmptyArgument, RType } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import { processDataflowFor } from '../../../../processor'
import type { DataflowGraph, FunctionArgument } from '../../../../graph'
import { EdgeType } from '../../../../graph'
import type { IdentifierReference } from '../../../../environments'
import { define, overwriteEnvironment, resolveByName } from '../../../../environments'
import { guard } from '../../../../../util/assert'

export function processAllArguments<OtherInfo>(
	functionName: DataflowInformation,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	finalGraph: DataflowGraph,
	functionRootId: NodeId
) {
	let finalEnv = functionName.environment
	// arg env contains the environments with other args defined
	let argEnv = functionName.environment
	const callArgs: FunctionArgument[] = []
	const processedArguments = []
	const remainingReadInArgs = []
	for(const arg of args) {
		if(arg === EmptyArgument) {
			callArgs.push(EmptyArgument)
			processedArguments.push(undefined)
			continue
		}

		const processed = processDataflowFor(arg, { ...data, environment: argEnv })
		processedArguments.push(processed)

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
		finalGraph.addEdge(functionRootId, processed.out[0], { type: EdgeType.Argument })
		// resolve reads within argument
		for(const ingoing of [...processed.in, ...processed.unknownReferences]) {
			const tryToResolve = ingoing.name ? resolveByName(ingoing.name, argEnv) : undefined

			if(tryToResolve === undefined) {
				remainingReadInArgs.push(ingoing)
			} else {
				for(const resolved of tryToResolve) {
					finalGraph.addEdge(ingoing.nodeId, resolved.nodeId, { type: EdgeType.Reads })
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
	return { finalEnv, callArgs, remainingReadInArgs, processedArguments }
}


export function addControlEdges(ref: readonly IdentifierReference[], controlDep: NodeId, graph: DataflowGraph): IdentifierReference[] {
	const out: IdentifierReference[] = new Array<IdentifierReference>(ref.length)
	for(let i = 0; i < ref.length; i++) {
		const r = ref[i]
		const node = graph.get(r.nodeId, true)
		if(node) {
			node[0].controlDependency = node[0].controlDependency ? [controlDep, ...node[0].controlDependency] : [controlDep]
		}
		out[i] = { ...r, controlDependency: r.controlDependency ? [controlDep, ...r.controlDependency] : [controlDep] }
	}
	return out
}

export function patchFunctionCall<OtherInfo>(nextGraph: DataflowGraph, rootId: NodeId, name: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, argumentProcessResult: (DataflowInformation | undefined)[]) {
	nextGraph.addVertex({
		tag:               'function-call',
		id:                rootId,
		name:              name.content,
		environment:       data.environment,
		/* will be overwritten accordingly */
		onlyBuiltin:       false,
		controlDependency: undefined,
		args:              argumentProcessResult.map(arg => arg === undefined ? EmptyArgument : arg.out[0])
	})
	for(const arg of argumentProcessResult) {
		if(arg) {
			nextGraph.addEdge(rootId, arg.out[0], { type: EdgeType.Argument })
		}
	}
}
