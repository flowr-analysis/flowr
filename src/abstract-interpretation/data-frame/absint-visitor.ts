import { defaultConfigOptions } from '../../config';
import type { CfgBasicBlockVertex, CfgSimpleVertex, ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { CfgVertexType, isMarkerVertex } from '../../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { VertexType } from '../../dataflow/graph/vertex';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isNotUndefined } from '../../util/assert';
import type { AbstractInterpretationInfo } from './absint-info';
import type { DataFrameDomain, DataFrameStateDomain } from './domain';
import { DataFrameTop, equalDataFrameState, joinDataFrames, joinDataFrameStates, wideningDataFrameStates } from './domain';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { mapDataFrameVariableAssignment } from './mappers/assignment-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';
import { mapDataFrameReplacementFunction } from './mappers/replacement-mapper';
import { applySemantics, ConstraintType, getConstraintType } from './semantics';

export interface DataFrameAbsintVisitorConfiguration<
	OtherInfo = NoInfo,
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo>       = NormalizedAst<OtherInfo>,
	Dfg extends DataflowGraph                  = DataflowGraph
> extends Omit<SemanticCfgGuidedVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg>, 'defaultVisitingOrder' | 'defaultVisitingType'> {
    readonly wideningThreshold?: number;
}

const DefaultWideningThreshold = 4;

class DataFrameAbsintVisitor<
	OtherInfo = NoInfo,
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo & AbstractInterpretationInfo> = NormalizedAst<OtherInfo & AbstractInterpretationInfo>,
	Dfg extends DataflowGraph = DataflowGraph,
	Config extends DataFrameAbsintVisitorConfiguration<OtherInfo & AbstractInterpretationInfo, ControlFlow, Ast, Dfg> = DataFrameAbsintVisitorConfiguration<OtherInfo & AbstractInterpretationInfo, ControlFlow, Ast, Dfg>
> extends SemanticCfgGuidedVisitor<OtherInfo & AbstractInterpretationInfo, ControlFlow, Ast, Dfg, Config & { defaultVisitingOrder: 'forward' } & { defaultVisitingType: 'exit' }> {
	private oldDomain: DataFrameStateDomain = new Map();
	private newDomain: DataFrameStateDomain = new Map();

	constructor(config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });
	}

	protected override visitNode(nodeId: NodeId): boolean {
		const vertex = this.getCfgVertex(nodeId);

		if(vertex === undefined || this.shouldSkipVertex(vertex)) {
			return true;
		}
		const predecessors = this.getPredecessorNodes(vertex.id);
		this.newDomain = joinDataFrameStates(...predecessors.map(node => node.info.dataFrame?.domain ?? new Map()));
		this.onVisitNode(nodeId);
		const visitedCount = this.visited.get(vertex.id) ?? 0;
		this.visited.set(vertex.id, visitedCount + 1);

		if(visitedCount >= (this.config.wideningThreshold ?? DefaultWideningThreshold)) {
			this.newDomain = wideningDataFrameStates(this.oldDomain, this.newDomain);
		}
		return visitedCount === 0 || !equalDataFrameState(this.oldDomain, this.newDomain);
	}

	protected override visitDataflowNode(vertex: Exclude<CfgSimpleVertex, CfgBasicBlockVertex>): void {
		const node = this.getNormalizedAst(isMarkerVertex(vertex) ? vertex.root : vertex.id);

		if(node !== undefined) {
			this.oldDomain = node.info.dataFrame?.domain ?? new Map<NodeId, DataFrameDomain>();
			super.visitDataflowNode(vertex);
			node.info.dataFrame ??= {};
			node.info.dataFrame.domain = this.newDomain;
		}
	}

	protected override onAssignmentCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		const node = this.getNormalizedAst(call.id);
		const targetNode = target !== undefined ? this.getNormalizedAst(target) : undefined;
		const sourceNode = source !== undefined ? this.getNormalizedAst(source) : undefined;

		if(node !== undefined && (targetNode?.type === RType.Symbol || targetNode?.type === RType.String) && sourceNode !== undefined) {
			node.info.dataFrame = mapDataFrameVariableAssignment(targetNode, sourceNode, this.config.dfg);
			this.processOperation(node);
		}
	}

	protected override onAccessCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		const node = this.getNormalizedAst(call.id);

		if(node !== undefined) {
			node.info.dataFrame = mapDataFrameAccess(node, this.config.dfg);
			this.processOperation(node);
		}
	}

	protected override onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		const node = this.getNormalizedAst(call.id);

		if(node !== undefined) {
			node.info.dataFrame = mapDataFrameFunctionCall(node, this.config.dfg);
			this.processOperation(node);
		}
	}

	protected override onReplacementCall({ call, source }: { call: DataflowGraphVertexFunctionCall, source: NodeId | undefined, target: NodeId | undefined }): void {
		const node = this.getNormalizedAst(call.id);
		const sourceNode = source !== undefined ? this.getNormalizedAst(source) : undefined;

		if(node !== undefined && sourceNode !== undefined) {
			node.info.dataFrame = mapDataFrameReplacementFunction(node, sourceNode, this.config.dfg);
			this.processOperation(node);
		}
	}

	private processOperation(node: RNode<ParentInformation & AbstractInterpretationInfo>) {
		if(node.info.dataFrame?.type === 'assignment') {
			const value = resolveIdToAbstractValue(node.info.dataFrame.expression, this.config.dfg, this.newDomain);

			if(value !== undefined) {
				this.newDomain.set(node.info.dataFrame.identifier, value);
				const identifier = this.getNormalizedAst(node.info.dataFrame.identifier);

				if(identifier !== undefined) {
					identifier.info.dataFrame ??= {};
					identifier.info.dataFrame.domain = new Map(this.newDomain);
				}
				this.newDomain.set(node.info.id, value);
			}
		} else if(node.info.dataFrame?.type === 'expression') {
			let value = DataFrameTop;

			for(const operation of node.info.dataFrame.operations) {
				const operandValue = operation.operand ? resolveIdToAbstractValue(operation.operand, this.config.dfg, this.newDomain) : value;
				value = applySemantics(operation.operation, operandValue ?? DataFrameTop, operation.args);

				if(operation.operand !== undefined && getConstraintType(operation.operation) === ConstraintType.OperandModification) {
					this.newDomain.set(operation.operand, value);
					getOriginInDfg(this.config.dfg, operation.operand)
						?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
						.forEach(origin => this.newDomain.set(origin.id, value));
				}
			}
			if(node.info.dataFrame.operations.some(operation => getConstraintType(operation.operation) === ConstraintType.ResultPostcondition)) {
				this.newDomain.set(node.info.id, value);
			}
		}
	}

	// We only process vertices of leaf nodes and exit vertices (no entry nodes of complex nodes)
	private shouldSkipVertex(vertex: CfgSimpleVertex) {
		return isMarkerVertex(vertex) ? vertex.type !== CfgVertexType.EndMarker : vertex.end !== undefined;
	}

	private getPredecessorNodes(vertexId: NodeId): RNode<ParentInformation & AbstractInterpretationInfo>[] {
		return this.config.controlFlow.graph.outgoingEdges(vertexId)?.keys()  // outgoing dependency edges are incoming CFG edges
			.map(id => this.getCfgVertex(id))
			.flatMap(vertex => {
				if(vertex !== undefined && this.shouldSkipVertex(vertex)) {
					return this.getPredecessorNodes(vertex.id);
				} else if(vertex?.type === CfgVertexType.EndMarker) {
					const nodeId = vertex.root;
					return nodeId ? [this.getNormalizedAst(nodeId)] : [];
				} else {
					return vertex ? [this.getNormalizedAst(vertex.id)] : [];
				}
			})
			.filter(node => node !== undefined)
			.toArray() ?? [];
	}
}

export function performDataFrameAbsint(
	cfinfo: ControlFlowInformation,
	dfg: DataflowGraph,
	ast: NormalizedAst<ParentInformation & AbstractInterpretationInfo>
): DataFrameStateDomain {
	const visitor = new DataFrameAbsintVisitor({ controlFlow: cfinfo, dfg: dfg, normalizedAst: ast, flowrConfig: defaultConfigOptions });
	visitor.start();
	const exitPoints = cfinfo.exitPoints.map(id => cfinfo.graph.getVertex(id)).filter(isNotUndefined);
	const exitNodes = exitPoints.map(vertex => ast.idMap.get(isMarkerVertex(vertex) ? vertex.root : vertex.id)).filter(isNotUndefined);
	const result = exitNodes.map(node => node.info.dataFrame?.domain ?? new Map());

	return joinDataFrameStates(...result);
}

export function resolveIdToAbstractValue(
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
		const values = getOriginInDfg(dfg, node.info.id)
			?.filter(entry => entry.type === OriginType.ReadVariableOrigin)
			.map(entry => resolveIdToAbstractValue(entry.id, dfg, domain));

		if(values?.every(isNotUndefined)) {
			return joinDataFrames(...values);
		}
	} else if(node.type === RType.Argument && node.value !== undefined) {
		return resolveIdToAbstractValue(node.value, dfg, domain);
	} else if(node.type === RType.ExpressionList && node.children.length > 0) {
		return resolveIdToAbstractValue(node.children[node.children.length - 1], dfg, domain);
	} else if(node.type === RType.Pipe) {
		return resolveIdToAbstractValue(node.rhs, dfg, domain);
	} else if(origins.includes('builtin:pipe')) {
		if(node.type === RType.BinaryOp) {
			return resolveIdToAbstractValue(node.rhs, dfg, domain);
		} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
			return resolveIdToAbstractValue(call.args[1].nodeId, dfg, domain);
		}
	} else if(node.type === RType.IfThenElse) {
		if(node.otherwise === undefined) {
			return resolveIdToAbstractValue(node.then, dfg, domain) !== undefined ? DataFrameTop : undefined;
		} else {
			const values = [node.then, node.otherwise].map(entry => resolveIdToAbstractValue(entry, dfg, domain));

			if(values.every(isNotUndefined)) {
				return joinDataFrames(...values);
			}
		}
	} else if(origins.includes('builtin:if-then-else') && call?.args.every(arg => arg !== EmptyArgument)) {
		if(call.args.length === 2) {
			return resolveIdToAbstractValue(call.args[1].nodeId, dfg, domain) !== undefined ? DataFrameTop : undefined;
		} else if(call.args.length === 3) {
			const values = call.args.slice(1, 3).map(entry => resolveIdToAbstractValue(entry.nodeId, dfg, domain));

			if(values.every(isNotUndefined)) {
				return joinDataFrames(...values);
			}
		}
	}
}
