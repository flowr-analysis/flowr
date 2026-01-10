/* currently this does not do work on function definitions */
import type { ControlFlowInformation } from './control-flow-graph';
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

type CachedValues<Val> = Map<NodeId, Val>;

class CfgConditionalDeadCodeRemoval extends SemanticCfgGuidedVisitor {

	private readonly cachedConditions: CachedValues<Ternary> = new Map();

	private readonly cachedStatements: CachedValues<boolean> = new Map();


	private getValue(id: NodeId): Ternary {
		const has = this.cachedConditions.get(id);
		if(has) {
			return has;
		}
		this.visitNode(id);
		return this.cachedConditions.get(id) ?? Ternary.Maybe;
	}

	private isUnconditionalJump(id: NodeId): boolean {
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
		for(const [from, targets] of this.config.controlFlow.graph.edges()) {
			for(const [target, edge] of targets) {
				if(edge.label === CfgEdgeType.Cd) {
					const og = this.getValue(edge.caused);

					if(og === Ternary.Always && edge.when === 'FALSE') {
						this.config.controlFlow.graph.removeEdge(from, target);
					} else if(og === Ternary.Never && edge.when === 'TRUE') {
						this.config.controlFlow.graph.removeEdge(from, target);
					}
				} else if(edge.label === CfgEdgeType.Fd) {
					if(this.isUnconditionalJump(target)) {
						this.config.controlFlow.graph.removeEdge(from, target);
					}
				}
			}
		}
	}

	private handleValuesFor(id: NodeId, valueId: NodeId): void {
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

	private handleFunctionCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		switch(data.call.origin[0]) {
			case 'builtin:return':
			case 'builtin:stop':
				this.cachedStatements.set(data.call.id, true);
				break;
			case 'builtin:stopifnot': {
				const arg = this.getBoolArgValue(data);
				if(arg !== undefined) {
					this.cachedStatements.set(data.call.id, !arg);
				}
				break;
			}
		}
	}

	protected onIfThenElseCall(data: { call: DataflowGraphVertexFunctionCall, condition?: NodeId }) {
		this.handleWithCondition(data);
	}

	protected onWhileLoopCall(data: { call: DataflowGraphVertexFunctionCall, condition: FunctionArgument }) {
		this.handleWithCondition(data);
	}

	protected onDefaultFunctionCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		this.handleFunctionCall(data);
	}

	protected onStopIfNotCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		this.handleFunctionCall(data);
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
		defaultVisitingOrder: 'forward',
	});
	visitor.start();
	return cfg;
}
