import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { ResolvedTaint, TaintMapper } from './function-mapper';
import { mapFnCallToTaint, resolveTaint } from './function-mapper';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyStateDomain } from '../abstract-interpretation/domains/state-domain-like';
import { StateAbstractDomain } from '../abstract-interpretation/domains/state-abstract-domain';

/**
 * Abstract interpretation visitor for conducting taint analyses (i.e., applying finite taint lattices on the control-flow graph).
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintInferenceVisitor<Domain extends AnyAbstractDomain> extends AbstractInterpretationVisitor<AnyStateDomain<Domain>> {
	private readonly domain:       Domain;
	private readonly fnCallMapper: TaintMapper<Domain>;

	constructor(domain: Domain, fnCallMapper: TaintMapper<Domain>, visitorConfig: AbsintVisitorConfiguration) {
		super({ ...visitorConfig, ignoreUnsupportedFunctions: false }, StateAbstractDomain.top(domain.top()));
		this.domain = domain;
		this.fnCallMapper = fnCallMapper;
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return;
		}

		const taint = mapFnCallToTaint(node, this.fnCallMapper, this.config.dfg, this.config.ctx);
		this.applyFnCall(node.info.id, taint);
	}

	private applyFnCall(id: NodeId, taint: ResolvedTaint<Domain>) {
		const value = resolveTaint(taint, this.domain, argId => this.getAbstractValue(argId));
		this.currentState.set(id, value);
	}
}