import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { FnTaintMapper, ResolvedTaint } from './function-mapper';
import { mapFnCallToTaint } from './function-mapper';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

// TODO Evaluation of violations
// TODO Taints dependent on multiple input parameters
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

		const taint = mapFnCallToTaint(node, this.fnCallMapper, this.config.dfg, this.config.ctx);
		this.applyFnCall(node.info.id, taint);
	}

	private applyFnCall(id: NodeId, taint: ResolvedTaint<Domain>) {
		if(!taint) {
			this.updateState(id, this.domain.top());
		} else if('taint' in taint) {
			this.updateState(id, this.domain.create(taint.taint));
		} else {
			if(taint.argument === EmptyArgument || !taint.argument.value?.info) {
				this.updateState(id, this.domain.top());
				return;
			}
			const currentValue = this.getAbstractValue(taint.argument.value.info.id);
			if(currentValue === undefined) {
				this.updateState(id, this.domain.top());
				return;
			}
			// @ts-ignore
			const newValue = taint.condition.cond(currentValue.value);
			this.updateState(id, this.domain.create(newValue));
		}
	}
}