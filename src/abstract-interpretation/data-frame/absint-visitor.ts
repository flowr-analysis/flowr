import type { CfgBasicBlockVertex, CfgSimpleVertex, ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { CfgVertexType, getVertexRootId, isMarkerVertex } from '../../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexVariableDefinition } from '../../dataflow/graph/vertex';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isNotUndefined } from '../../util/assert';
import { DataFrameInfoMarker, hasDataFrameAssignmentInfo, hasDataFrameExpressionInfo, hasDataFrameInfoMarker, type AbstractInterpretationInfo, type DataFrameAssignmentInfo, type DataFrameExpressionInfo } from './absint-info';
import type { DataFrameDomain, DataFrameStateDomain } from './domain';
import { DataFrameTop, equalDataFrameState, joinDataFrameStates, wideningDataFrameStates } from './domain';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { isAssignmentTarget, mapDataFrameVariableAssignment } from './mappers/assignment-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';
import { mapDataFrameReplacementFunction } from './mappers/replacement-mapper';
import { applySemantics, ConstraintType, getConstraintType } from './semantics';
import { getVariableOrigins, resolveIdToDataFrameShape } from './shape-inference';

export type DataFrameShapeInferenceVisitorConfiguration<
	OtherInfo = NoInfo,
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo & AbstractInterpretationInfo> = NormalizedAst<OtherInfo & AbstractInterpretationInfo>,
	Dfg extends DataflowGraph = DataflowGraph
> = Omit<SemanticCfgGuidedVisitorConfiguration<OtherInfo & AbstractInterpretationInfo, ControlFlow, Ast, Dfg>, 'defaultVisitingOrder' | 'defaultVisitingType'>;

/**
 * The control flow graph visitor to infer the shape of data frames using abstract interpretation
 */
export class DataFrameShapeInferenceVisitor<
	OtherInfo = NoInfo,
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo & AbstractInterpretationInfo> = NormalizedAst<OtherInfo & AbstractInterpretationInfo>,
	Dfg extends DataflowGraph = DataflowGraph,
	Config extends DataFrameShapeInferenceVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg> = DataFrameShapeInferenceVisitorConfiguration<OtherInfo, ControlFlow, Ast, Dfg>
> extends SemanticCfgGuidedVisitor<OtherInfo & AbstractInterpretationInfo, ControlFlow, Ast, Dfg, Config & { defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' }> {
	/**
	 * The old domain of an AST node before processing the node retrieved from the attached {@link AbstractInterpretationInfo}.
	 * This is used to check whether the state has changed and successors should be visited again, and is also required for widening.
	 */
	private oldDomain: DataFrameStateDomain = new Map();
	/**
	 * The new domain of an AST node during and after processing the node.
	 * This information is stored in the {@link AbstractInterpretationInfo} afterwards.
	 */
	private newDomain: DataFrameStateDomain = new Map();

	constructor(config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });
	}

	protected override visitNode(nodeId: NodeId): boolean {
		const vertex = this.getCfgVertex(nodeId);

		// skip vertices representing mid markers or entries of complex nodes
		if(vertex === undefined || this.shouldSkipVertex(vertex)) {
			return true;
		}
		const predecessors = this.getPredecessorNodes(vertex.id);
		this.newDomain = joinDataFrameStates(...predecessors.map(node => node.info.dataFrame?.domain ?? new Map<NodeId, DataFrameDomain>()));
		this.onVisitNode(nodeId);

		const visitedCount = this.visited.get(vertex.id) ?? 0;
		this.visited.set(vertex.id, visitedCount + 1);

		// only continue visitor if the node has not been visited before or the data frame value of the node changed
		return visitedCount === 0 || !equalDataFrameState(this.oldDomain, this.newDomain);
	}

	protected override visitDataflowNode(vertex: Exclude<CfgSimpleVertex, CfgBasicBlockVertex>): void {
		const node = this.getNormalizedAst(getVertexRootId(vertex));

		if(node === undefined) {
			return;
		}
		this.oldDomain = node.info.dataFrame?.domain ?? new Map<NodeId, DataFrameDomain>();
		super.visitDataflowNode(vertex);

		if(this.shouldWiden(vertex)) {
			this.newDomain = wideningDataFrameStates(this.oldDomain, this.newDomain);
		}
		node.info.dataFrame ??= {};
		node.info.dataFrame.domain = this.newDomain;
	}

	protected onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		const node = this.getNormalizedAst(vertex.id);

		if(node !== undefined) {
			// mark variable definitions as "unassigned", as the evaluation of the assigned expression is delayed until processing the assignment
			node.info.dataFrame ??= { marker: DataFrameInfoMarker.Unassigned };
		}
	}

	protected override onAssignmentCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		const node = this.getNormalizedAst(call.id);
		const targetNode = this.getNormalizedAst(target);
		const sourceNode = this.getNormalizedAst(source);

		if(node !== undefined && isAssignmentTarget(targetNode) && sourceNode !== undefined) {
			node.info.dataFrame = mapDataFrameVariableAssignment(targetNode, sourceNode, this.config.dfg);
			this.processOperation(node);
			this.clearUnassignedInfo(targetNode);
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
			node.info.dataFrame = mapDataFrameFunctionCall(node, this.config.dfg, this.config.flowrConfig);
			this.processOperation(node);
		}
	}

	protected override onReplacementCall({ call, source, target }: { call: DataflowGraphVertexFunctionCall, source: NodeId | undefined, target: NodeId | undefined }): void {
		const node = this.getNormalizedAst(call.id);
		const targetNode = this.getNormalizedAst(target);
		const sourceNode = this.getNormalizedAst(source);

		if(node !== undefined && targetNode !== undefined && sourceNode !== undefined) {
			node.info.dataFrame = mapDataFrameReplacementFunction(node, sourceNode, this.config.dfg);
			this.processOperation(node);
			this.clearUnassignedInfo(targetNode);
		}
	}

	private processOperation(node: RNode<ParentInformation & AbstractInterpretationInfo>) {
		if(hasDataFrameAssignmentInfo(node)) {
			this.processDataFrameAssignment(node);
		} else if(hasDataFrameExpressionInfo(node)) {
			this.processDataFrameExpression(node);
		}
	}

	private processDataFrameAssignment(node: RNode<ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameAssignmentInfo }>) {
		const value = resolveIdToDataFrameShape(node.info.dataFrame.expression, this.config.dfg, this.newDomain);

		if(value !== undefined) {
			this.newDomain.set(node.info.dataFrame.identifier, value);
			const identifier = this.getNormalizedAst(node.info.dataFrame.identifier);

			if(identifier !== undefined) {
				identifier.info.dataFrame ??= {};
				identifier.info.dataFrame.domain = new Map(this.newDomain);
			}
		}
	}

	private processDataFrameExpression(node: RNode<ParentInformation & AbstractInterpretationInfo & { dataFrame: DataFrameExpressionInfo }>) {
		let value: DataFrameDomain = DataFrameTop;

		for(const { operation, operand, type, options, ...args } of node.info.dataFrame.operations) {
			const operandValue = operand !== undefined ? resolveIdToDataFrameShape(operand, this.config.dfg, this.newDomain) : value;
			value = applySemantics(operation, operandValue ?? DataFrameTop, args, options);
			const constraintType = type ?? getConstraintType(operation);

			if(operand !== undefined && constraintType === ConstraintType.OperandModification) {
				this.newDomain.set(operand, value);

				for(const origin of getVariableOrigins(operand, this.config.dfg)) {
					this.newDomain.set(origin.info.id, value);
				}
			} else if(constraintType === ConstraintType.ResultPostcondition) {
				this.newDomain.set(node.info.id, value);
			}
		}
	}

	/** We only process vertices of leaf nodes and exit vertices (no entry nodes of complex nodes) */
	private shouldSkipVertex(vertex: CfgSimpleVertex) {
		return isMarkerVertex(vertex) ? vertex.type !== CfgVertexType.EndMarker : vertex.end !== undefined;
	}

	/** Get all AST nodes for the predecessor vertices that are leaf nodes and exit vertices */
	private getPredecessorNodes(vertexId: NodeId): RNode<ParentInformation & AbstractInterpretationInfo>[] {
		return this.config.controlFlow.graph.outgoingEdges(vertexId)?.keys()  // outgoing dependency edges are incoming CFG edges
			.map(id => this.getCfgVertex(id))
			.flatMap(vertex => {
				if(vertex === undefined) {
					return [];
				} else if(this.shouldSkipVertex(vertex)) {
					return this.getPredecessorNodes(vertex.id);
				} else {
					return [this.getNormalizedAst(getVertexRootId(vertex))];
				}
			})
			.filter(isNotUndefined)
			.toArray() ?? [];
	}

	private shouldWiden(vertex: Exclude<CfgSimpleVertex, CfgBasicBlockVertex>): boolean {
		return (this.visited.get(vertex.id) ?? 0) >= this.config.flowrConfig.abstractInterpretation.dataFrame.wideningThreshold;
	}

	private clearUnassignedInfo(node: RNode<ParentInformation & AbstractInterpretationInfo>) {
		if(hasDataFrameInfoMarker(node, DataFrameInfoMarker.Unassigned)) {
			if(node.info.dataFrame?.domain !== undefined) {
				node.info.dataFrame = { domain: node.info.dataFrame.domain };
			} else {
				delete node.info.dataFrame;
			}
		}
	}
}
