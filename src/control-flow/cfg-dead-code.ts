/* currently this does not do work on function definitions */
import type { ControlFlowInformation } from './control-flow-graph';
import { CfgVertex, CfgEdge } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../util/logic';
import type { CfgPassInfo } from './cfg-simplification';
import { SemanticCfgGuidedVisitor } from './semantic-cfg-guided-visitor';
import { FunctionCallVertex, type DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { FunctionArgument } from '../dataflow/graph/graph';
import { resolveIdToSingleString, resolveIdToValue } from '../dataflow/eval/resolve/alias-tracking';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { log } from '../util/log';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { valueSetGuard } from '../dataflow/eval/values/general';
import { isValue } from '../dataflow/eval/values/r-value';
import { visitCfgInOrder } from './simple-visitor';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';

type CachedValues<Val> = Map<NodeId, Val>;

class CfgConditionalDeadCodeRemoval extends SemanticCfgGuidedVisitor {

	private readonly cachedConditions: CachedValues<Ternary> = new Map();
	private readonly cachedStatements: CachedValues<boolean> = new Map();
	private readonly cachedSwitch:     Map<NodeId, { id: NodeId | undefined } | 'unknown'> = new Map();
	private readonly jumpIsolated:     Set<NodeId> = new Set<NodeId>();

	private getValue(id: NodeId): Ternary {
		const has = this.cachedConditions.get(id);
		if(has) {
			return has;
		}
		this.visitNode(id);
		return this.cachedConditions.get(id) ?? Ternary.Maybe;
	}

	private isUnconditionalJump(id: NodeId): boolean {
		if(this.jumpIsolated.has(id)) {
			return false;
		}
		const has = this.cachedStatements.get(id);
		if(!has) {
			this.visitNode(id);
			if(!this.cachedStatements.get(id)) {
				return false;
			}
		}
		return !this.inParameterDefault(id);
	}

	/** a parameter default is forced on access if at all, so a jump within it must not cut the function body */
	private inParameterDefault(id: NodeId): boolean {
		for(let node = this.getNormalizedAst(id); node !== undefined; node = this.getNormalizedAst(node.info.parent)) {
			if(node.type === RType.Parameter) {
				return true;
			} else if(node.type === RType.FunctionDefinition) {
				return false;
			}
		}
		return false;
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
				if(CfgEdge.isControlDependency(edge)) {
					const cause = CfgEdge.unpackCause(edge);
					if(this.switchArmDefinitelyNotTaken(cause, from)) {
						cfg.removeEdge(from, target);
						continue;
					}
					const og = this.getValue(cause);
					const w = CfgEdge.unpackWhen(edge);
					if(og === Ternary.Always && w === RFalse) {
						cfg.removeEdge(from, target);
					} else if(og === Ternary.Never && w === RTrue) {
						cfg.removeEdge(from, target);
					}
				} else if(CfgEdge.isFlowDependency(edge) && this.isUnconditionalJump(target)) {
					// for each unconditional jump, we find the corresponding end/exit nodes and remove any flow edges
					for(const end of CfgVertex.getEnd(this.getCfgVertex(target)) as NodeId[] ?? []) {
						for(const [target, edge] of cfg.ingoingEdges(end) ?? []) {
							if(CfgEdge.isFlowDependency(edge)) {
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
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type !== 'logical'  || !isValue(values.elements[0].value)) {
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
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type !== 'logical'  || !isValue(values.elements[0].value)) {
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

	private protectSubgraph(nodeId: NodeId): void {
		const start = this.getCfgVertex(nodeId);
		if(!start) {
			return;
		}
		visitCfgInOrder(this.config.controlFlow.graph, [CfgVertex.getId(start)], n => {
			if(CfgVertex.getEnd(start)?.includes(n)) {
				return true;
			}
			this.jumpIsolated.add(n);
			return false;
		});
	}

	protected onTryCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		if(data.call.args.length < 1 || data.call.args[0] === EmptyArgument) {
			return;
		}
		this.protectSubgraph(data.call.args[0].nodeId);
	}

	private switchArmDefinitelyNotTaken(cause: NodeId, from: NodeId): boolean {
		const v = this.config.dfg.getVertex(cause);
		if(!FunctionCallVertex.is(v) || !v.origin.includes(BuiltInProcName.Switch)) {
			return false;
		}
		const selected = this.selectedSwitchArm(v);
		if(selected === 'unknown') {
			return false;
		}
		const isArm = v.args.slice(1).some(a => FunctionArgument.getReference(a) !== undefined && FunctionArgument.getId(a) === from);
		return isArm && from !== selected.id;
	}

	private selectedSwitchArm(v: DataflowGraphVertexFunctionCall): { id: NodeId | undefined } | 'unknown' {
		const cached = this.cachedSwitch.get(v.id);
		if(cached !== undefined) {
			return cached;
		}
		const result = this.computeSelectedSwitchArm(v);
		this.cachedSwitch.set(v.id, result);
		return result;
	}

	private computeSelectedSwitchArm(v: DataflowGraphVertexFunctionCall): { id: NodeId | undefined } | 'unknown' {
		const target = resolveIdToSingleString(FunctionArgument.getReference(v.args[0]), {
			graph: this.config.dfg, full: true, idMap: this.config.normalizedAst.idMap, resolve: this.config.ctx.config.solver.variables, ctx: this.config.ctx
		});
		if(target === undefined) {
			return 'unknown';
		}
		const arms = v.args.slice(1);
		for(let i = 0; i < arms.length; i++) {
			if(FunctionArgument.getName(arms[i]) === target) {
				for(let j = i; j < arms.length; j++) {
					if(FunctionArgument.getReference(arms[j]) !== undefined) {
						return { id: FunctionArgument.getId(arms[j]) };
					}
				}
				return { id: undefined };
			}
		}
		let defaultId: NodeId | undefined;
		let defaults = 0;
		for(const arm of arms) {
			if(arm !== EmptyArgument && !FunctionArgument.isNamed(arm) && FunctionArgument.getReference(arm) !== undefined) {
				defaults++;
				defaultId = FunctionArgument.getId(arm);
			}
		}
		return defaults > 1 ? 'unknown' : { id: defaultId };
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
