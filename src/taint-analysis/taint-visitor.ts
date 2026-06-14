import type { AbsintVisitorConfiguration } from '../abstract-interpretation/absint-visitor';
import { AbstractInterpretationVisitor } from '../abstract-interpretation/absint-visitor';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { ResolvedTaint, TaintMapper } from './function-mapper';
import { mapFnCallToTaint, resolveTaint } from './function-mapper';
import type { AnyStateDomain } from '../abstract-interpretation/domains/state-domain-like';
import { StateAbstractDomain } from '../abstract-interpretation/domains/state-abstract-domain';
import { Instrumentation } from './instrumentation';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

export type TaintVisitorConfiguration = AbsintVisitorConfiguration & {
	instrument: boolean;
};

export interface InstrumentableTaintInferenceVisitor {
	getInstrumentation(): Instrumentation | undefined;
}

/**
 * Abstract interpretation visitor for conducting taint analyses (i.e., applying finite taint lattices on the control-flow graph).
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintInferenceVisitor<Domain extends AnyAbstractDomain> extends AbstractInterpretationVisitor<AnyStateDomain<Domain>, TaintVisitorConfiguration>
	implements InstrumentableTaintInferenceVisitor {
	private readonly domain:          Domain;
	private readonly fnCallMapper:    TaintMapper<Domain>;
	private readonly instrumentation: Instrumentation | undefined;

	constructor(domain: Domain, fnCallMapper: TaintMapper<Domain>, visitorConfig: TaintVisitorConfiguration) {
		super({ ...visitorConfig, ignoreUnsupportedFunctions: false }, StateAbstractDomain.top(domain.top()));
		this.domain = domain;
		this.fnCallMapper = fnCallMapper;
		if(this.config.instrument) {
			this.instrumentation = new Instrumentation();
		}
	}

	public getInstrumentation() {
		return this.instrumentation;
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

		this.handleInstrumentation(taint, node, value);
	}

	private handleInstrumentation(taint: ResolvedTaint<Domain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) {
		if(!this.instrumentation) {
			return;
		}

		const call = {
			file:         node.info.file,
			line:         node.info.fullRange?.[0].toString(),
			nodeId:       node.info.id,
			functionName: node.functionName.content,
		};

		if(taint) {
			this.instrumentation.recordMappedCall({
				...call,
				taint: value.toString(),
			});
		} else {
			this.instrumentation.recordUnmappedCall(call);
		}
	}
}