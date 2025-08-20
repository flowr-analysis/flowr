import type { FlowrConfigOptions } from '../config';
import type { BuiltInMappingName } from '../dataflow/environments/built-in';
import { resolveIdToValue } from '../dataflow/eval/resolve/alias-tracking';
import { valueSetGuard } from '../dataflow/eval/values/general';
import { isValue } from '../dataflow/eval/values/r-value';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { VertexType } from '../dataflow/graph/vertex';
import { happensInEveryBranch } from '../dataflow/info';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { guard } from '../util/assert';
import type { ControlFlowInformation } from './control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from './semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from './semantic-cfg-guided-visitor';


export const loopyFunctions = new Set<BuiltInMappingName>(['builtin:for-loop', 'builtin:while-loop', 'builtin:repeat-loop']);

/**
 * Checks whether a loop only loops once
 * 
 * 
 * 
 * @param loop        - nodeid of the loop to analyse
 * @param dataflow    - dataflow graph
 * @param controlflow - control flow graph
 * @param ast         - normalized ast
 * @param config      - current flowr config
 * @returns true if the given loop only iterates once
 */
export function onlyLoopsOnce(loop: NodeId, dataflow: DataflowGraph, controlflow: ControlFlowInformation, ast: NormalizedAst, config: FlowrConfigOptions): boolean | undefined {
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

		const values = valueSetGuard(resolveIdToValue(vectorOfLoop.nodeId, { graph: dataflow, idMap: dataflow.idMap, resolve: config.solver.variables }));
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
		flowrConfig:          config,
		defaultVisitingOrder: 'forward'
	});

	return visitor.loopsOnlyOnce();
}

class CfgSingleIterationLoopDetector extends SemanticCfgGuidedVisitor {
	
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

		const values = valueSetGuard(resolveIdToValue(data.call.args[0].nodeId, { graph: this.config.dfg, full: true, idMap: this.config.normalizedAst.idMap, resolve: this.config.flowrConfig.solver.variables  }));
		if(values === undefined || values.elements.length !== 1 || values.elements[0].type != 'logical'  || !isValue(values.elements[0].value)) {
			return undefined;
		}

		return Boolean(values.elements[0].value);
	}

	protected startVisitor(_: readonly NodeId[]): void {
		const g = this.config.controlFlow.graph;
		const n = (i: NodeId) => g.ingoingEdges(i);

		const exits = new Set<NodeId>(g.getVertex(this.loopToCheck)?.end as NodeId[] ?? []);
		guard(exits.size !== 0, "Can't find end of loop"); 

		const stack: NodeId[] = [this.loopToCheck];
		while(stack.length > 0) {
			const current = stack.shift() as NodeId;

			if(!this.visitNode(current)) {
				continue;
			}


			if(!exits.has(current)) {
				const next = n(current) ?? [];
				for(const [to] of next) {
					stack.unshift(to);
				}
			}
		}
	}

	protected onDefaultFunctionCall(data: { call: DataflowGraphVertexFunctionCall; }): void {
		let stopsLoop = false;

		const alwaysHappens = () => {
			if(!data.call.cds || 
				(data.call.cds.length === 1 && data.call.cds[0].id === this.loopToCheck)) {
				return true;
			}

			const cds = data.call.cds.filter(d => d.id !== this.loopToCheck);

			return happensInEveryBranch(cds);
		};

		switch(data.call.origin[0]) {
			case 'builtin:return':
			case 'builtin:stop':
			case 'builtin:break':
				stopsLoop = alwaysHappens();
				break;
			case 'builtin:stopifnot': {
				const arg = this.getBoolArgValue(data);
				if(arg !== undefined) {
					stopsLoop = !arg && alwaysHappens();
				}
				break;
			}
		}
			
		this.onlyLoopyOnce = this.onlyLoopyOnce || stopsLoop;
	}

	public loopsOnlyOnce(): boolean {
		this.startVisitor([]);
		return this.onlyLoopyOnce;
	}
}
