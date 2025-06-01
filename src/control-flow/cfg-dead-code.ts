/* currently this does not do work on function definitions */
import type { ControlFlowInformation } from './control-flow-graph';
import { CfgEdgeType } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../util/logic';
import type { CfgPassInfo } from './cfg-simplification';
import { SemanticCfgGuidedVisitor } from './semantic-cfg-guided-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { FunctionArgument } from '../dataflow/graph/graph';
import { resolveIdToValue } from '../dataflow/environments/resolve-by-name';
import { log } from '../util/log';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

type CachedValues = Map<NodeId, Ternary>;

class CfgConditionalDeadCodeRemoval extends SemanticCfgGuidedVisitor {
	private readonly cachedConditions: CachedValues = new Map();

	private getValue(id: NodeId): Ternary {
		const has = this.cachedConditions.get(id);
		if(has) {
			return has;
		}
		this.visitNode(id);
		return this.cachedConditions.get(id) ?? Ternary.Maybe;
	}

	private unableToCalculateValue(id: NodeId): void {
		this.cachedConditions.set(id, Ternary.Maybe);
	}

	private storeDefiniteValue(id: NodeId, value: boolean): void {
		this.cachedConditions.set(id, value ? Ternary.Always : Ternary.Never);
	}

	protected override startVisitor(): void {
		for(const [from, targets] of this.config.controlFlow.graph.edges()) {
			for(const [target, edge] of targets) {
				if(edge.label === CfgEdgeType.Cd) {
					const og = this.getValue(edge.caused);

					if(og === Ternary.Always && edge.when === 'FALSE') {
						this.config.controlFlow.graph.removeEdge(from, target);
					} else if(og === Ternary.Never && edge.when === 'TRUE') {
						this.config.controlFlow.graph.removeEdge(from, target);
					}
				}
			}
		}
	}

	private handleValuesFor(id: NodeId, valueId: NodeId): void {
		const values = resolveIdToValue(valueId, { graph: this.config.dataflow, full: true, idMap: this.config.normalizedAst.idMap });
		if(values === undefined || values.length !== 1) {
			this.unableToCalculateValue(id);
			return;
		}
		/* we should translate this to truthy later */
		this.storeDefiniteValue(id, Boolean(values[0]));
	}

	private handleWithCondition(data: { call: DataflowGraphVertexFunctionCall, condition?: FunctionArgument | NodeId }) {
		const id = data.call.id;
		if(data.condition === undefined || data.condition === EmptyArgument) {
			this.unableToCalculateValue(id);
			return;
		}
		this.handleValuesFor(id, typeof data.condition === 'object' ? data.condition.nodeId : data.condition);
	}

	protected onIfThenElseCall(data: { call: DataflowGraphVertexFunctionCall, condition?: NodeId }) {
		this.handleWithCondition(data);
	}

	protected onWhileLoopCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument }) {
		this.handleWithCondition(data);
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
		dataflow:             info.dfg,
		defaultVisitingOrder: 'forward'
	});
	visitor.start();
	return cfg;
}
