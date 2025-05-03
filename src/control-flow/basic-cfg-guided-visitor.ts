import type {
	CfgBasicBlockVertex, CfgEndMarkerVertex, CfgExpressionVertex, CfgMidMarkerVertex,
	CfgSimpleVertex,
	CfgStatementVertex,
	ControlFlowInformation
} from './control-flow-graph';
import { CfgVertexType } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { assertUnreachable } from '../util/assert';

export interface BasicCfgGuidedVisitorConfiguration<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
> {
    readonly controlFlow:          Cfg;
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
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Config extends BasicCfgGuidedVisitorConfiguration<Cfg> = BasicCfgGuidedVisitorConfiguration<Cfg>
> {

	protected readonly config:  Config;
	protected readonly visited: Map<NodeId, number>;

	constructor(config: Config) {
		this.config = { ...config };
		// TODO: as an optimization invert the CFG when default order is forward
		this.visited = new Map<NodeId, number>();
	}

	/**
     * call this function to indicate that a node is to be considered visited.
     *
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
		const g = this.config.controlFlow.graph;
		const n = this.config.defaultVisitingOrder === 'forward' ?
			(n: NodeId) => g.ingoing(n) :
			(n: NodeId) => g.outgoing(n);
		const stack = [...start];
		while(stack.length > 0) {
			const current = stack.shift() as NodeId;

			if(!this.visitNode(current)) {
				continue;
			}
			const outgoing = n(current) ?? [];
			for(const [to] of outgoing) {
				stack.unshift(to);
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
	protected getCfgVertex(id: NodeId): CfgSimpleVertex | undefined {
		return this.config.controlFlow.graph.getVertex(id);
	}


	protected onVisitNode(node: NodeId): void {
		const vertex = this.getCfgVertex(node);
		if(vertex === undefined) {
			return;
		}
		const type = vertex.type;
		switch(type) {
			case CfgVertexType.Statement:
				this.onStatementNode(vertex);
				break;
			case CfgVertexType.Expression:
				this.onExpressionNode(vertex);
				break;
			case CfgVertexType.MidMarker:
				this.onMidMarkerNode(vertex);
				break;
			case CfgVertexType.EndMarker:
				this.onEndMarkerNode(vertex);
				break;
			case CfgVertexType.Block:
				this.onBasicBlockNode(vertex);
				break;
			default:
				assertUnreachable(type);
		}
	}

	protected onBasicBlockNode(node: CfgBasicBlockVertex): void {
		if(this.config.defaultVisitingOrder === 'forward') {
			for(const elem of node.elems.toReversed()) {
				this.visitNode(elem.id);
			}
		} else {
			for(const elem of node.elems) {
				this.visitNode(elem.id);
			}
		}
	}

	protected onStatementNode(_node: CfgStatementVertex): void {
		/* does nothing by default */
	}

	protected onExpressionNode(_node: CfgExpressionVertex): void {
		/* does nothing by default */
	}

	protected onMidMarkerNode(_node: CfgMidMarkerVertex): void {
		/* does nothing by default */
	}

	protected onEndMarkerNode(_node: CfgEndMarkerVertex): void {
		/* does nothing by default */
	}
}