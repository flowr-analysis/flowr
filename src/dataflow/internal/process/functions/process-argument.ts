import { type DataflowProcessorInformation, processDataflowFor } from '../../../processor';
import { type DataflowInformation, ExitPointType } from '../../../info';
import { collectAllIds } from '../../../../r-bridge/lang-4.x/ast/model/collect';
import type { ParentInformation } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../../r-bridge/lang-4.x/ast/model/model';
import type { IdentifierReference } from '../../../environments/identifier';
import { DataflowGraph } from '../../../graph/graph';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../graph/edge';
import type { RArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { VertexType } from '../../../graph/vertex';

/**
 * Links all reads that occur before the argument to the argument root node.
 */
export function linkReadsForArgument<OtherInfo>(root: RNode<OtherInfo & ParentInformation>, ingoingRefs: readonly IdentifierReference[], graph: DataflowGraph) {
	const allIdsBeforeArguments = new Set(collectAllIds(root, n => n.type === RType.Argument && n.info.id !== root.info.id));
	const ingoingBeforeArgs = ingoingRefs.filter(r => allIdsBeforeArguments.has(r.nodeId));

	for(const ref of ingoingBeforeArgs) {
		// link against the root reference currently I do not know how to deal with nested function calls otherwise
		graph.addEdge(root.info.id, ref, EdgeType.Reads);
	}
}

/**
 * Processes the dataflow information for a function argument.
 */
export function processFunctionArgument<OtherInfo>(
	argument: RArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const name = argument.name === undefined ? undefined : processDataflowFor(argument.name, data);
	const value = argument.value === undefined ? undefined : processDataflowFor(argument.value, data);
	// we do not keep the graph of the name, as this is no node that should ever exist
	const graph = value?.graph ?? new DataflowGraph(data.completeAst.idMap);

	const argumentName = argument.name?.content;
	let entryPoint = value?.entryPoint;
	if(argumentName) {
		graph.addVertex({
			tag: VertexType.Use,
			id:  argument.info.id,
			cds: data.controlDependencies
		}, data.ctx.env.getCleanEnv());
		entryPoint = argument.info.id;
	}

	const ingoingRefs = [...value?.unknownReferences ?? [], ...value?.in ?? [], ...(name === undefined ? [] : [...name.in])];

	if(entryPoint && argument.value?.type === RType.FunctionDefinition) {
		graph.addEdge(entryPoint, argument.value.info.id, EdgeType.Reads);
	} else if(argumentName) {
		// we only need to link against those which are not already bound to another function call argument
		linkReadsForArgument(argument, [...ingoingRefs, ...value?.out ?? [] /* value may perform definitions */], graph);
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
	};
}
