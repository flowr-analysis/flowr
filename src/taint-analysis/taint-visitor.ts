import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { ResolvedTaint, TaintMapper } from './function-mapper';
import { mapFnCallToTaint, resolveTaint } from './function-mapper';
import type { AnyStateDomain } from '../abstract-interpretation/domains/state-domain-like';
import { StateAbstractDomain } from '../abstract-interpretation/domains/state-abstract-domain';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

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
 */
export type TaintVisitorHook = (taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain, projectArg: ArgTaintProjector, call: DataflowGraphVertexFunctionCall) => void;

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
	private readonly domain:       Domain;
	private readonly fnCallMapper: TaintMapper<Domain>;

	private readonly projectArg = (id: NodeId): Domain | undefined => this.getAbstractValue(id);

	constructor(domain: Domain, fnCallMapper: TaintMapper<Domain>, visitorConfig: TaintVisitorConfiguration) {
		super(visitorConfig, StateAbstractDomain.top(domain.top()));
		this.domain = domain;
		this.fnCallMapper = fnCallMapper;
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		const node = this.getNormalizedAst(call.id);
		if(!node || node.type !== RType.FunctionCall || !node.named) {
			return;
		}

		const taint = mapFnCallToTaint(node, this.fnCallMapper, this.config.dfg, this.config.ctx);

		const value = resolveTaint(taint, this.domain, this.projectArg);
		this.currentState.set(node.info.id, value);

		this.config.fnCallHook(taint, node, value, this.projectArg, call);
	}

	protected isUnsupportedFunctionCall(_nodeId: NodeId): boolean {
		return false;
	}
}