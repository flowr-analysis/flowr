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
import { RTypeVariable , RComplexType, RDoubleType, RIntegerType, RLogicalType, RStringType, resolveType, RNullType, RFunctionType, RNeverType, RListType, RLanguageType, RAnyType } from './types';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { guard } from '../util/assert';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeIncludesType, EdgeType } from '../dataflow/graph/edge';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { FunctionArgument } from '../dataflow/graph/graph';
import { CfgVertexType } from '../control-flow/control-flow-graph';

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
	override onLogicalConstant(data: { vertex: DataflowGraphVertexValue, node: RLogical<UnresolvedTypeInfo> }): void {
		data.node.info.typeVariable.unify(new RLogicalType());
	}

	override onNumberConstant(data: { vertex: DataflowGraphVertexValue, node: RNumber<UnresolvedTypeInfo> }): void {
		if(data.node.content.complexNumber) {
			data.node.info.typeVariable.unify(new RComplexType());
		} else if(Number.isInteger(data.node.content.num)) {
			data.node.info.typeVariable.unify(new RIntegerType());
		} else {
			data.node.info.typeVariable.unify(new RDoubleType());
		}
	}

	override onStringConstant(data: { vertex: DataflowGraphVertexValue, node: RString<UnresolvedTypeInfo> }): void {
		data.node.info.typeVariable.unify(new RStringType());
	}

	override onVariableUse(data: { vertex: DataflowGraphVertexUse }): void {
		const node = this.getNormalizedAst(data.vertex.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		
		const origins = this.getOrigins(data.vertex.id);
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
		const outgoing = this.config.dataflow.graph.outgoingEdges(data.call.id);
		const callTargets = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Calls))
			.map(([target, _edge]) => target)
			.toArray();

		guard(callTargets !== undefined && callTargets.length >= 1, 'Expected at least one target for default function call');

		for(const target of callTargets) {
			const targetNode = this.getNormalizedAst(target);
			if(targetNode !== undefined) {
				targetNode.info.typeVariable.unify(new RFunctionType());
			} else {
				// TODO: Handle builtin functions that are not represented in the AST
			}
		}
	}

	override onGetCall(data: { call: DataflowGraphVertexFunctionCall }) {
		guard(data.call.args.length == 1, 'Expected exactly one argument for get call');
		const varName = data.call.args.at(0);
		
		guard(varName !== undefined && varName !== EmptyArgument, 'Expected argument of get call to be defined');
		const varNameNode = this.getNormalizedAst(varName.nodeId);

		guard(varNameNode !== undefined, 'Expected variable name node to be defined');
		varNameNode.info.typeVariable.unify(new RStringType());
	}

	override onRmCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.unify(new RNullType());
	}

	override onForLoopCall(data: { call: DataflowGraphVertexFunctionCall, variable: FunctionArgument, vector: FunctionArgument, body: FunctionArgument }) {
		guard(data.variable !== EmptyArgument && data.vector !== EmptyArgument, 'Expected variable and vector arguments to be defined');
		const variableNode = this.getNormalizedAst(data.variable.nodeId);
		const vectorNode = this.getNormalizedAst(data.vector.nodeId);
		
		guard(variableNode !== undefined && vectorNode !== undefined, 'Expected variable and vector nodes to be defined');
		variableNode.info.typeVariable.unify(vectorNode.info.typeVariable);

		this.onLoopCall(data);
	}

	override onWhileLoopCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, body: FunctionArgument }) {
		guard(data.condition !== EmptyArgument, 'Expected condition argument to be defined');
		const conditionNode = this.getNormalizedAst(data.condition.nodeId);
		
		guard(conditionNode !== undefined, 'Expected condition node to be defined');
		conditionNode.info.typeVariable.unify(new RLogicalType());

		this.onLoopCall(data);
	}

	override onRepeatLoopCall(data: { call: DataflowGraphVertexFunctionCall, body: FunctionArgument }) {
		this.onLoopCall(data);
	}

	protected onLoopCall(data: { call: DataflowGraphVertexFunctionCall, body: FunctionArgument }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const cfgVertex = this.config.controlFlow.graph.getVertex(data.call.id);
		guard(cfgVertex !== undefined && cfgVertex.type === CfgVertexType.Statement, 'Expected statement vertex for loop');
		const isInfinite = (cfgVertex.end ?? []).reduce((prevCount, id) => prevCount + (this.config.controlFlow.graph.outgoing(id)?.size ?? 0), 0) === 0;

		if(isInfinite) {
			node.info.typeVariable.unify(new RNeverType());
		} else {
			node.info.typeVariable.unify(new RNullType());
		}
	}

	override onIfThenElseCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, then: FunctionArgument, else: FunctionArgument | undefined }) {
		guard(data.condition !== EmptyArgument, 'Expected condition argument to be defined');
		const conditionNode = this.getNormalizedAst(data.condition.nodeId);
		
		guard(conditionNode !== undefined, 'Expected condition node to be defined');
		conditionNode.info.typeVariable.unify(new RLogicalType());

		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		guard(data.then !== EmptyArgument, 'Expected then argument to be defined');
		const isThenBranchReachable = (this.config.controlFlow.graph.ingoing(data.then.nodeId)?.size ?? 0) > 0;
		
		const thenNode = this.getNormalizedAst(data.then.nodeId);
		guard(thenNode !== undefined, 'Expected then node to be defined');

		if(isThenBranchReachable) {
			node.info.typeVariable.unify(thenNode.info.typeVariable);
		} else {
			node.info.typeVariable.unify(new RNeverType());
		}

		if(data.else !== undefined && data.else !== EmptyArgument) {
			const isElseBranchReachable = (this.config.controlFlow.graph.ingoing(data.else.nodeId)?.size ?? 0) > 0;

			const elseNode = this.getNormalizedAst(data.else.nodeId);
			guard(elseNode !== undefined, 'Expected else node to be defined');

			if(isElseBranchReachable) {
				node.info.typeVariable.unify(elseNode.info.typeVariable);
			} else {
				node.info.typeVariable.unify(new RNeverType());
			}
		}
	}
	
	override onQuoteCall(data: { call: DataflowGraphVertexFunctionCall }) {
		guard(data.call.args.length === 1, 'Expected exactly one argument for quote call');
		const arg = data.call.args.at(0);
		
		guard(arg !== undefined && arg !== EmptyArgument, 'Expected argument of quote call to be defined');
		const argNode = this.getNormalizedAst(arg.nodeId);
		
		guard(argNode !== undefined, 'Expected argument node to be defined');
		argNode.info.typeVariable.unify(new RStringType());

		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.unify(new RLanguageType());
	}

	override onEvalFunctionCall(data: { call: DataflowGraphVertexFunctionCall }) {
		guard(data.call.args.length === 1, 'Expected exactly one argument for eval call');
		const arg = data.call.args.at(0);
		
		guard(arg !== undefined && arg !== EmptyArgument, 'Expected argument of eval call to be defined');
		const argNode = this.getNormalizedAst(arg.nodeId);
		
		guard(argNode !== undefined, 'Expected argument node to be defined');
		argNode.info.typeVariable.unify(new RLanguageType());

		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.unify(new RAnyType()); // TODO: Infer a more specific type based on the argument if possible
	}

	override onListCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.unify(new RListType());
	}

	override onVectorCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		
		const args = data.call.args.filter((arg) => arg !== EmptyArgument);
		if(args.length === 0) {
			node.info.typeVariable.unify(new RNullType());
			return;
		}
		for(const arg of args) {
			const argNode = this.getNormalizedAst(arg.nodeId);
			guard(argNode !== undefined, 'Expected argument node to be defined');
			node.info.typeVariable.unify(argNode.info.typeVariable);
		}
	}

	override onFunctionDefinition(data: { vertex: DataflowGraphVertexFunctionDefinition }): void {
		const node = this.getNormalizedAst(data.vertex.id);
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