import { NodeValue } from '../dataflow/eval/resolve/node-value';
import { isValue } from '../dataflow/eval/values/r-value';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { FunctionCallVertex } from '../dataflow/graph/vertex';
import { type ControlDependency, happensInEveryBranch } from '../dataflow/info';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { guard } from '../util/assert';
import { NodeVisitor } from '../r-bridge/lang-4.x/ast/model/processing/visitor';
import { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { ControlFlowInformation } from './control-flow-graph';
import { SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration, type OnCall } from './semantic-cfg-guided-visitor';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';


export const loopyFunctions = new Set<BuiltInProcName>([BuiltInProcName.ForLoop, BuiltInProcName.WhileLoop, BuiltInProcName.RepeatLoop]);

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

	guard(FunctionCallVertex.is(vertex), 'invalid vertex type for onlyLoopsOnce');
	guard(vertex.origin !== 'unnamed' && loopyFunctions.has(vertex.origin[0]), 'onlyLoopsOnce can only be called with loops');

	// 1. In case of for loop, check if vector has only one element
	if(vertex.origin[0] === BuiltInProcName.ForLoop) {
		if(vertex.args.length < 2) {
			return undefined;
		}

		const vectorOfLoop = vertex.args[1];
		if(vectorOfLoop === EmptyArgument) {
			return undefined;
		}

		const vector = NodeValue.inGraph.soleOf(vectorOfLoop.nodeId, dataflow, ctx, 'vector');
		if(vector === undefined || !isValue(vector.elements)) {
			return undefined;
		}

		if(vector.elements.length === 1) {
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

	protected startVisitor(_: readonly NodeId[]): void {
		const g = this.config.controlFlow.graph;
		const loopNode = this.getNormalizedAst(this.loopToCheck);
		guard(loopNode !== undefined, "Can't find the loop to check");
		const withinLoop: NodeId[] = [];
		new NodeVisitor<ParentInformation>(node => {
			if(RFunctionDefinition.is(node)) {
				/* a jump within a nested closure leaves that closure, not the loop around it */
				return true;
			}
			withinLoop.push(node.info.id);
		}).visit(loopNode);

		/*
		 * Everything the loop is made of is inspected rather than followed through the graph: a loop that always
		 * jumps out never reaches its own vertex, so a walk from there would not find what breaks it.
		 */
		for(const current of withinLoop) {
			if(!g.hasVertex(current) || !this.visitNode(current)) {
				continue;
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

	protected onBreakCall(data: OnCall): void {
		this.encounteredLoopBreaker = true;
		this.app(data.call.cds);
	}

	protected onReturnCall(data: OnCall): void {
		this.encounteredLoopBreaker = true;
		this.app(data.call.cds);
	}

	protected onStopCall(data: OnCall): void {
		this.encounteredLoopBreaker = true;
		this.app(data.call.cds);
	}

	protected onStopIfNotCall(data: OnCall): void {
		const arg = this.getBoolArgValue(data);
		if(arg === false) {
			this.encounteredLoopBreaker = true;
			this.app(data.call.cds);
			return;
		}
	}

	public loopsOnlyOnce(): boolean {
		this.startVisitor([]);
		return this.onlyLoopyOnce;
	}
}
