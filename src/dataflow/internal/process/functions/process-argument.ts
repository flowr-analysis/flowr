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
import { edgeIncludesType, EdgeType } from '../../../graph/edge'
import type { RArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument'
import {
	DataflowGraphVertexFunctionDefinition,
	isFunctionDefinitionVertex

} from '../../../graph/vertex'
import { VertexType } from '../../../graph/vertex'
import { resolveByName } from '../../../environments/resolve-by-name'
import type { NodeId } from '../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import {MergeableRecord} from "../../../../util/objects";
import {REnvironmentInformation} from "../../../environments/environment";


export function linkReadsForArgument<OtherInfo>(root: RNode<OtherInfo & ParentInformation>, ingoingRefs: readonly IdentifierReference[], graph: DataflowGraph) {
	const allIdsBeforeArguments = new Set(collectAllIds(root, n => n.type === RType.Argument && n.info.id !== root.info.id))
	const ingoingBeforeArgs = ingoingRefs.filter(r => allIdsBeforeArguments.has(r.nodeId))

	for(const ref of ingoingBeforeArgs) {
		// link against the root reference currently I do not know how to deal with nested function calls otherwise
		graph.addEdge(root.info.id, ref, { type: EdgeType.Reads })
	}
}

function hasNoOutgoingCallOrReadEdge(graph: DataflowGraph, id: NodeId): boolean {
	const outgoings = graph.outgoingEdges(id)
	if(outgoings === undefined) {
		return true
	}

	for(const [_, edge] of outgoings) {
		if(edgeIncludesType(edge.types, EdgeType.Calls | EdgeType.Reads)) {
			return false
		}
	}
	return true
}

export interface FunctionArgumentConfiguration extends MergeableRecord {
	readonly forceValue?: boolean
}

function forceVertexValueReferences(value: DataflowInformation, graph: DataflowGraph, env: REnvironmentInformation): void {
	const ingoing = value.in;
	const containedSubflowIn: readonly IdentifierReference[] = [...graph.vertices(true)]
		.filter(([,info]) => isFunctionDefinitionVertex(info))
		.flatMap(([, info]) => (info as DataflowGraphVertexFunctionDefinition).subflow.in)
	// try to resolve them against the current environment
	for(const ref of [...ingoing, ...containedSubflowIn]) {
		if(ref.name) {
			const resolved = resolveByName(ref.name, env) ?? []
			for (const resolve of resolved) {
				graph.addEdge(ref.nodeId, resolve.nodeId, {type: EdgeType.Reads})
			}
		}
	}
}

export function processFunctionArgument<OtherInfo>(
	argument: RArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ forceValue = false }: FunctionArgumentConfiguration = {}
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

	/*
	 * Potentially link all references here (as maybes with a maybe cd) as the called function may employ calling-env-semantics if unknown.
	 * Yet we still keep those references within the open ins in case the environment changes.
	 */
	if(forceValue && value) {
		console.log('HEEEEEEEY')
		forceVertexValueReferences(value, graph, data.environment)
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
