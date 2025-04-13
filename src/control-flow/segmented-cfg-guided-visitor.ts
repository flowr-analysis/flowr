import type {
	CfgEndMarkerVertex, CfgExpressionVertex,
	CfgMidMarkerVertex,
	CfgSimpleVertex, CfgStatementVertex,
	ControlFlowInformation
} from './control-flow-graph';
import type { BasicCfgGuidedVisitorConfiguration } from './basic-cfg-guided-visitor';
import { BasicCfgGuidedVisitor } from './basic-cfg-guided-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

export type SegmentedCfgVisitor<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
> = BasicCfgGuidedVisitorConfiguration<Cfg>

/**
 * This extends on the {@link BasicCfgGuidedVisitor} by providing some useful functions to visit the CFG until a certain event occurs.
 */
export class SegmentedCfgGuidedVisitor<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Config extends SegmentedCfgVisitor<Cfg> = SegmentedCfgVisitor<Cfg>
> extends BasicCfgGuidedVisitor<Cfg, Config> {

	// TODO: support nested collections because we will encounter many nested structures
	private collect:        CfgSimpleVertex[] | undefined;
	private trackingStarts: Set<NodeId> | undefined;
	private trackingMids:   Set<NodeId> | undefined;
	private trackingEnds:   Set<NodeId> | undefined;
	private activeCallback: ((nodes: readonly CfgSimpleVertex[]) => void) | undefined;

	/**
	 * From the current node, continue traversal until we reach the corresponding end.
	 *
	 * If the current node does not have any mid markers attached, the collection will work like this:
	 *
	 * - if the node has a corresponding end marker, this will collect all nodes encountered
	 *   until we reach it (or stop, if there are no more vertices to visit and the end marker is not reachable)
	 * - if the node has no corresponding end marker, this will collect only the current marker
	 *
	 * If there are any mid markers, the collection first runs until all of them are collected (or, the end is found).
	 *
	 * For the `backward` visitation order this works the same way, but from the end-marker to the start markers.
	 */
	protected collectUntilCurrentEnds(onCollected: (nodes: readonly CfgSimpleVertex[]) => void): void {
		if(this.config.defaultVisitingOrder === 'forward') {
			this.collectUntilCurrentEndsForward(onCollected);
		} else {
			this.collectUntilCurrentEndsBackward(onCollected);
		}
	}

	/** start a new collection by hooking into the appropriate visiting functions */
	private installCollector(
		starts: readonly NodeId[],
		mids:   readonly NodeId[],
		ends:   readonly NodeId[],
	) {
		this.collect = [];
		this.trackingStarts = new Set(starts);
		this.trackingMids = new Set(mids);
		this.trackingEnds = new Set(ends);
	}

	protected collectUntilCurrentEndsForward(onCollected: (nodes: readonly CfgSimpleVertex[]) => void): void {
		const next = this.visit.next();
		if(next.done) {
			return;
		}
		const vtx = this.getCfgVertex(next.value);
		if(vtx === undefined) {
			return;
		}
		const mids = vtx.mid as NodeId[] | undefined;
		const ends = vtx.end as NodeId[] | undefined ?? [];
		if(ends.length > 0) {
			this.installCollector([], mids ?? [], ends);
			this.activeCallback = onCollected;
		} else {
			onCollected([vtx]);
		}
	}

	protected collectUntilCurrentEndsBackward(onCollected: (nodes: readonly CfgSimpleVertex[]) => void): void {
		const next = this.visit.next();
		if(next.done) {
			return;
		}
		const vtx = this.getCfgVertex(next.value);
		if(vtx === undefined) {
			return;
		}

		const mids = vtx.mid as NodeId[] | undefined;
		const start = vtx.root ? [vtx.root as NodeId] : [];
		if(start.length > 0) {
			this.installCollector(start, mids ?? [], []);
			this.activeCallback = onCollected;
		} else {
			onCollected([vtx]);
		}
		// TODO: handle the case without any remaining vertex
	}

	private atEndOfCollection(): boolean {
		if(this.collect === undefined) {
			return true;
		}
		return this.trackingEnds?.size === 0 && this.trackingStarts?.size === 0;
	}

	private triggerCallback(): void {
		if(this.activeCallback) {
			this.activeCallback(this.collect ?? []);
		}
		this.collect = undefined;
		this.trackingStarts = undefined;
		this.trackingMids = undefined;
		this.trackingEnds = undefined;
		this.activeCallback = undefined;
	}

	private processPotentialStart(node: CfgSimpleVertex): void {
		this.collect?.push(node);
		if(this.trackingStarts?.has(node.id) ?? false) {
			this.trackingStarts?.delete(node.id);
		}
		if(this.atEndOfCollection()) {
			this.triggerCallback();
		}
	}

	protected override onStatementNode(node: CfgStatementVertex): void {
		super.onStatementNode(node);
		this.processPotentialStart(node);
	}

	protected override onExpressionNode(node: CfgExpressionVertex): void {
		super.onExpressionNode(node);
		this.processPotentialStart(node);
	}

	protected override onMidMarkerNode(node: CfgMidMarkerVertex): void {
		super.onMidMarkerNode(node);
		this.collect?.push(node);
		if(this.trackingMids?.has(node.id) ?? false) {
			this.trackingMids?.delete(node.id);
		}
		if(this.atEndOfCollection()) {
			this.triggerCallback();
		}
	}

	protected override onEndMarkerNode(node: CfgEndMarkerVertex): void {
		super.onEndMarkerNode(node);
		this.collect?.push(node);
		if(this.trackingEnds?.has(node.id) ?? false) {
			this.trackingEnds?.delete(node.id);
		}
		if(this.atEndOfCollection()) {
			this.triggerCallback();
		}
	}
}