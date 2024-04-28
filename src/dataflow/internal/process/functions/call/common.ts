import type { DataflowInformation } from '../../../../info'
import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../r-bridge'
import { EmptyArgument, RType } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import { processDataflowFor } from '../../../../processor'
import type { DataflowGraph, FunctionArgument } from '../../../../graph'
import { EdgeType } from '../../../../graph'
import type { IdentifierReference, REnvironmentInformation } from '../../../../environments'
import { define, overwriteEnvironment, resolveByName } from '../../../../environments'
import { guard } from '../../../../../util/assert'
import { markNonStandardEvaluationEdges } from './known-call-handling'

export interface ProcessAllArgumentInput<OtherInfo> {
	readonly functionName:   DataflowInformation
	readonly args:           readonly RFunctionArgument<OtherInfo & ParentInformation>[]
	readonly data:           DataflowProcessorInformation<OtherInfo & ParentInformation>
	readonly finalGraph:     DataflowGraph
	readonly functionRootId: NodeId
	/* allows passing a data processor in-between each argument; cannot modify env currently */
	readonly patchData?:     (data: DataflowProcessorInformation<OtherInfo & ParentInformation>, i: number) => DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** which arguments are to be marked as {@link EdgeType#NonStandardEvaluation|non-standard-evaluation}? */
	readonly markAsNSE?:     readonly number[]
}

export interface ProcessAllArgumentResult {
	readonly finalEnv:            REnvironmentInformation
	readonly callArgs:            FunctionArgument[]
	readonly remainingReadInArgs: IdentifierReference[]
	readonly processedArguments:  (DataflowInformation | undefined)[]
}

export function processAllArguments<OtherInfo>(
	{ functionName, args, data, finalGraph, functionRootId, patchData = d => d }: ProcessAllArgumentInput<OtherInfo>
): ProcessAllArgumentResult {
	let finalEnv = functionName.environment
	// arg env contains the environments with other args defined
	let argEnv = functionName.environment
	const callArgs: FunctionArgument[] = []
	const processedArguments: (DataflowInformation | undefined)[] = []
	const remainingReadInArgs = []
	let i = -1
	for(const arg of args) {
		i++
		data = patchData(data, i)
		if(arg === EmptyArgument) {
			callArgs.push(EmptyArgument)
			processedArguments.push(undefined)
			continue
		}

		const processed = processDataflowFor(arg, { ...data, environment: argEnv })
		processedArguments.push(processed)

		finalEnv = overwriteEnvironment(finalEnv, processed.environment)

		// resolve reads within argument, we resolve before adding the `processed.environment` to avoid cyclic dependencies
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

export interface PatchFunctionCallInput<OtherInfo> {
	readonly nextGraph:             DataflowGraph
	readonly rootId:                NodeId
	readonly name:                  RSymbol<OtherInfo & ParentInformation>
	readonly data:                  DataflowProcessorInformation<OtherInfo & ParentInformation>
	readonly argumentProcessResult: readonly (DataflowInformation | undefined)[]
}

export function patchFunctionCall<OtherInfo>(
	{ nextGraph, rootId, name, data, argumentProcessResult }: PatchFunctionCallInput<OtherInfo>
): void {
	nextGraph.addVertex({
		tag:               'function-call',
		id:                rootId,
		name:              name.content,
		environment:       data.environment,
		/* will be overwritten accordingly */
		onlyBuiltin:       false,
		controlDependency: data.controlDependency,
		args:              argumentProcessResult.map(arg => arg === undefined ? EmptyArgument : arg.out[0])
	})
	for(const arg of argumentProcessResult) {
		if(arg) {
			nextGraph.addEdge(rootId, arg.out[0], { type: EdgeType.Argument })
		}
	}
}
