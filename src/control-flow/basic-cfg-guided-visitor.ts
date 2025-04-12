import type { CfgVertex, ControlFlowInformation } from './control-flow-graph';
import { CfgVertexType } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

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
	protected readonly visited: WeakMap<NodeId, number>;

	/** provides the next node to visit */
	protected visit: Generator<NodeId>;

	constructor(config: Config) {
		this.config = { ...config };
		// TODO: as an optimization invert the CFG when default order is forward
		this.visited = new WeakMap<NodeId, number>();
		this.visit = this.makeVisitGenerator(this.config.defaultVisitingOrder === 'forward' ? this.config.controlFlow.entryPoints : this.config.controlFlow.exitPoints);
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

	protected *makeVisitGenerator(start: readonly NodeId[]): Generator<NodeId> {
		const g = this.config.controlFlow.graph;
		const n = this.config.defaultVisitingOrder === 'forward' ?
			(n: NodeId) => g.ingoing(n) :
			(n: NodeId) => g.outgoing(n);
		const queue = [...start];
		while(queue.length > 0) {
			const current = queue.shift() as NodeId;
			yield current;
			if(!this.visitNode(current)) {
				continue;
			}
			const outgoing = n(current) ?? [];
			for(const [to] of outgoing) {
				queue.push(to);
			}
		}
	}

	/**
     * Start the visiting process.
     */
	public start(): void {
		this.visit.next();
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
		switch(vertex.type) {
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
			default:
				throw new Error(`Unknown vertex type ${JSON.stringify(vertex)}`);
		}
	}

	protected onStatementNode(_node: CfgVertex): void {
		/* does nothing by default */
	}

	protected onExpressionNode(_node: CfgVertex): void {
		/* does nothing by default */
	}

	protected onMidMarkerNode(_node: CfgVertex): void {
		/* does nothing by default */
	}

	protected onEndMarkerNode(_node: CfgVertex): void {
		/* does nothing by default */
	}
}