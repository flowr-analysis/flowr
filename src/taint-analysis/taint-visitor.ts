import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AbstractDomainValue, AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { FnTaintMapper } from './function-mapper';
import { mapFnCallToTaint } from './function-mapper';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';

// TODO Parameter handling
// TODO Add taint propagation, dependent taint eval
// TODO Definition of violations
export class TaintInferenceVisitor<Domain extends AnyAbstractDomain> extends AbstractInterpretationVisitor<Domain> {
	private readonly domain:       Domain;
	private readonly fnCallMapper: FnTaintMapper<Domain>;

	constructor(domain: Domain, fnCallMapper: FnTaintMapper<Domain>, visitorConfig: AbsintVisitorConfiguration) {
		super(visitorConfig, domain.top());
		this.domain = domain;
		this.fnCallMapper = fnCallMapper;
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		super.onFunctionCall({ call });

		const node = this.getNormalizedAst(call.id);

		if(node === undefined) {
			return;
		}
		const taint = mapFnCallToTaint(node, this.fnCallMapper);
		if(taint) {
			this.applyFnCall(node, taint);
		}
	}

	private applyFnCall(node: RNode<ParentInformation>, taint: AbstractDomainValue<AnyAbstractDomain>) {
		this.updateState(node.info.id, this.domain.create(taint));
	}
}