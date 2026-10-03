import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { resolveFnCallToTaint } from './taint-resolve';
import type { AnyStateDomain } from '../abstract-interpretation/domains/state-domain-like';
import { StateAbstractDomain } from '../abstract-interpretation/domains/state-abstract-domain';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FnCallHookInfo } from './builder/taint-analysis';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { TaintMapper } from './taint-mapping';

/**
 * Function calls the taint analysis is able to handle:
 * named function calls like `f(x)` and operators, including binary operators (`x + y`) and unary operators (`-x`)
 */
export type TaintCallNode = RNamedFunctionCall<ParentInformation> | RBinaryOp<ParentInformation> | RUnaryOp<ParentInformation>;

/** Whether the given AST node can be handled by the taint analysis (see {@link TaintCallNode}). */
export function isTaintableCallNode(node: RNode<ParentInformation> | undefined): node is TaintCallNode {
	return RFunctionCall.isNamed(node) || RBinaryOp.is(node) || RUnaryOp.is(node);
}

/**
 * Resolves the inferred abstract taint of an argument node at the current program point, independent of any mapping
 * rule. Returns `undefined` if no taint was inferred for the node.
 */
export type ArgTaintProjector = (id: NodeId) => AnyAbstractDomain | undefined;

/**
 * Callback hook invoked when a function call is visited during taint inference.
 * @param taint      - The resolved taint information for the function call
 * @param node       - The AST node representing the function call
 * @param value      - The abstract domain value at this point in the analysis
 * @param projectArg - Resolves the incoming taint of any argument node, regardless of mapping rules
 * @param call       - The data flow graph vertex of the function call
 * @param role       - The role of the matched mapping (source/propagator/sink), or `undefined` for unmapped calls
 */
export type TaintVisitorHook = (info: Omit<FnCallHookInfo, 'name' | 'dfg' | 'ctx'>) => void;

/**
 * Configuration for the taint inference visitor.
 */
export type TaintVisitorConfiguration = AbsintVisitorConfiguration & {
	/** Callbacks invoked when each function call is visited during taint inference */
	fnCallHook: TaintVisitorHook;
};

/**
 * Abstract interpretation visitor for conducting taint analyses (i.e., applying finite taint lattices on the control-flow graph).
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintInferenceVisitor<Domain extends AnyAbstractDomain> extends AbstractInterpretationVisitor<AnyStateDomain<Domain>, TaintVisitorConfiguration> {
	private readonly domain:      Domain;
	private readonly taintMapper: TaintMapper<Domain>;

	private readonly projectArg = (id: NodeId): Domain | undefined => this.getAbstractValue(id);

	constructor(domain: Domain, fnCallMapper: TaintMapper<Domain>, visitorConfig: TaintVisitorConfiguration, collapseOnBottom = false) {
		super(visitorConfig, StateAbstractDomain.top(domain.top(), collapseOnBottom));
		this.domain = domain;
		this.taintMapper = fnCallMapper;
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		const node = this.getNormalizedAst(call.id);
		if(!isTaintableCallNode(node)) {
			return;
		}

		const mappings = this.taintMapper.getMappings(call.name);

		const { value, role } = resolveFnCallToTaint(call, mappings, this.domain, this.projectArg, this.config.dfg, this.config.ctx);
		this.currentState.set(call.id, value);

		this.config.fnCallHook({ node, value, wasMapped: mappings.length > 0, projectArg: this.projectArg, call, role: role });
	}

	protected isUnsupportedFunctionCall(_nodeId: NodeId): boolean {
		return false;
	}
}