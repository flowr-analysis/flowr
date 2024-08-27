import type { DataflowProcessorInformation } from '../../../processor'
import { processDataflowFor } from '../../../processor'
import type { DataflowInformation } from '../../../info'
import { ExitPointType } from '../../../info'
import { collectAllIds } from '../../../../r-bridge/lang-4.x/ast/model/collect'
import type { ParentInformation } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RNode } from '../../../../r-bridge/lang-4.x/ast/model/model'
import type { IdentifierReference } from '../../../environments/identifier'
import { DataflowGraph } from '../../../graph/graph'
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type'
import { EdgeType } from '../../../graph/edge'
import type { RArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument'
import {DataflowGraphVertexFunctionCall, VertexType} from '../../../graph/vertex'
import {resolveByName} from "../../../environments/resolve-by-name";
import {linkFunctionCalls} from "../../linker";
import {overwriteEnvironment} from "../../../environments/overwrite";
import {NodeId} from "../../../../r-bridge/lang-4.x/ast/model/processing/node-id";


export function linkReadsForArgument<OtherInfo>(root: RNode<OtherInfo & ParentInformation>, ingoingRefs: readonly IdentifierReference[], graph: DataflowGraph) {
	const allIdsBeforeArguments = new Set(collectAllIds(root, n => n.type === RType.Argument && n.info.id !== root.info.id))
	const ingoingBeforeArgs = ingoingRefs.filter(r => allIdsBeforeArguments.has(r.nodeId))

	for(const ref of ingoingBeforeArgs) {
		// link against the root reference currently I do not know how to deal with nested function calls otherwise
		graph.addEdge(root.info.id, ref, { type: EdgeType.Reads })
	}
}

export function processFunctionArgument<OtherInfo>(
	argument: RArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const name = argument.name === undefined ? undefined : processDataflowFor(argument.name, data)
	const value = argument.value === undefined ? undefined : processDataflowFor(argument.value, data)
	// we do not keep the graph of the name, as this is no node that should ever exist
	const graph = value?.graph ?? new DataflowGraph(data.completeAst.idMap)

	const argumentName = argument.name?.content
	let entryPoint = value?.entryPoint
	if(argumentName) {
		graph.addVertex({
			tag:                 VertexType.Use,
			id:                  argument.info.id,
			controlDependencies: data.controlDependencies
		})
		entryPoint = argument.info.id
	}

	const ingoingRefs = [...value?.unknownReferences ?? [], ...value?.in ?? [], ...(name === undefined ? [] : [...name.in])]

	/* potentially link all function calls here (as maybes with a maybe cd) as the called function may employ calling-env-semantics if unknown */
	if(value) {
		const functionCalls = [...graph.vertices(true)]
			.filter(([_,info]) => info.tag === VertexType.FunctionCall) as [NodeId, DataflowGraphVertexFunctionCall][]
			/** TODO: check fully unresolved */
			// .filter(([id]) => graph.outgoingEdges(id)?.size === 0) as [NodeId, DataflowGraphVertexFunctionCall][]
		console.log(argumentName, functionCalls, functionCalls.map(([id]) => graph.outgoingEdges(id)))
		// try to resolve them against the current environment
		for(const [id, info] of functionCalls) {
			const resolved = resolveByName(info.name, data.environment) ?? []
			/* first, only link a read ref */
			for(const resolve of resolved) {
				console.log(`Linking ${info.name} to ${resolve.name}`)
				graph.addEdge(id, resolve.nodeId, { type: EdgeType.Reads })
			}
		}
	}

	if(entryPoint && argument.value?.type === RType.FunctionDefinition) {
		graph.addEdge(entryPoint, argument.value.info.id, { type: EdgeType.Reads })
	} else if(argumentName) {
		// we only need to link against those which are not already bound to another function call argument
		linkReadsForArgument(argument, [...ingoingRefs, ...value?.out ?? [] /* value may perform definitions */], graph)
	}

	return {
		unknownReferences: [],
		// active nodes of the name will be lost as they are only used to reference the corresponding parameter
		in:                ingoingRefs.filter(r => r.name !== undefined),
		out:               [...value?.out ?? [], ...(name?.out ?? [])],
		graph:             graph,
		environment:       value?.environment ?? data.environment,
		entryPoint:        entryPoint ?? argument.info.id,
		exitPoints:        value?.exitPoints ?? name?.exitPoints ?? [{ nodeId: argument.info.id, type: ExitPointType.Default, controlDependencies: data.controlDependencies }]
	}
}
