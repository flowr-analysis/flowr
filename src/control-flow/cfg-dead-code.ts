/* currently this does not do work on function definitions */
import type { ControlFlowGraph, ControlFlowInformation } from './control-flow-graph';
import { CfgEdgeType } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../util/logic';
import type { CfgPassInfo } from './cfg-simplification';
import { SemanticCfgGuidedVisitor } from './semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { FunctionArgument } from '../dataflow/graph/graph';
import { resolveIdToValue } from '../dataflow/eval/resolve/alias-tracking';
import { log } from '../util/log';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { valueSetGuard } from '../dataflow/eval/values/general';
import { isValue } from '../dataflow/eval/values/r-value';
import { visitCfgInOrder } from './simple-visitor';

type CachedValues<Val> = Map<NodeId, Val>;

class CfgConditionalDeadCodeRemoval extends SemanticCfgGuidedVisitor {

	private readonly cachedConditions: CachedValues<Ternary> = new Map();
	private readonly cachedStatements: CachedValues<boolean> = new Map();
	private readonly inTry:            Set<NodeId> = new Set<NodeId>();
	private invertedCfg:               ControlFlowGraph | undefined;

	private getValue(id: NodeId): Ternary {
		const has = this.cachedConditions.get(id);
		if(has) {
			return has;
		}
		this.visitNode(id);
		return this.cachedConditions.get(id) ?? Ternary.Maybe;
	}

	private isUnconditionalJump(id: NodeId): boolean {
		if(this.inTry.has(id)) {
			return false;
		}
		const has = this.cachedStatements.get(id);
		if(has) {
			return has;
		}
		this.visitNode(id);
		return this.cachedStatements.get(id) ?? false;
	}

	private unableToCalculateValue(id: NodeId): void {
		this.cachedConditions.set(id, Ternary.Maybe);
	}

	private storeDefiniteValue(id: NodeId, value: boolean): void {
		this.cachedConditions.set(id, value ? Ternary.Always : Ternary.Never);
	}

	protected override startVisitor(): void {
		const cfg = this.config.controlFlow.graph;
		for(const [from, targets] of cfg.edges()) {
			for(const [target, edge] of targets) {
				if(edge.label === CfgEdgeType.Cd) {
					const og = this.getValue(edge.caused);

					if(og === Ternary.Always && edge.when === 'FALSE') {
						cfg.removeEdge(from, target);
					} else if(og === Ternary.Never && edge.when === 'TRUE') {
						cfg.removeEdge(from, target);
					}
				} else if(edge.label === CfgEdgeType.Fd && this.isUnconditionalJump(target)) {
					// for each unconditional jump, we find the corresponding end/exit nodes and remove any flow edges
					for(const end of this.getCfgVertex(target)?.end as NodeId[] ?? []) {
						for(const [target, edge] of cfg.ingoingEdges(end) ?? []) {
							if(edge.label === CfgEdgeType.Fd) {
								cfg.removeEdge(target, end);
							}
						}
					}
				}
			}
		}
	}

	private handleValuesFor(id: NodeId, valueId: NodeId): void {
		if(this.cachedConditions.has(id)) {
			return;
		}
		const values = valueSetGuard(resolveIdToValue(valueId, {
			graph:   this.config.dfg,
			full:    true,
			idMap:   this.config.normalizedAst.idMap,
			resolve: this.config.ctx.config.solver.variables,
			ctx:     this.config.ctx,
		}));
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type != 'logical'  || !isValue(values.elements[0].value)) {
			this.unableToCalculateValue(id);
			return;
		}
		/* we should translate this to truthy later */
		this.storeDefiniteValue(id, Boolean(values.elements[0].value));
	}

	private handleWithCondition(data: { call: DataflowGraphVertexFunctionCall, condition?: FunctionArgument | NodeId }) {
		const id = data.call.id;
		if(data.condition === undefined || data.condition === EmptyArgument) {
			this.unableToCalculateValue(id);
			return;
		}
		this.handleValuesFor(id, typeof data.condition === 'object' ? data.condition.nodeId : data.condition);
	}

	private getBoolArgValue(data: { call: DataflowGraphVertexFunctionCall }): boolean | undefined {
		if(data.call.args.length !== 1 || data.call.args[0] === EmptyArgument) {
			return undefined;
		}

		const values = valueSetGuard(resolveIdToValue(data.call.args[0].nodeId, {
			graph: this.config.dfg,
			full:  true,
			idMap: this.config.normalizedAst.idMap,
			ctx:   this.config.ctx,
		}));
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type != 'logical'  || !isValue(values.elements[0].value)) {
			return undefined;
		}

		return Boolean(values.elements[0].value);
	}

	protected onIfThenElseCall(data: { call: DataflowGraphVertexFunctionCall, condition?: NodeId }) {
		this.handleWithCondition(data);
	}

	protected onWhileLoopCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument }) {
		this.handleWithCondition(data);
	}

	protected onStopCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		this.cachedStatements.set(data.call.id, true);
	}

	protected onStopIfNotCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		if(this.cachedStatements.has(data.call.id)) {
			return;
		}
		const arg = this.getBoolArgValue(data);
		if(arg !== undefined) {
			this.cachedStatements.set(data.call.id, !arg);
		}
	}

	protected onTryCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		if(data.call.args.length < 1 || data.call.args[0] === EmptyArgument) {
			return;
		}
		const body = this.getCfgVertex(data.call.args[0].nodeId);
		if(!body) {
			return;
		}
		visitCfgInOrder(this.config.controlFlow.graph, [body.id], n => {
			if((body.end as NodeId[])?.includes(n)) {
				return true;
			}
			this.inTry.add(n);
			return false;
		});
	}
}


/** Breaks unsatisfiable control dependencies */
export function cfgAnalyzeDeadCode(cfg: ControlFlowInformation, info: CfgPassInfo): ControlFlowInformation {
	if(!info.ast || !info.dfg) {
		log.warn('cfgAnalyzeDeadCode called without ast or dfg, skipping dead code analysis');
		return cfg;
	}
	const visitor = new CfgConditionalDeadCodeRemoval({
		controlFlow:          cfg,
		normalizedAst:        info.ast,
		dfg:                  info.dfg,
		ctx:                  info.ctx,
		defaultVisitingOrder: 'backward'
	});
	visitor.start();
	return cfg;
}
