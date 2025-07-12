import { extractCfg } from '../control-flow/extract-cfg';
import type { SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexUse, DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import type { DataflowInformation } from '../dataflow/info';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { mapNormalizedAstInfo } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataType, UnresolvedDataType } from './types';
import { UnresolvedRTypeVariable, RComplexType, RDoubleType, RIntegerType, RLogicalType, RStringType, resolveType, RNullType, UnresolvedRListType, RLanguageType, UnresolvedRFunctionType, UnresolvedRAtomicVectorType, UnresolvedRTypeUnion } from './types';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { guard } from '../util/assert';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeIncludesType, EdgeType } from '../dataflow/graph/edge';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { FunctionArgument } from '../dataflow/graph/graph';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import { CfgEdgeType, CfgVertexType } from '../control-flow/control-flow-graph';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';

export function inferDataTypes<Info extends ParentInformation & { typeVariable?: undefined }>(ast: NormalizedAst<ParentInformation & Info>, dataflowInfo: DataflowInformation): NormalizedAst<Info & DataTypeInfo> {
	const astWithTypeVars = decorateTypeVariables(ast);
	const controlFlowInfo = extractCfg(astWithTypeVars, dataflowInfo.graph, ['unique-cf-sets', 'analyze-dead-code', 'remove-dead-code']);
	const config = {
		normalizedAst:        astWithTypeVars,
		controlFlow:          controlFlowInfo,
		dataflowInfo:         dataflowInfo,
		dfg:                  dataflowInfo.graph,
		defaultVisitingOrder: 'forward' as const,
	};
	const visitor = new TypeInferringCfgGuidedVisitor(config);
	visitor.start();

	return resolveTypeVariables(astWithTypeVars);
}

type UnresolvedTypeInfo = {
	typeVariable: UnresolvedRTypeVariable;
};

export type DataTypeInfo = {
	inferredType: DataType;
}

function decorateTypeVariables<Info extends ParentInformation>(ast: NormalizedAst<Info>): NormalizedAst<Info & UnresolvedTypeInfo> {
	return mapNormalizedAstInfo(ast, node => ({ ...node.info, typeVariable: new UnresolvedRTypeVariable() }));
}

function resolveTypeVariables<Info extends ParentInformation & UnresolvedTypeInfo>(ast: NormalizedAst<Info>): NormalizedAst<Omit<Info, keyof UnresolvedTypeInfo> & DataTypeInfo> {
	return mapNormalizedAstInfo(ast, node => {
		const { typeVariable, ...rest } = node.info;
		return { ...rest, inferredType: resolveType(typeVariable) };
	});
}

export interface TypeInferringCfgGuidedVisitorConfiguration<
	OtherInfo                                                 = NoInfo,
	ControlFlow extends ControlFlowInformation                = ControlFlowInformation,
	Ast extends NormalizedAst<UnresolvedTypeInfo & OtherInfo> = NormalizedAst<UnresolvedTypeInfo & OtherInfo>,
	Dataflow extends DataflowInformation                      = DataflowInformation
> extends Omit<SemanticCfgGuidedVisitorConfiguration<UnresolvedTypeInfo & OtherInfo, ControlFlow, Ast>, 'dataflow'> {
	dataflowInfo: Dataflow;
}

class TypeInferringCfgGuidedVisitor<
	OtherInfo                                                 = NoInfo,
	ControlFlow extends ControlFlowInformation                = ControlFlowInformation,
	Ast extends NormalizedAst<UnresolvedTypeInfo & OtherInfo> = NormalizedAst<UnresolvedTypeInfo & OtherInfo>,
	Dataflow extends DataflowInformation                      = DataflowInformation,
	Config extends TypeInferringCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dataflow> = TypeInferringCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dataflow>
> extends SemanticCfgGuidedVisitor<UnresolvedTypeInfo & OtherInfo, ControlFlow, Ast, Dataflow['graph'], Config & { dataflow: Dataflow['graph'] }> {
	constructor(config: Config) {
		super({ dataflow: config.dataflowInfo.graph, ...config });
	}


	protected constrainNodeTypeWithUpperBound(id: NodeId, upperBound: UnresolvedDataType): void {
		const node = this.getNormalizedAst(id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.constrainWithUpperBound(upperBound);
	}


	protected override onNullConstant(data: { vertex: DataflowGraphVertexValue; node: RSymbol<UnresolvedTypeInfo & ParentInformation, 'NULL'>; }): void {
		data.node.info.typeVariable.constrainFromBothSides(new RNullType());
	}

	override onLogicalConstant(data: { vertex: DataflowGraphVertexValue, node: RLogical<UnresolvedTypeInfo> }): void {
		data.node.info.typeVariable.constrainFromBothSides(new RLogicalType());
	}

	override onNumberConstant(data: { vertex: DataflowGraphVertexValue, node: RNumber<UnresolvedTypeInfo> }): void {
		if(data.node.content.complexNumber) {
			data.node.info.typeVariable.constrainFromBothSides(new RComplexType());
		} else if(data.node.content.markedAsInt) {
			data.node.info.typeVariable.constrainFromBothSides(new RIntegerType());
		} else if(data.node.content.num % 1 === 0) {
			data.node.info.typeVariable.constrainWithLowerBound(new RIntegerType());
			data.node.info.typeVariable.constrainWithUpperBound(new RComplexType());
		} else {
			data.node.info.typeVariable.constrainWithLowerBound(new RDoubleType());
			data.node.info.typeVariable.constrainWithUpperBound(new RComplexType());
		}
	}

	override onStringConstant(data: { vertex: DataflowGraphVertexValue, node: RString<UnresolvedTypeInfo> }): void {
		data.node.info.typeVariable.constrainFromBothSides(new RStringType());
	}

	override onVariableUse(data: { vertex: DataflowGraphVertexUse }): void {
		const isArgumentOfGetCall = this.config.dfg.ingoingEdges(data.vertex.id)?.entries().some(([source, edge]) => {
			return edgeIncludesType(edge.types, EdgeType.Argument) &&
				(this.config.dfg.getVertex(source)?.origin as string[] | undefined)?.includes('builtin:get');
		}) ?? false;
		if(isArgumentOfGetCall) {
			// If the variable use occurs through a `get` call, it is already handled by the `onGetCall` method
			return;
		}
		
		const node = this.getNormalizedAst(data.vertex.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		if(node.type === RType.Argument) {
			if(node.value !== undefined) {
				node.info.typeVariable.constrainWithLowerBound(node.value.info.typeVariable);
			}
			return;
		}

		const readOrigins = this.getOrigins(data.vertex.id)?.filter((origin) => origin.type === OriginType.ReadVariableOrigin);
		for(const readOrigin of readOrigins ?? []) {
			const readNode = this.getNormalizedAst(readOrigin.id);
			guard(readNode !== undefined, 'Expected read node to be defined');
			node.info.typeVariable.constrainWithLowerBound(readNode.info.typeVariable);
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
		
		variableNode.info.typeVariable.constrainWithLowerBound(valueNode.info.typeVariable);
		assignmentNode.info.typeVariable.constrainWithLowerBound(variableNode.info.typeVariable);
	}

	override onDefaultFunctionCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		const outgoing = this.config.dataflowInfo.graph.outgoingEdges(data.call.id);
		const callTargets = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Calls))
			.map(([target, _edge]) => target)
			.toArray();
		
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		for(const target of callTargets ?? []) {
			const targetNode = this.getNormalizedAst(target);
			if(targetNode !== undefined) {
				const functionType = new UnresolvedRFunctionType();
				targetNode.info.typeVariable.constrainWithLowerBound(functionType);

				for(const [index, arg] of data.call.args.entries()) {
					if(arg === EmptyArgument) {
						continue; // Skip empty arguments
					}

					const argNode = this.getNormalizedAst(arg.nodeId);
					guard(argNode !== undefined, 'Expected argument node to be defined');

					if(arg.name !== undefined) {
						functionType.getParameterType(arg.name).constrainWithLowerBound(argNode.info.typeVariable);
					} else {
						functionType.getParameterType(index).constrainWithLowerBound(argNode.info.typeVariable);
					}
				}

				node.info.typeVariable.constrainFromBothSides(functionType.returnType);
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
		varNameNode.info.typeVariable.constrainWithUpperBound(new RStringType());

		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const varReadOrigins = this.getOrigins(varName.nodeId)?.filter((origin) => origin.type === OriginType.ReadVariableOrigin);
		for(const readOrigin of varReadOrigins ?? []) {
			const readNode = this.getNormalizedAst(readOrigin.id);
			guard(readNode !== undefined, 'Expected read node to be defined');
			node.info.typeVariable.constrainWithLowerBound(readNode.info.typeVariable);
		}
	}

	override onRmCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.constrainFromBothSides(new RNullType());
	}

	override onForLoopCall(data: { call: DataflowGraphVertexFunctionCall, variable: FunctionArgument, vector: FunctionArgument, body: FunctionArgument }) {
		guard(data.variable !== EmptyArgument && data.vector !== EmptyArgument, 'Expected variable and vector arguments to be defined');
		const variableNode = this.getNormalizedAst(data.variable.nodeId);
		const vectorNode = this.getNormalizedAst(data.vector.nodeId);
		guard(variableNode !== undefined && vectorNode !== undefined, 'Expected variable and vector nodes to be defined');
		
		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		vectorNode.info.typeVariable.constrainWithUpperBound(vectorType);
		variableNode.info.typeVariable.constrainWithLowerBound(elementType);

		this.onLoopCall(data);
	}

	override onWhileLoopCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, body: FunctionArgument }) {
		guard(data.condition !== EmptyArgument, 'Expected condition argument to be defined');
		const conditionNode = this.getNormalizedAst(data.condition.nodeId);
		
		guard(conditionNode !== undefined, 'Expected condition node to be defined');
		conditionNode.info.typeVariable.constrainWithUpperBound(new RLogicalType());

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
		const isInfinite = (cfgVertex.end ?? []).reduce((prevCount, id) => prevCount + (this.config.controlFlow.graph.outgoingEdges(id)?.size ?? 0), 0) === 0;

		if(isInfinite) {
			node.info.typeVariable.constrainFromBothSides(new UnresolvedRTypeUnion());
		} else {
			node.info.typeVariable.constrainFromBothSides(new RNullType());
		}
	}

	override onIfThenElseCall(data: { call: DataflowGraphVertexFunctionCall, condition: NodeId | undefined, then: NodeId | undefined, else: NodeId | undefined }) {
		guard(data.condition !== undefined, 'Expected condition argument to be defined');
		const conditionNode = this.getNormalizedAst(data.condition);
		
		guard(conditionNode !== undefined, 'Expected condition node to be defined');
		conditionNode.info.typeVariable.constrainWithUpperBound(new RLogicalType());
		
		const cfgVertex = this.config.controlFlow.graph.getVertex(data.call.id);
		guard(cfgVertex !== undefined && (cfgVertex.type === CfgVertexType.Statement || cfgVertex.type === CfgVertexType.Expression),
			'Expected statement or expression vertex for if-then-else');
		const cfgEndVertexId = cfgVertex.end?.at(0);
		guard(cfgEndVertexId !== undefined && cfgVertex.end?.length === 1, 'Expected exactly one end vertex for if-then-else');
		
		const isThenBranchReachable = this.config.controlFlow.graph.outgoingEdges(data.then ?? cfgEndVertexId)?.values().some((edge) => {
			return edge.label === CfgEdgeType.Cd && edge.when === RTrue;
		}) ?? false;
		const isElseBranchReachable = this.config.controlFlow.graph.outgoingEdges(data.else ?? cfgEndVertexId)?.values().some((edge) =>{
			return edge.label === CfgEdgeType.Cd && edge.when === RFalse;
		}) ?? false;

		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		
		if(isThenBranchReachable) {
			if(data.then !== undefined) {	
				const thenNode = this.getNormalizedAst(data.then);
				guard(thenNode !== undefined, 'Expected then node to be defined');
				node.info.typeVariable.constrainWithLowerBound(thenNode.info.typeVariable);
				if(!isElseBranchReachable) {
					node.info.typeVariable.constrainWithUpperBound(thenNode.info.typeVariable);
				}
			} else {
				// If there is no then branch, we can assume that the type is null
				node.info.typeVariable.constrainWithLowerBound(new RNullType());
				if(!isElseBranchReachable) {
					node.info.typeVariable.constrainWithUpperBound(new RNullType());
				}
			}
		}
		if(isElseBranchReachable) {
			if(data.else !== undefined) {
				const elseNode = this.getNormalizedAst(data.else);
				guard(elseNode !== undefined, 'Expected else node to be defined');
				node.info.typeVariable.constrainWithLowerBound(elseNode.info.typeVariable);
				if(!isThenBranchReachable) {
					node.info.typeVariable.constrainWithUpperBound(elseNode.info.typeVariable);
				}
			} else {
				// If there is no else branch, we can assume that the type is null
				node.info.typeVariable.constrainWithLowerBound(new RNullType());
				if(!isThenBranchReachable) {
					node.info.typeVariable.constrainWithUpperBound(new RNullType());
				}
			}
		}
		if(!isThenBranchReachable && !isElseBranchReachable) {
			// If neither branch is reachable, we can assume that the type is none
			node.info.typeVariable.constrainFromBothSides(new UnresolvedRTypeUnion());
		}	
	}
	
	override onQuoteCall(data: { call: DataflowGraphVertexFunctionCall }) {
		guard(data.call.args.length === 1, 'Expected exactly one argument for quote call');
		const arg = data.call.args.at(0);
		guard(arg !== undefined && arg !== EmptyArgument, 'Expected argument of quote call to be defined');

		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		node.info.typeVariable.constrainFromBothSides(new RLanguageType());
	}

	override onEvalFunctionCall(data: { call: DataflowGraphVertexFunctionCall }) {
		guard(data.call.args.length === 1, 'Expected exactly one argument for eval call');
		const arg = data.call.args.at(0);
		
		guard(arg !== undefined && arg !== EmptyArgument, 'Expected argument of eval call to be defined');
		const argNode = this.getNormalizedAst(arg.nodeId);
		
		guard(argNode !== undefined, 'Expected argument node to be defined');
		argNode.info.typeVariable.constrainWithUpperBound(new RLanguageType());
	}

	override onListCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		
		const listType = new UnresolvedRListType();
		node.info.typeVariable.constrainFromBothSides(listType);

		for(const arg of data.call.args) {
			if(arg === EmptyArgument) {
				continue; // Skip empty arguments
			}
			const argNode = this.getNormalizedAst(arg.nodeId);
			guard(argNode !== undefined, 'Expected argument node to be defined');
			listType.elementType.constrainWithLowerBound(argNode.info.typeVariable);
		}
	}

	override onVectorCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');
		
		const args = data.call.args.filter((arg) => arg !== EmptyArgument);
		if(args.length === 0) {
			node.info.typeVariable.constrainFromBothSides(new RNullType());
			return;
		}
		
		// TODO: Handle flattening behavior of `c` function
		const vectorType = new UnresolvedRAtomicVectorType();
		node.info.typeVariable.constrainFromBothSides(vectorType);
		
		for(const arg of args) {
			const argNode = this.getNormalizedAst(arg.nodeId);
			guard(argNode !== undefined, 'Expected argument node to be defined');
			vectorType.elementType.constrainWithLowerBound(argNode.info.typeVariable);
		}
	}

	override onFunctionDefinition(data: { vertex: DataflowGraphVertexFunctionDefinition }): void {
		const node = this.getNormalizedAst(data.vertex.id);
		guard(node !== undefined && node.type === RType.FunctionDefinition, 'Expected AST node to be a function definition');

		const functionType = new UnresolvedRFunctionType();
		node.info.typeVariable.constrainWithLowerBound(functionType);

		let dotsEncountered = false;
		for(const [index, param] of node.parameters.entries()) {
			if(param.special) {
				dotsEncountered = true;
				continue; // Skip `...` parameters
			}

			if(!dotsEncountered) {
				// Only constrain the parameter type positionally if no `...` has been encountered yet
				functionType.getParameterType(index).constrainWithUpperBound(param.info.typeVariable);
			}
			functionType.getParameterType(param.name.lexeme).constrainWithUpperBound(param.info.typeVariable);
			
			if(param.defaultValue !== undefined) {
				param.info.typeVariable.constrainWithLowerBound(param.defaultValue.info.typeVariable);
			}
		}
	}

	override onProgram(node: RExpressionList<UnresolvedTypeInfo>) {
		const exitPoints = this.config.dataflowInfo.exitPoints;
		const evalCandidates = exitPoints.map((exitPoint) => exitPoint.nodeId);

		if(evalCandidates.length === 0) {
			node.info.typeVariable.constrainFromBothSides(new RNullType());
			return;
		}

		for(const candidateId of evalCandidates) {
			const candidate = this.getNormalizedAst(candidateId);
			guard(candidate !== undefined, 'Expected target node to be defined');
			node.info.typeVariable.constrainWithLowerBound(candidate.info.typeVariable);
		}
	}

	override onExpressionList(data: { call: DataflowGraphVertexFunctionCall }) {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const outgoing = this.config.dataflowInfo.graph.outgoingEdges(data.call.id);
		const evalCandidates = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Returns))
			.map(([target, _edge]) => target)
			.toArray();

		if(evalCandidates === undefined || evalCandidates.length === 0) {
			node.info.typeVariable.constrainFromBothSides(new RNullType());
			return;
		}

		for(const candidateId of evalCandidates) {
			const candidate = this.getNormalizedAst(candidateId);
			guard(candidate !== undefined, 'Expected target node to be defined');
			node.info.typeVariable.constrainWithLowerBound(candidate.info.typeVariable);
		}
	}

	override onAccessCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const firstArg = data.call.args.at(0);
		guard(firstArg !== undefined && firstArg !== EmptyArgument, 'Expected first argument of access call to be defined');
		const firstArgNode = this.getNormalizedAst(firstArg.nodeId);
		guard(firstArgNode !== undefined, 'Expected first argument node to be defined');

		// TODO: Handle subsetting for other operand types, in particular for scalars and null
		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		firstArgNode.info.typeVariable.constrainWithUpperBound(vectorType);
		
		switch(data.call.name) {
			case '[':
				// If the access call is a `[` operation, we can assume that the it returns a subset
				// of the first argument's elements as another instance of the same container type
				node.info.typeVariable.constrainWithLowerBound(firstArgNode.info.typeVariable);
				break;
			case '[[':
				node.info.typeVariable.constrainWithLowerBound(elementType);
				break;
			case '$': {
				firstArgNode.info.typeVariable.constrainWithUpperBound(new UnresolvedRListType(elementType));
				node.info.typeVariable.constrainWithLowerBound(elementType);
				break;
			}
		}
	}
}