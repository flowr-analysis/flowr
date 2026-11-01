import { type DataflowGraph, FunctionArgument } from './graph';
import { type DataflowGraphVertexFunctionCall, DfgVertex } from './vertex';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { Identifier } from '../environments/identifier';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

/** `do.call(f, list(a, b))` calls `f` with what the `list` holds, so the call of `f` takes the arguments of the `list` */
export function appliedArguments(graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, idMap: AstIdMap | undefined = graph.idMap): DataflowGraphVertexFunctionCall {
	if(vertex.args.length !== 1 || !RSymbol.is(idMap?.get(vertex.id))) {
		return vertex;
	}
	const ref = FunctionArgument.getReference(vertex.args[0]);
	const list = ref === undefined ? undefined : graph.getVertex(ref);
	return DfgVertex.isFunctionCall(list) && Identifier.getName(list.name) === 'list' ? { ...vertex, args: list.args } : vertex;
}
