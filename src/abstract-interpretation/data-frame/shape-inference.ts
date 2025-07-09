import { defaultConfigOptions } from '../../config';
import { type ControlFlowInformation, isMarkerVertex } from '../../control-flow/control-flow-graph';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { VertexType } from '../../dataflow/graph/vertex';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isNotUndefined } from '../../util/assert';
import { type AbstractInterpretationInfo, DataFrameInfoMarker, hasDataFrameInfoMarker } from './absint-info';
import { DataFrameAbsintVisitor } from './absint-visitor';
import { type DataFrameDomain, type DataFrameStateDomain, DataFrameTop, joinDataFrames, joinDataFrameStates } from './domain';

/**
 * Performs abstract interpretation to infer the shape of data frames using the control flow graph of a program.
 * This directly attaches the inferred data frames shapes to the AST (see {@link AbstractInterpretationInfo}).
 *
 * @param cfinfo - The control flow information containing the control flow graph
 * @param dfg    - The data flow graph to resolve variable origins and function arguments
 * @param ast    - The abstract syntax tree to resolve node IDs to AST nodes
 * @returns The abstract data frame state at the exit node of the control flow graph (see {@link DataFrameStateDomain}).
 * The abstract data frame states for all other nodes are attached to the AST.
 */
export function inferDataFrameShapes(
	cfinfo: ControlFlowInformation,
	dfg: DataflowGraph,
	ast: NormalizedAst<ParentInformation & AbstractInterpretationInfo>
): DataFrameStateDomain {
	const visitor = new DataFrameAbsintVisitor({ controlFlow: cfinfo, dfg: dfg, normalizedAst: ast, flowrConfig: defaultConfigOptions });
	visitor.start();
	const exitPoints = cfinfo.exitPoints.map(id => cfinfo.graph.getVertex(id)).filter(isNotUndefined);
	const exitNodes = exitPoints.map(vertex => ast.idMap.get(isMarkerVertex(vertex) ? vertex.root : vertex.id)).filter(isNotUndefined);
	const result = exitNodes.map(node => node.info.dataFrame?.domain ?? new Map<NodeId, DataFrameDomain>());

	return joinDataFrameStates(...result);
}

/**
 * Resolves the abstract data frame shape of a node in the AST.
 * This requires that the data frame shape inference has been executed before using {@link inferDataFrameShapes}.
 *
 * @param id     - The node or node ID to get the data frame shape for
 * @param dfg    - The data flow graph used to resolve the data frame shape
 * @param domain - An optional abstract data frame state domain used to resolve the data frame shape (defaults to the state at the requested node)
 * @returns The abstract data frame shape of the node, or `undefined` if no data frame shape was inferred for the node
 */
export function resolveIdToDataFrameShape(
	id: RNode<ParentInformation & AbstractInterpretationInfo> | NodeId | undefined,
	dfg: DataflowGraph | undefined,
	domain?: DataFrameStateDomain
): DataFrameDomain | undefined {
	const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = id === undefined || typeof id === 'object' ? id : dfg?.idMap?.get(id);
	domain ??= node?.info.dataFrame?.domain;

	if(dfg === undefined || node === undefined || domain === undefined) {
		return;
	} else if(domain.has(node.info.id)) {
		return domain.get(node.info.id);
	}
	const vertex = dfg.getVertex(node.info.id);
	const call = vertex?.tag === VertexType.FunctionCall ? vertex : undefined;
	const origins = Array.isArray(call?.origin) ? call.origin : [];

	if(node.type === RType.Symbol) {
		const values = getVariableOrigins(node.info.id, dfg).map(origin => domain.get(origin.info.id));

		if(values.length > 0 && values.every(isNotUndefined)) {
			return joinDataFrames(...values);
		}
	} else if(node.type === RType.Argument && node.value !== undefined) {
		return resolveIdToDataFrameShape(node.value, dfg, domain);
	} else if(node.type === RType.ExpressionList && node.children.length > 0) {
		return resolveIdToDataFrameShape(node.children[node.children.length - 1], dfg, domain);
	} else if(node.type === RType.Pipe) {
		return resolveIdToDataFrameShape(node.rhs, dfg, domain);
	} else if(origins.includes('builtin:pipe')) {
		if(node.type === RType.BinaryOp) {
			return resolveIdToDataFrameShape(node.rhs, dfg, domain);
		} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
			return resolveIdToDataFrameShape(call.args[1].nodeId, dfg, domain);
		}
	} else if(node.type === RType.IfThenElse) {
		if(node.otherwise === undefined) {
			return resolveIdToDataFrameShape(node.then, dfg, domain) !== undefined ? DataFrameTop : undefined;
		} else {
			const values = [node.then, node.otherwise].map(entry => resolveIdToDataFrameShape(entry, dfg, domain));

			if(values.length > 0 && values.every(isNotUndefined)) {
				return joinDataFrames(...values);
			}
		}
	} else if(origins.includes('builtin:if-then-else') && call?.args.every(arg => arg !== EmptyArgument)) {
		if(call.args.length === 2) {
			return resolveIdToDataFrameShape(call.args[1].nodeId, dfg, domain) !== undefined ? DataFrameTop : undefined;
		} else if(call.args.length === 3) {
			const values = call.args.slice(1, 3).map(entry => resolveIdToDataFrameShape(entry.nodeId, dfg, domain));

			if(values.length > 0 && values.every(isNotUndefined)) {
				return joinDataFrames(...values);
			}
		}
	}
}

/**
 * Gets all origins of a variable in the data flow graph that have already been visited.
 *
 * @param node - The node to get the origins for
 * @param dfg  - The data flow graph for resolving the origins
 * @returns The origins nodes of the variable
 */
export function getVariableOrigins(node: NodeId, dfg: DataflowGraph): RNode<ParentInformation & AbstractInterpretationInfo>[] {
	// get each variable origin that has already been visited and whose assignment has already been processed
	return getOriginInDfg(dfg, node)
		?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
		.map<RNode<ParentInformation & AbstractInterpretationInfo> | undefined>(entry => dfg.idMap?.get(entry.id))
		.filter(isNotUndefined)
		.filter(origin => origin.info.dataFrame?.domain !== undefined)
		.filter(origin => !hasDataFrameInfoMarker(origin, DataFrameInfoMarker.Unassigned)) ?? [];
}
