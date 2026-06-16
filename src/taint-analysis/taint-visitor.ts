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

/**
 * Callback hook invoked when a function call is visited during taint inference.
 * @param taint - The resolved taint information for the function call
 * @param node - The AST node representing the function call
 * @param value - The abstract domain value at this point in the analysis
 */
export type TaintVisitorHook = (taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) => void;

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

	constructor(domain: Domain, fnCallMapper: TaintMapper<Domain>, visitorConfig: TaintVisitorConfiguration) {
		super({ ...visitorConfig, ignoreUnsupportedFunctions: false }, StateAbstractDomain.top(domain.top()));
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

		const value = resolveTaint(taint, this.domain, argId => this.getAbstractValue(argId));
		this.currentState.set(node.info.id, value);

		this.config.fnCallHook(taint, node, value);
	}
}