import { extractCFG } from '../control-flow/extract-cfg';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexUse, DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import type { DataflowInformation } from '../dataflow/info';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { mapNormalizedAstInfo } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RDataType } from './types';
import { RTypeVariable , RComplexType, RDoubleType, RIntegerType, RLogicalType, RStringType, resolveType, RNullType, RFunctionType } from './types';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { guard } from '../util/assert';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeIncludesType, EdgeType } from '../dataflow/graph/edge';

export function inferDataTypes<Info extends { typeVariable?: undefined }>(ast: NormalizedAst<Info>, dataFlowInfo: DataflowInformation): NormalizedAst<Info & DataTypeInfo> {
	const astWithTypeVars = decorateTypeVariables(ast);
	const controlFlowInfo = extractCFG(astWithTypeVars);
	const config = {
		normalizedAst:        astWithTypeVars,
		controlFlow:          controlFlowInfo,
		dataflow:             dataFlowInfo,
		defaultVisitingOrder: 'forward' as const,
	};
	const visitor = new TypeInferingCfgGuidedVisitor(config);
	visitor.start();

	return resolveTypeVariables(astWithTypeVars);
}

type UnresolvedTypeInfo = {
	typeVariable: RTypeVariable;
};

export type DataTypeInfo = {
	inferredType: RDataType;
}

function decorateTypeVariables<OtherInfo>(ast: NormalizedAst<OtherInfo>): NormalizedAst<OtherInfo & UnresolvedTypeInfo> {
	return mapNormalizedAstInfo(ast, {}, (node, _down) => ({ ...node.info, typeVariable: new RTypeVariable() }));
}

function resolveTypeVariables<Info extends UnresolvedTypeInfo>(ast: NormalizedAst<Info>): NormalizedAst<Omit<Info, keyof UnresolvedTypeInfo> & DataTypeInfo> {
	return mapNormalizedAstInfo(ast, {}, (node, _down) => {
		const { typeVariable, ...rest } = node.info;
		return { ...rest, inferredType: resolveType(typeVariable) };
	});
}

class TypeInferingCfgGuidedVisitor extends SemanticCfgGuidedVisitor<UnresolvedTypeInfo>{
	override onLogicalConstant(_vertex: DataflowGraphVertexValue, node: RLogical<UnresolvedTypeInfo>): void {
		node.info.typeVariable.unify(new RLogicalType());
	}

	override onNumberConstant(_vertex: DataflowGraphVertexValue, node: RNumber<UnresolvedTypeInfo>): void {
		if(node.content.complexNumber) {
			node.info.typeVariable.unify(new RComplexType());
		} else if(Number.isInteger(node.content.num)) {
			node.info.typeVariable.unify(new RIntegerType());
		} else {
			node.info.typeVariable.unify(new RDoubleType());
		}
	}

	override onStringConstant(_vertex: DataflowGraphVertexValue, node: RString<UnresolvedTypeInfo>): void {
		node.info.typeVariable.unify(new RStringType());
	}

	override onVariableUse(vertex: DataflowGraphVertexUse): void {
		const node = this.getNormalizedAst(vertex.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		
		const origins = this.getOrigins(vertex.id);
		const readOrigins = origins?.filter((origin) => origin.type === OriginType.ReadVariableOrigin);

		if(readOrigins === undefined || readOrigins.length === 0) {
			node.info.typeVariable.unify(new RNullType());
			return;
		}

		for(const readOrigin of readOrigins) {
			const readNode = this.getNormalizedAst(readOrigin.id);
			guard(readNode !== undefined, 'Expected read node to be defined');
			node.info.typeVariable.unify(readNode.info.typeVariable);
		}
	}

	override onAssignmentCall(data: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(data.target === undefined || data.source === undefined) {
			return; // Malformed assignment
		}
		
		const variableNode = this.getNormalizedAst(data.target);
		const valueNode = this.getNormalizedAst(data.source);
		const assignmentNode = this.getNormalizedAst(data.call.id);
		guard(variableNode !== undefined && valueNode !== undefined && assignmentNode !== undefined, 'Expected AST nodes to be defined');
		
		variableNode.info.typeVariable.unify(valueNode.info.typeVariable);
		assignmentNode.info.typeVariable.unify(variableNode.info.typeVariable);
	}

	override onDefaultFunctionCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const outgoing = this.config.dataflow.graph.outgoingEdges(data.call.id);
		const callsTargets = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Calls))
			.map(([target, _edge]) => target)
			.toArray();

		guard(callsTargets === undefined || callsTargets.length <= 1, 'Expected at most one call edge');

		if(callsTargets === undefined || callsTargets.length === 0) {
			// TODO: Handle builtin functions
			return;
		}

		const target = this.getNormalizedAst(callsTargets[0]);
		guard(target !== undefined, 'Expected target node to be defined');

		target.info.typeVariable.unify(new RFunctionType());
	}

	override onFunctionDefinition(vertex: DataflowGraphVertexFunctionDefinition): void {
		const node = this.getNormalizedAst(vertex.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		node.info.typeVariable.unify(new RFunctionType());
	}

	override onProgram(node: RExpressionList<UnresolvedTypeInfo>) {
		const exitPoints = this.config.dataflow.exitPoints;
		const evalCandidates = exitPoints.map((exitPoint) => exitPoint.nodeId);

		if(evalCandidates.length === 0) {
			node.info.typeVariable.unify(new RNullType());
			return;
		}

		for(const candidateId of evalCandidates) {
			const candidate = this.getNormalizedAst(candidateId);
			guard(candidate !== undefined, 'Expected target node to be defined');
			node.info.typeVariable.unify(candidate.info.typeVariable);
		}
	}

	override onExpressionList(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const outgoing = this.config.dataflow.graph.outgoingEdges(data.call.id);
		const evalCandidates = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Returns))
			.map(([target, _edge]) => target)
			.toArray();

		if(evalCandidates === undefined || evalCandidates.length === 0) {
			node.info.typeVariable.unify(new RNullType());
			return;
		}

		for(const candidateId of evalCandidates) {
			const candidate = this.getNormalizedAst(candidateId);
			guard(candidate !== undefined, 'Expected target node to be defined');
			node.info.typeVariable.unify(candidate.info.typeVariable);
		}
	}
}