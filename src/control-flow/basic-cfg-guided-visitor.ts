import {
	type CfgBasicBlockVertex, type CfgMarkerVertex, type CfgExpressionVertex,
	CfgVertex,
	type CfgStatementVertex,
	type ControlFlowInformation
	, CfgVertexType
} from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { assertUnreachable } from '../util/assert';

export interface BasicCfgGuidedVisitorConfiguration<
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
> {
	readonly controlFlow:          ControlFlow;
	readonly defaultVisitingOrder: 'forward' | 'backward';
}

/**
 * In contrast to {@link visitCfgInOrder} and {@link visitCfgInReverseOrder}, this visitor is not a simple visitor
 * and serves as the basis for a variety of more complicated visiting orders of the control flow graph.
 * It includes features to provide additional information using the {@link NormalizedAst} and the {@link DataflowGraph}.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class BasicCfgGuidedVisitor<
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Config extends BasicCfgGuidedVisitorConfiguration<ControlFlow> = BasicCfgGuidedVisitorConfiguration<ControlFlow>
> {

	protected readonly config:  Config;
	protected readonly visited: Map<NodeId, number>;

	constructor(config: Config) {
		this.config = { ...config };
		this.visited = new Map<NodeId, number>();
	}

	/**
	 * call this function to indicate that a node is to be considered visited.
	 * @returns `true` if the node was not visited before, `false` otherwise
	 */
	protected visitNode(node: NodeId): boolean {
		if(this.visited.has(node)) {
			return false;
		}
		this.visited.set(node, 1);
		this.onVisitNode(node);
		return true;
	}

	protected startVisitor(start: readonly NodeId[]): void {
		const graph = this.config.controlFlow.graph;
		let getNext: (node: NodeId) => MapIterator<NodeId> | NodeId[] | undefined;
		if(this.config.defaultVisitingOrder === 'forward') {
			getNext = (node: NodeId) => graph.ingoingEdges(node)?.keys().toArray().reverse();
		} else {
			getNext = (node: NodeId) => graph.outgoingEdges(node)?.keys();
		}
		const stack = Array.from(start);
		while(stack.length > 0) {
			const current = stack.pop() as NodeId;

			if(!this.visitNode(current)) {
				continue;
			}
			for(const next of getNext(current) ?? []) {
				stack.push(next);
			}
		}
	}

	/**
	 * Start the visiting process.
	 */
	public start(): void {
		this.startVisitor(this.config.defaultVisitingOrder === 'forward' ? this.config.controlFlow.entryPoints : this.config.controlFlow.exitPoints);
	}

	/**
	 * Get the control flow vertex for the given node id or fail if it does not exist.
	 */
	protected getCfgVertex(id: NodeId): CfgVertex | undefined {
		return this.config.controlFlow.graph.getVertex(id);
	}


	protected onVisitNode(node: NodeId): void {
		const vertex = this.getCfgVertex(node);
		if(vertex === undefined) {
			return;
		}
		const type = CfgVertex.getType(vertex);
		switch(type) {
			case CfgVertexType.Statement:
				this.onStatementNode(vertex as CfgStatementVertex);
				break;
			case CfgVertexType.Expression:
				this.onExpressionNode(vertex as CfgExpressionVertex);
				break;
			case CfgVertexType.Marker:
				this.onEndMarkerNode(vertex as CfgMarkerVertex);
				break;
			case CfgVertexType.Block:
				this.onBasicBlockNode(vertex as CfgBasicBlockVertex);
				break;
			default:
				assertUnreachable(type);
		}
	}

	protected onBasicBlockNode(node: CfgBasicBlockVertex): void {
		const elems = CfgVertex.getBasicBlockElements(node);
		if(this.config.defaultVisitingOrder === 'forward') {
			for(const elem of elems.toReversed()) {
				this.visitNode(CfgVertex.getId(elem));
			}
		} else {
			for(const elem of elems) {
				this.visitNode(CfgVertex.getId(elem));
			}
		}
	}

	protected onStatementNode(_node: CfgStatementVertex): void {
		/* does nothing by default */
	}

	protected onExpressionNode(_node: CfgExpressionVertex): void {
		/* does nothing by default */
	}

	protected onEndMarkerNode(_node: CfgMarkerVertex): void {
		/* does nothing by default */
	}
}