import type { DataflowInformation } from '../../../../info'
import type { NodeId, ParentInformation, RArgument, RFunctionArgument, RNode, RSymbol } from '../../../../../r-bridge'
import { EmptyArgument, RType } from '../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../processor'
import { processDataflowFor } from '../../../../processor'
import type { DataflowGraph, FunctionArgument } from '../../../../graph'
import { VertexType , EdgeType } from '../../../../graph'
import type { IdentifierReference, REnvironmentInformation } from '../../../../environments'
import { define, overwriteEnvironment, resolveByName } from '../../../../environments'

export interface ProcessAllArgumentInput<OtherInfo> {
	readonly functionName:   DataflowInformation
	readonly args:           readonly (RNode<OtherInfo & ParentInformation> | RFunctionArgument<OtherInfo & ParentInformation>)[]
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

		if(arg.type !== RType.Argument || !arg.name) {
			callArgs.push({ nodeId: processed.entryPoint, controlDependencies: undefined })
		} else {
			callArgs.push({ nodeId: processed.entryPoint, name: arg.name.content, controlDependencies: undefined })
		}

		finalGraph.addEdge(functionRootId, processed.entryPoint, { type: EdgeType.Argument })

		if(arg.type as RType === RType.Argument && arg.name !== undefined) {
			argEnv = define(
				{ nodeId: processed.entryPoint, name: ((arg as RArgument).name as RSymbol).content, definedAt: arg.info.id, kind: 'argument', controlDependencies: data.controlDependencies },
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
		tag:                 VertexType.FunctionCall,
		id:                  rootId,
		name:                name.content,
		environment:         data.environment,
		/* will be overwritten accordingly */
		onlyBuiltin:         false,
		controlDependencies: data.controlDependencies,
		args:                argumentProcessResult.map(arg => arg === undefined ? EmptyArgument : { nodeId: arg.entryPoint, controlDependencies: undefined })
	})
	for(const arg of argumentProcessResult) {
		if(arg) {
			nextGraph.addEdge(rootId, arg.entryPoint, { type: EdgeType.Argument })
		}
	}
}
