import type { BuiltInMappingName } from '../dataflow/environments/built-in';
import { resolveIdToValue } from '../dataflow/eval/resolve/alias-tracking';
import { valueSetGuard } from '../dataflow/eval/values/general';
import { isValue } from '../dataflow/eval/values/r-value';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexFunctionCall, VertexType } from '../dataflow/graph/vertex';
import { type ControlDependency, happensInEveryBranch } from '../dataflow/info';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { guard } from '../util/assert';
import type { ControlFlowInformation } from './control-flow-graph';
import { SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration } from './semantic-cfg-guided-visitor';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';


export const loopyFunctions = new Set<BuiltInMappingName>(['builtin:for-loop', 'builtin:while-loop', 'builtin:repeat-loop']);

/**
 * Checks whether a loop only loops once
 * @param loop        - nodeid of the loop to analyse
 * @param dataflow    - dataflow graph
 * @param controlflow - control flow graph
 * @param ast         - normalized ast
 * @param ctx      - current flowr analyzer context
 * @returns true if the given loop only iterates once
 */
export function onlyLoopsOnce(loop: NodeId, dataflow: DataflowGraph, controlflow: ControlFlowInformation, ast: NormalizedAst, ctx: ReadOnlyFlowrAnalyzerContext): boolean | undefined {
	const vertex = dataflow.getVertex(loop);
	if(!vertex) {
		return undefined;
	}

	guard(vertex.tag === VertexType.FunctionCall, 'invalid vertex type for onlyLoopsOnce');
	guard(vertex.origin !== 'unnamed' && loopyFunctions.has(vertex.origin[0] as BuiltInMappingName), 'onlyLoopsOnce can only be called with loops');

	// 1. In case of for loop, check if vector has only one element
	if(vertex.origin[0] === 'builtin:for-loop') {
		if(vertex.args.length < 2) {
			return undefined;
		}

		const vectorOfLoop = vertex.args[1];
		if(vectorOfLoop === EmptyArgument) {
			return undefined;
		}

		const values = valueSetGuard(resolveIdToValue(vectorOfLoop.nodeId, {
			graph:   dataflow,
			idMap:   dataflow.idMap,
			resolve: ctx.config.solver.variables,
			ctx:     ctx
		}));
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type !== 'vector' || !isValue(values.elements[0].elements)) {
			return undefined;
		}

		if(values.elements[0].elements.length === 1) {
			return true;
		}
	}

	// 2. Use CFG Visitor to determine if loop always exits after the first iteration
	const visitor = new CfgSingleIterationLoopDetector(loop, {
		controlFlow:          controlflow,
		normalizedAst:        ast,
		dfg:                  dataflow,
		ctx:                  ctx,
		defaultVisitingOrder: 'forward'
	});

	return visitor.loopsOnlyOnce();
}

class CfgSingleIterationLoopDetector extends SemanticCfgGuidedVisitor {

	private loopCds: ControlDependency[] | undefined = undefined;
	private encounteredLoopBreaker = false;
	private onlyLoopyOnce = false;

	private loopToCheck: NodeId;

	constructor(loop: NodeId, config: SemanticCfgGuidedVisitorConfiguration) {
		super(config);
		this.loopToCheck = loop;
	}

	private getBoolArgValue(data: { call: DataflowGraphVertexFunctionCall }): boolean | undefined {
		if(data.call.args.length !== 1 || data.call.args[0] === EmptyArgument) {
			return undefined;
		}

		const values = valueSetGuard(resolveIdToValue(data.call.args[0].nodeId, {
			graph:   this.config.dfg,
			full:    true,
			idMap:   this.config.normalizedAst.idMap,
			resolve: this.config.ctx.config.solver.variables,
			ctx:     this.config.ctx
		}));
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type != 'logical'  || !isValue(values.elements[0].value)) {
			return undefined;
		}

		return Boolean(values.elements[0].value);
	}

	protected startVisitor(_: readonly NodeId[]): void {
		const g = this.config.controlFlow.graph;
		const ingoing = (i: NodeId) => g.ingoingEdges(i);

		const exits = new Set<NodeId>(g.getVertex(this.loopToCheck)?.end as NodeId[] ?? []);
		guard(exits.size !== 0, "Can't find end of loop");

		const stack: NodeId[] = [this.loopToCheck];
		while(stack.length > 0) {
			const current = stack.shift() as NodeId;

			if(!this.visitNode(current)) {
				continue;
			}


			if(!exits.has(current)) {
				const next = ingoing(current) ?? [];
				for(const [to] of next) {
					stack.unshift(to);
				}
			}

			this.onlyLoopyOnce ||= this.encounteredLoopBreaker && happensInEveryBranch(this.loopCds?.filter(c => !c.byIteration));
		}

		this.onlyLoopyOnce ||= this.encounteredLoopBreaker && happensInEveryBranch(this.loopCds?.filter(c => !c.byIteration));
	}

	private app(cds: ControlDependency[] | undefined): void {
		if(cds === undefined) {
			return;
		}
		const filtered = cds.filter(c => c.id !== this.loopToCheck);
		if(filtered.length > 0) {
			if(this.loopCds === undefined) {
				this.loopCds = filtered;
			} else {
				this.loopCds = this.loopCds.concat(filtered);
			}
		}
	}
	private handleFunctionCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		for(const origin of data.call.origin) {
			if(origin === 'builtin:stop' || origin === 'builtin:return' || origin === 'builtin:break') {
				this.encounteredLoopBreaker = true;
				this.app(data.call.cds);
				return;
			} else if(origin === 'builtin:stopifnot') {
				const arg = this.getBoolArgValue(data);
				if(arg === false) {
					this.encounteredLoopBreaker = true;
					this.app(data.call.cds);
					return;
				}
			}
		}
	}

	protected onDefaultFunctionCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		this.handleFunctionCall(data);
	}

	protected onStopIfNotCall(data: { call: DataflowGraphVertexFunctionCall }): void {
		this.handleFunctionCall(data);
	}

	public loopsOnlyOnce(): boolean {
		this.startVisitor([]);
		return this.onlyLoopyOnce;
	}
}
