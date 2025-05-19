import { extractCFG } from '../control-flow/extract-cfg';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexUse, DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import type { DataflowInformation } from '../dataflow/info';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { mapNormalizedAstInfo } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RDataType } from './types';
import { RTypeVariable , RComplexType, RDoubleType, RIntegerType, RLogicalType, RStringType, resolveType, RNullType } from './types';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
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
		guard(node !== undefined && node.type === RType.Symbol, 'Expected Symbol node');
		const origins = this.getOrigins(vertex.id) ?? [];
		const readOrigins = origins.filter((origin) => origin.type === OriginType.ReadVariableOrigin);
		if(readOrigins.length === 0) {
			node.info.typeVariable.unify(new RNullType());
			return;
		}
		for(const readOrigin of readOrigins) {
			const readNode = this.getNormalizedAst(readOrigin.id);
			guard(readNode !== undefined, 'Expected read node');
			node.info.typeVariable.unify(readNode.info.typeVariable);
		}
	}

	override onAssignmentCall(data: { call: DataflowGraphVertexFunctionCall; target?: NodeId; source?: NodeId; }): void {
		if(data.target === undefined || data.source === undefined) {
			return;
		}
		const variableNode = this.getNormalizedAst(data.target);
		const valueNode = this.getNormalizedAst(data.source);
		const assignmentNode = this.getNormalizedAst(data.call.id);
		guard(variableNode !== undefined && valueNode !== undefined && assignmentNode !== undefined);
		variableNode.info.typeVariable.unify(valueNode.info.typeVariable);
		assignmentNode.info.typeVariable.unify(variableNode.info.typeVariable);
	}

	override onProgram(node: RExpressionList<UnresolvedTypeInfo>) {
		const lastElement = node.children.at(-1);
		if(lastElement !== undefined) {
			node.info.typeVariable.unify(lastElement.info.typeVariable);
		} else {
			node.info.typeVariable.unify(new RNullType());
		}
	}

	override onExpressionList(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const outgoing = this.config.dataflow.graph.outgoingEdges(data.call.id);
		const returnCandidates = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Returns))
			.map(([target, _edge]) => target)
			.toArray();

		if(returnCandidates === undefined || returnCandidates.length === 0) {
			node.info.typeVariable.unify(new RNullType());
			return;
		}

		for(const targetId of returnCandidates) {
			const target = this.getNormalizedAst(targetId);
			guard(target !== undefined, 'Expected target node to be defined');
			node.info.typeVariable.unify(target.info.typeVariable);
		}
	}
}