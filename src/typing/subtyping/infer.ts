import { extractCfg } from '../../control-flow/extract-cfg';
import type { SemanticCfgGuidedVisitorConfiguration } from '../../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexUse, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { DataflowInformation } from '../../dataflow/info';
import type { RLogical } from '../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { mapNormalizedAstInfo } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataTypeInfo } from '../types';
import { RComplexType, RDoubleType, RIntegerType, RLogicalType, RStringType, RNullType, RS4Type, REnvironmentType } from '../types';
import type { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { guard } from '../../util/assert';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeIncludesType, EdgeType } from '../../dataflow/graph/edge';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { FunctionArgument } from '../../dataflow/graph/graph';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { CfgEdgeType, CfgVertexType } from '../../control-flow/control-flow-graph';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFalse, RTrue } from '../../r-bridge/lang-4.x/convert-values';
import type { UnresolvedDataType } from './types';
import { constrain, getIndexedElementTypeFromList, getParameterTypeFromFunction, prune, resolve, UnresolvedRAtomicVectorType, UnresolvedRFunctionType, UnresolvedRListType, UnresolvedRTypeIntersection, UnresolvedRTypeUnion, UnresolvedRTypeVariable } from './types';
import { defaultConfigOptions } from '../../config';


export function inferDataTypes<Info extends ParentInformation & { typeVariable?: undefined }>(ast: NormalizedAst<ParentInformation & Info>, dataflowInfo: DataflowInformation, knownTypes: Map<string, Set<UnresolvedDataType>> = new Map()): NormalizedAst<Info & DataTypeInfo> {
	const astWithTypeVars = decorateTypeVariables(ast);
	const controlFlowInfo = extractCfg(astWithTypeVars, defaultConfigOptions, dataflowInfo.graph, ['unique-cf-sets', 'analyze-dead-code', 'remove-dead-code']);
	const config = {
		normalizedAst:        astWithTypeVars,
		controlFlow:          controlFlowInfo,
		dataflowInfo:         dataflowInfo,
		dfg:                  dataflowInfo.graph,
		defaultVisitingOrder: 'forward' as const,
		flowrConfig:          defaultConfigOptions,
		knownTypes,
	};
	const visitor = new TypeInferringCfgGuidedVisitor(config);
	visitor.start();

	return resolveTypeVariables(astWithTypeVars);
}

type UnresolvedTypeInfo = {
	typeVariable: UnresolvedRTypeVariable;
};

function decorateTypeVariables<Info extends ParentInformation>(ast: NormalizedAst<Info>): NormalizedAst<Info & UnresolvedTypeInfo> {
	return mapNormalizedAstInfo(ast, node => ({ ...node.info, typeVariable: new UnresolvedRTypeVariable() }));
}

function resolveTypeVariables<Info extends ParentInformation & UnresolvedTypeInfo>(ast: NormalizedAst<Info>): NormalizedAst<Omit<Info, keyof UnresolvedTypeInfo> & DataTypeInfo> {
	return mapNormalizedAstInfo(ast, node => {
		const { typeVariable, ...rest } = node.info;
		return { ...rest, inferredType: resolve(typeVariable, undefined) };
	});
}

export interface TypeInferringCfgGuidedVisitorConfiguration<
	OtherInfo                                                 = NoInfo,
	ControlFlow extends ControlFlowInformation                = ControlFlowInformation,
	Ast extends NormalizedAst<UnresolvedTypeInfo & OtherInfo> = NormalizedAst<UnresolvedTypeInfo & OtherInfo>,
	Dataflow extends DataflowInformation                      = DataflowInformation
> extends Omit<SemanticCfgGuidedVisitorConfiguration<UnresolvedTypeInfo & OtherInfo, ControlFlow, Ast>, 'dataflow'> {
	dataflowInfo: Dataflow;
	knownTypes:   Map<string, Set<UnresolvedDataType>>;
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

		Error.stackTraceLimit = 100; // Increase stack trace limit for better debugging
	}

	protected constraintCache:   Map<UnresolvedDataType, Set<UnresolvedDataType>> = new Map();
	protected prunableVariables: Set<UnresolvedRTypeVariable> = new Set();


	protected constrainNodeType(nodeOrId: RNode<UnresolvedTypeInfo> | NodeId, constraint: UnresolvedDataType | { lowerBound?: UnresolvedDataType, upperBound?: UnresolvedDataType }): void {
		const node = typeof nodeOrId === 'object' ? nodeOrId : this.getNormalizedAst(nodeOrId);
		guard(node !== undefined, 'Expected AST node to be defined');

		const lowerBound = 'tag' in constraint ? constraint : constraint.lowerBound;
		const upperBound = 'tag' in constraint ? constraint : constraint.upperBound;

		if(lowerBound !== undefined) {
			constrain(lowerBound, node.info.typeVariable, this.constraintCache, this.prunableVariables);
		}
		if(upperBound !== undefined) {
			constrain(node.info.typeVariable, upperBound, this.constraintCache, this.prunableVariables);
		}
	}

	
	override start(): void {
		super.start();
		this.onVisitorEnd();
	}

	protected override onNullConstant(data: { vertex: DataflowGraphVertexValue, node: RSymbol<UnresolvedTypeInfo, 'NULL'>; }): void {
		this.constrainNodeType(data.node, new RNullType());
	}

	override onLogicalConstant(data: { vertex: DataflowGraphVertexValue, node: RLogical<UnresolvedTypeInfo> }): void {
		this.constrainNodeType(data.node, new RLogicalType());
	}

	override onNumberConstant(data: { vertex: DataflowGraphVertexValue, node: RNumber<UnresolvedTypeInfo> }): void {
		if(data.node.content.complexNumber) {
			this.constrainNodeType(data.node, new RComplexType());
		} else if(data.node.content.markedAsInt) {
			this.constrainNodeType(data.node, new RIntegerType());
		} else {
			this.constrainNodeType(data.node, new RDoubleType());
		}
	}

	override onStringConstant(data: { vertex: DataflowGraphVertexValue, node: RString<UnresolvedTypeInfo> }): void {
		this.constrainNodeType(data.node, new RStringType());
	}

	protected inferNodeTypeFromReadOrigins(node: RNode<UnresolvedTypeInfo>, readOrigins: Array<{ id: NodeId, type: OriginType }>): void {
		const readOriginNodes = readOrigins.flatMap(origin => this.getNormalizedAst(origin.id) ?? []);

		const lowerBounds = new Set<UnresolvedDataType>();
		
		for(const readNode of readOriginNodes) {
			this.constrainNodeType(node, { lowerBound: readNode.info.typeVariable });
			lowerBounds.add(readNode.info.typeVariable);
		}

		if(readOriginNodes.length === 0) {
			if(node.type === RType.Symbol) {
				// If the read variable has no associated AST node it might be a library constant or function
				const contextualTypes = this.config.knownTypes.get(node.content);
				if(contextualTypes !== undefined && contextualTypes.size > 0) {
					for(const type of contextualTypes) {
						this.constrainNodeType(node, { lowerBound: type });
						lowerBounds.add(type);
					}
				}
			}
		} else {
			const upperBound = lowerBounds.size === 1 ? lowerBounds.values().next().value : new UnresolvedRTypeUnion(...lowerBounds);
			this.constrainNodeType(node, { upperBound });
		}
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
				this.constrainNodeType(node, node.value.info.typeVariable);
			}
			return;
		}

		const readOrigins = this.getOrigins(data.vertex.id)?.filter((origin) => origin.type === OriginType.ReadVariableOrigin) ?? [];
		this.inferNodeTypeFromReadOrigins(node, readOrigins);
	}

	override onAssignmentCall(data: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(data.target === undefined || data.source === undefined) {
			return; // Malformed assignment
		}
		
		const valueNode = this.getNormalizedAst(data.source);
		guard(valueNode !== undefined, 'Expected AST node to be defined');

		this.constrainNodeType(data.target, valueNode.info.typeVariable);
		this.constrainNodeType(data.call.id, valueNode.info.typeVariable);
	}

	override onDefaultFunctionCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		const callTargets = this.getOrigins(data.call.id)?.filter((origin) => origin.type === OriginType.FunctionCallOrigin) ?? [];
		const callTargetNodes = callTargets.flatMap(target => this.getNormalizedAst(target.id) ?? []);
		
		const calledFunctionType = new UnresolvedRTypeVariable();
		
		const templateFunctionType = new UnresolvedRFunctionType();
		for(const [index, arg] of data.call.args.entries()) {
			if(arg === EmptyArgument) {
				continue; // Skip empty arguments
			}

			const argNode = this.getNormalizedAst(arg.nodeId);
			guard(argNode !== undefined, 'Expected argument node to be defined');

			if(arg.name !== undefined) {
				this.constrainNodeType(argNode, getParameterTypeFromFunction(templateFunctionType, arg.name));
			} else {
				this.constrainNodeType(argNode, getParameterTypeFromFunction(templateFunctionType, index));
			}
		}
		constrain(calledFunctionType, templateFunctionType, this.constraintCache, this.prunableVariables);

		for(const targetNode of callTargetNodes) {
			this.constrainNodeType(targetNode, { upperBound: templateFunctionType });
		}
		
		if(callTargetNodes.length === 0) {
			// If the target function has no associated AST node it might be a library function
			const contextualTypes = this.config.knownTypes.get(data.call.name);
			if(contextualTypes !== undefined && contextualTypes.size > 0) {
				// console.log('Constraining node', data.call.id, 'with contextual types for', data.call.name);
				constrain(new UnresolvedRTypeIntersection(...contextualTypes.values()), calledFunctionType, this.constraintCache, this.prunableVariables);
			}
		}

		this.constrainNodeType(data.call.id, templateFunctionType.returnType);
	}

	override onGetCall(data: { call: DataflowGraphVertexFunctionCall }) {
		guard(data.call.args.length == 1, 'Expected exactly one argument for get call');
		const varName = data.call.args.at(0);
		
		guard(varName !== undefined && varName !== EmptyArgument, 'Expected argument of get call to be defined');
		this.constrainNodeType(varName.nodeId, { upperBound: new RStringType() });
		
		const node = this.getNormalizedAst(data.call.id);
		guard(node !== undefined, 'Expected AST node to be defined');

		const varReadOrigins = this.getOrigins(varName.nodeId)?.filter((origin) => origin.type === OriginType.ReadVariableOrigin) ?? [];
		this.inferNodeTypeFromReadOrigins(node, varReadOrigins);
	}

	override onForLoopCall(data: { call: DataflowGraphVertexFunctionCall, variable: FunctionArgument, vector: FunctionArgument, body: FunctionArgument }) {
		guard(data.variable !== EmptyArgument && data.vector !== EmptyArgument, 'Expected variable and vector arguments to be defined');
		const elementType = new UnresolvedRTypeVariable();
		const vectorType = new UnresolvedRTypeUnion(new UnresolvedRAtomicVectorType(elementType), new UnresolvedRListType(elementType));
		this.constrainNodeType(data.vector.nodeId, { upperBound: vectorType });
		this.constrainNodeType(data.variable.nodeId, { lowerBound: elementType });

		this.onLoopCall(data);
	}

	override onWhileLoopCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument, body: FunctionArgument }) {
		guard(data.condition !== EmptyArgument, 'Expected condition argument to be defined');
		this.constrainNodeType(data.condition.nodeId, { upperBound: new RLogicalType() });

		this.onLoopCall(data);
	}

	override onRepeatLoopCall(data: { call: DataflowGraphVertexFunctionCall, body: FunctionArgument }) {
		this.onLoopCall(data);
	}

	protected onLoopCall(data: { call: DataflowGraphVertexFunctionCall, body: FunctionArgument }) {
		const cfgVertex = this.config.controlFlow.graph.getVertex(data.call.id);
		guard(cfgVertex !== undefined && cfgVertex.type === CfgVertexType.Statement, 'Expected statement vertex for loop');
		const isInfinite = (cfgVertex.end ?? []).reduce((prevCount, id) => prevCount + (this.config.controlFlow.graph.outgoingEdges(id)?.size ?? 0), 0) === 0;

		if(isInfinite) {
			this.constrainNodeType(data.call.id, new UnresolvedRTypeUnion());
		} else {
			this.constrainNodeType(data.call.id, new RNullType());
		}
	}

	override onIfThenElseCall(data: { call: DataflowGraphVertexFunctionCall, condition: NodeId | undefined, then: NodeId | undefined, else: NodeId | undefined }) {
		guard(data.condition !== undefined, 'Expected condition argument to be defined');
		this.constrainNodeType(data.condition, { upperBound: new RLogicalType() });

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
		
		if(isThenBranchReachable) {
			if(data.then !== undefined) {	
				const thenNode = this.getNormalizedAst(data.then);
				guard(thenNode !== undefined, 'Expected then node to be defined');
				this.constrainNodeType(data.call.id, { lowerBound: thenNode.info.typeVariable });
				if(!isElseBranchReachable) {
					this.constrainNodeType(data.call.id, { upperBound: thenNode.info.typeVariable });
				}
			} else {
				// If there is no then branch, we can assume that the type is null
				this.constrainNodeType(data.call.id, { lowerBound: new RNullType() });
				if(!isElseBranchReachable) {
					this.constrainNodeType(data.call.id, { upperBound: new RNullType() });
				}
			}
		}
		if(isElseBranchReachable) {
			if(data.else !== undefined) {
				const elseNode = this.getNormalizedAst(data.else);
				guard(elseNode !== undefined, 'Expected else node to be defined');
				this.constrainNodeType(data.call.id, { lowerBound: elseNode.info.typeVariable });
				if(!isThenBranchReachable) {
					this.constrainNodeType(data.call.id, { upperBound: elseNode.info.typeVariable });
				}
			} else {
				// If there is no else branch, we can assume that the type is null
				this.constrainNodeType(data.call.id, { lowerBound: new RNullType() });
				if(!isThenBranchReachable) {
					this.constrainNodeType(data.call.id, { upperBound: new RNullType() });
				}
			}
		}
		if(!isThenBranchReachable && !isElseBranchReachable) {
			// If neither branch is reachable, we can assume that the type is none
			this.constrainNodeType(data.call.id, new UnresolvedRTypeUnion());
		}
	}
	
	override onQuoteCall(data: { call: DataflowGraphVertexFunctionCall }) {
		this.onDefaultFunctionCall(data);
	}

	override onListCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const listType = new UnresolvedRListType();
		this.constrainNodeType(data.call.id, listType);

		for(const [index, arg] of data.call.args.filter((arg) => arg !== EmptyArgument).entries()) {
			const argNode = this.getNormalizedAst(arg.nodeId);
			guard(argNode !== undefined, 'Expected argument node to be defined');
			
			this.constrainNodeType(argNode, { upperBound: getIndexedElementTypeFromList(listType, index, this.constraintCache, this.prunableVariables) });

			if(arg.name !== undefined) {
				this.constrainNodeType(argNode, { upperBound: getIndexedElementTypeFromList(listType, arg.name, this.constraintCache, this.prunableVariables) });
			}
		}
	}

	override onVectorCall(data: { call: DataflowGraphVertexFunctionCall }) {
		const vectorType = new UnresolvedRAtomicVectorType();
		this.constrainNodeType(data.call.id, vectorType);

		for(const arg of data.call.args.filter((arg) => arg !== EmptyArgument)) {
			const argNode = this.getNormalizedAst(arg.nodeId);
			guard(argNode !== undefined, 'Expected argument node to be defined');

			this.constrainNodeType(argNode, { upperBound: vectorType });
		}
	}

	override onFunctionDefinition(data: { vertex: DataflowGraphVertexFunctionDefinition }): void {
		const node = this.getNormalizedAst(data.vertex.id);
		guard(node !== undefined && node.type === RType.FunctionDefinition, 'Expected AST node to be a function definition');

		const functionType = new UnresolvedRFunctionType();
		this.constrainNodeType(node, functionType);

		let dotsEncountered = false;
		for(const [index, param] of node.parameters.entries()) {
			if(param.special) {
				dotsEncountered = true;
				continue; // Skip `...` parameters
			}

			this.constrainNodeType(param, param.name.info.typeVariable); // Ignore laziness of parameters for now

			if(!dotsEncountered) {
				// Only constrain the parameter type positionally if no `...` has been encountered yet
				this.constrainNodeType(param, getParameterTypeFromFunction(functionType, index));
			}
			this.constrainNodeType(param, getParameterTypeFromFunction(functionType, param.name.content));

			if(param.defaultValue !== undefined) {
				this.constrainNodeType(param, { lowerBound: param.defaultValue.info.typeVariable });
			}
		}

		this.constrainNodeType(node.body, functionType.returnType);
	}

	override onProgram(node: RExpressionList<UnresolvedTypeInfo>) {
		const exitPoints = this.config.dataflowInfo.exitPoints;
		const evalCandidates = exitPoints.map((exitPoint) => exitPoint.nodeId);

		if(evalCandidates.length === 0) {
			this.constrainNodeType(node, new RNullType());
			return;
		}

		for(const candidateId of evalCandidates) {
			const candidate = this.getNormalizedAst(candidateId);
			guard(candidate !== undefined, 'Expected target node to be defined');
			this.constrainNodeType(node, { lowerBound: candidate.info.typeVariable });
		}
	}

	override onExpressionList(data: { call: DataflowGraphVertexFunctionCall }) {
		const outgoing = this.config.dataflowInfo.graph.outgoingEdges(data.call.id);
		const evalCandidates = outgoing?.entries()
			.filter(([_target, edge]) => edgeIncludesType(edge.types, EdgeType.Returns))
			.map(([target, _edge]) => target)
			.toArray();

		if(evalCandidates === undefined || evalCandidates.length === 0) {
			this.constrainNodeType(data.call.id, new RNullType());
			return;
		}

		for(const candidateId of evalCandidates) {
			const candidate = this.getNormalizedAst(candidateId);
			guard(candidate !== undefined, 'Expected target node to be defined');
			this.constrainNodeType(data.call.id, { lowerBound: candidate.info.typeVariable });
		}
	}

	override onAccessCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		const firstArg = data.call.args.at(0);
		guard(firstArg !== undefined && firstArg !== EmptyArgument, 'Expected first argument of access call to be defined');
		const firstArgNode = this.getNormalizedAst(firstArg.nodeId);
		guard(firstArgNode !== undefined, 'Expected first argument node to be defined');

		const accessFunction = new UnresolvedRTypeVariable();
		const overloads = new UnresolvedRTypeIntersection();
		const templateFunction = new UnresolvedRFunctionType();

		switch(data.call.name) {
			case '[': {
				if(data.call.args.at(1) === undefined || data.call.args.at(1) === EmptyArgument) {
					overloads.types = new Set([new UnresolvedRFunctionType(new Map([[0, firstArgNode.info.typeVariable]]), firstArgNode.info.typeVariable)]);
					break;
				}
				const vectorSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new UnresolvedRAtomicVectorType()])]]), new UnresolvedRTypeVariable([new UnresolvedRAtomicVectorType()], undefined));
				const listSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new UnresolvedRListType()])]]), new UnresolvedRTypeVariable([new UnresolvedRListType()], undefined));
				const nullSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new RNullType()])]]), new UnresolvedRTypeVariable([new RNullType()], undefined));
				overloads.types = new Set([vectorSignature, listSignature, nullSignature]);
				break;
			}
			case '[[': {
				const elementType = new UnresolvedRTypeVariable();
				const vectorSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new UnresolvedRAtomicVectorType(elementType)])]]), elementType);
				const listSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new UnresolvedRListType(elementType)])]]), elementType);
				const nullSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new RNullType()])]]), new UnresolvedRTypeVariable([new RNullType()], undefined));
				const environmentSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new REnvironmentType()])]]), new UnresolvedRTypeVariable());
				overloads.types = new Set([vectorSignature, listSignature, nullSignature, environmentSignature]);
				break;
			}
			case '$': {
				const indexArg = data.call.args.at(1);
				guard(indexArg !== undefined && indexArg !== EmptyArgument, 'Expected index argument to be defined');
				const indexNode = this.getNormalizedAst(indexArg.nodeId);
				guard(indexNode !== undefined && indexNode.type === RType.Symbol, 'Expected index node to be defined and of type Symbol');
				const index = indexNode.content;
				const elementType = new UnresolvedRTypeVariable();
				const listSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new UnresolvedRListType(undefined, new Map([[index, elementType]]))])]]), elementType);
				const nullSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new RNullType()])]]), new UnresolvedRTypeVariable([new RNullType()], undefined));
				const environmentSignature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new REnvironmentType()])]]), new UnresolvedRTypeVariable());
				overloads.types = new Set([listSignature, nullSignature, environmentSignature]);
				break;
			}
			case '@': {
				// The target of the access call must be an S4 object but we can not make any assumptions about its slots
				const signature = new UnresolvedRFunctionType(new Map([[0, new UnresolvedRTypeVariable(undefined, [new RS4Type()])]]), new UnresolvedRTypeVariable());
				overloads.types = new Set([signature]);
				break;
			}
		}

		constrain(firstArgNode.info.typeVariable, getParameterTypeFromFunction(templateFunction, 0), this.constraintCache, this.prunableVariables);
		this.constrainNodeType(data.call.id, templateFunction.returnType);

		constrain(overloads, accessFunction, this.constraintCache, this.prunableVariables);
		constrain(accessFunction, templateFunction, this.constraintCache, this.prunableVariables);
	}

	protected override onReplacementCall(data: { call: DataflowGraphVertexFunctionCall; source: NodeId | undefined; target: NodeId | undefined; }): void {
		if(data.source === undefined || data.target === undefined) {
			return; // Malformed replacement call
		}

		const targetNode = this.getNormalizedAst(data.target);
		guard(targetNode !== undefined, 'Expected target node to be defined');
		const sourceNode = this.getNormalizedAst(data.source);
		guard(sourceNode !== undefined, 'Expected source node to be defined');

		this.constrainNodeType(data.call.id, sourceNode.info.typeVariable);

		switch(data.call.name) {
			case '[<-': {
				this.constrainNodeType(targetNode, { upperBound: new UnresolvedRTypeUnion(new RNullType(), new UnresolvedRAtomicVectorType(), new UnresolvedRListType()) });
				this.constrainNodeType(sourceNode, { upperBound: new UnresolvedRTypeUnion(new RNullType(), new UnresolvedRAtomicVectorType(), new UnresolvedRListType()) });
				break;
			}
			case '[[<-': {
				this.constrainNodeType(targetNode, { upperBound: new UnresolvedRTypeUnion(new RNullType(), new UnresolvedRAtomicVectorType(), new UnresolvedRListType(), new REnvironmentType()) });
				break;
			}
			case '$<-': {
				this.constrainNodeType(targetNode, { upperBound: new UnresolvedRTypeUnion(new RNullType(), new UnresolvedRListType(), new REnvironmentType()) });
				break;
			}
			case '@<-': {
				this.constrainNodeType(targetNode, { upperBound: new RS4Type() });
				break;
			}
		}
	}

	protected override onApplyFunctionCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		this.onDefaultFunctionCall(data);
	}

	protected onVisitorEnd(): void {
		let newConstraintsFound = true;
		while(newConstraintsFound) {
			newConstraintsFound = false;
			for(const type of this.prunableVariables) {
				newConstraintsFound ||= prune(type, this.constraintCache, this.prunableVariables);
			}
		}
	}
}