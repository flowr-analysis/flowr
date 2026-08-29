/* currently this does not do work on function definitions */
import type { ControlFlowInformation } from './control-flow-graph';
import { Resolve } from '../dataflow/environments/resolve-helper';
import { CfgEdge } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../util/logic';
import type { CfgPassInfo } from './cfg-simplification';
import { SemanticCfgGuidedVisitor, type OnCall } from './semantic-cfg-guided-visitor';
import { Vertex, type DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { FunctionArgument } from '../dataflow/graph/graph';
import { NodeValue } from '../dataflow/eval/resolve/node-value';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { log } from '../util/log';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isValue } from '../dataflow/eval/values/r-value';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RParameter } from '../r-bridge/lang-4.x/ast/model/nodes/r-parameter';

type CachedValues<Val> = Map<NodeId, Val>;

class CfgConditionalDeadCodeRemoval extends SemanticCfgGuidedVisitor {

	private readonly cachedConditions: CachedValues<Ternary> = new Map();
	private readonly cachedStatements: CachedValues<boolean> = new Map();
	private readonly cachedSwitch:     Map<NodeId, { id: NodeId | undefined } | 'unknown'> = new Map();
	private readonly caught:           Map<NodeId, boolean> = new Map();

	private getValue(id: NodeId): Ternary {
		const has = this.cachedConditions.get(id);
		if(has) {
			return has;
		}
		this.visitNode(id);
		return this.cachedConditions.get(id) ?? Ternary.Maybe;
	}

	private isUnconditionalJump(id: NodeId): boolean {
		if(this.isCaught(id)) {
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
			if(RParameter.is(node)) {
				return true;
			} else if(RFunctionDefinition.is(node)) {
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
					if(this.switchArmDefinitelyNotTaken(cause, target)) {
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
				} else if(CfgEdge.isFlowDependency(edge) && this.isUnconditionalJump(from)) {
					/* what follows an unconditional jump is never reached through it */
					cfg.removeEdge(from, target);
				}
			}
		}
	}

	private handleValuesFor(id: NodeId, valueId: NodeId): void {
		if(this.cachedConditions.has(id)) {
			return;
		}
		const value = NodeValue.soleOf(valueId, Resolve.info(this.config.dfg, this.config.ctx), 'logical', { idMap: this.config.normalizedAst.idMap });
		if(value === undefined || !isValue(value.value)) {
			this.unableToCalculateValue(id);
			return;
		}
		/* we should translate this to truthy later */
		this.storeDefiniteValue(id, Boolean(value.value));
	}

	private handleWithCondition(data: OnCall & { condition?: FunctionArgument | NodeId }) {
		const id = data.call.id;
		if(data.condition === undefined || data.condition === EmptyArgument) {
			this.unableToCalculateValue(id);
			return;
		}
		this.handleValuesFor(id, typeof data.condition === 'object' ? data.condition.nodeId : data.condition);
	}

	protected onIfThenElseCall(data: OnCall & { condition?: NodeId }) {
		/*
		 * Only the `if` keyword leaves a branch unevaluated; `ifelse` and its relatives are ordinary functions
		 * whose arguments R evaluates whatever the condition says, so their arms are never dead.
		 */
		if(!RIfThenElse.is(this.getNormalizedAst(data.call.id))) {
			this.unableToCalculateValue(data.call.id);
			return;
		}
		this.handleWithCondition(data);
	}

	protected onWhileLoopCall(data: OnCall & { condition: FunctionArgument }) {
		this.handleWithCondition(data);
	}

	protected onStopCall(data: OnCall): void {
		this.cachedStatements.set(data.call.id, true);
	}

	protected onStopIfNotCall(data: OnCall): void {
		if(this.cachedStatements.has(data.call.id)) {
			return;
		}
		const arg = this.getBoolArgValue(data);
		if(arg !== undefined) {
			this.cachedStatements.set(data.call.id, !arg);
		}
	}

	/**
	 * Whether an error raised here is caught before it can cut the flow, which is what `try` and `tryCatch`
	 * do to a `stop()` nested in them. The enclosing calls come from the AST: in the control flow graph a
	 * construct is where its parts join again, so there is no edge that would delimit it on its own.
	 */
	private isCaught(id: NodeId): boolean {
		const cached = this.caught.get(id);
		if(cached !== undefined) {
			return cached;
		}
		let result = false;
		for(let node = this.getNormalizedAst(id)?.info.parent; node !== undefined;) {
			const vertex = this.getDataflowGraph(node);
			if(Vertex.isFunctionCall(vertex) && Array.isArray(vertex.origin) && vertex.origin.includes(BuiltInProcName.Try)) {
				result = true;
				break;
			}
			node = this.getNormalizedAst(node)?.info.parent;
		}
		this.caught.set(id, result);
		return result;
	}

	private switchArmDefinitelyNotTaken(cause: NodeId, from: NodeId): boolean {
		const v = this.config.dfg.getVertex(cause);
		if(!Vertex.isFunctionCall(v) || !v.origin.includes(BuiltInProcName.Switch)) {
			return false;
		}
		const selected = this.selectedSwitchArm(v);
		if(selected === 'unknown') {
			return false;
		}
		/*
		 * The control flow enters an arm at what it evaluates first, which for a named arm (`a = 1`) is its
		 * value rather than the argument that binds it.
		 */
		const arm = v.args.slice(1).find(a => FunctionArgument.getReference(a) !== undefined
			&& (FunctionArgument.getId(a) === from || FunctionArgument.getReference(a) === from));
		return arm !== undefined && FunctionArgument.getId(arm) !== selected.id;
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
		const target = NodeValue.singleStringOf(FunctionArgument.getReference(v.args[0]), Resolve.info(this.config.dfg, this.config.ctx), { idMap: this.config.normalizedAst.idMap });
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
