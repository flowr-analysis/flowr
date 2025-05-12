import { extractCFG } from '../control-flow/extract-cfg';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import type { DataflowInformation } from '../dataflow/info';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { mapNormalizedAstInfo } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RDataType } from './types';
import { RTypeVariable , RComplexType, RDoubleType, RIntegerType, RLogicalType, RStringType, resolveType, RNullType } from './types';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';

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
		if(node === undefined || node.type !== RType.ExpressionList) {
			return;
		}
		const lastElement = data.call.args.at(-1);
		const lastElementNode = lastElement !== undefined && lastElement !== EmptyArgument ? this.getNormalizedAst(lastElement.nodeId) : undefined;
		if(lastElementNode !== undefined) {
			node.info.typeVariable.unify(lastElementNode.info.typeVariable);
		} else {
			node.info.typeVariable.unify(new RNullType());
		}
	}
}