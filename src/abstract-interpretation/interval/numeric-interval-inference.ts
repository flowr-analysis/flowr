import type { AbsintVisitorConfiguration } from '../absint-visitor';
import { AbstractInterpretationVisitor } from '../absint-visitor';
import { IntervalDomain } from '../domains/interval-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { applyIntervalExpressionSemantics } from './expression-semantics';
import { isUndefined } from '../../util/assert';
import { log } from '../../util/log';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { StateAbstractDomain } from '../domains/state-abstract-domain';
import { getIntervalConditionSemantics } from './condition-semantics';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type { AnyAbstractDomain } from '../domains/abstract-domain';

export const numericInferenceLogger = log.getSubLogger({ name: 'numeric-inference' });

/**
 * Interface that needs to be implemented by any {@link AbstractInterpretationVisitor} that applies interval condition
 * semantics.
 */
export interface IntervalValueDomainAccess<StateDomain extends AnyStateDomain<AnyAbstractDomain>> {
	setInterval(state: StateDomain): (node: NodeId, value: IntervalDomain | undefined) => void;
	getInterval(node: NodeId, state?: StateDomain): IntervalDomain | undefined;
}

/**
 * The control flow graph visitor to infer scalar numeric values using abstract interpretation.
 */
export class NumericIntervalInferenceVisitor extends AbstractInterpretationVisitor<StateAbstractDomain<IntervalDomain>> implements IntervalValueDomainAccess<StateAbstractDomain<IntervalDomain>> {
	constructor(config: AbsintVisitorConfiguration) {
		super(config, StateAbstractDomain.top(IntervalDomain.top()));
	}

	protected override onNumberConstant({ vertex, node}: {
		vertex: DataflowGraphVertexValue;
		node:   RNumber<ParentInformation>
	}) {
		super.onNumberConstant({ vertex, node });

		if(node.content.complexNumber) {
			// For complex numbers, we do not perform interval analysis.
			numericInferenceLogger.warn(`NumericInferenceVisitor: Skipping complex number constant at node ID ${node.info.id}`);
			return;
		}

		if(node.content.markedAsInt) {
			numericInferenceLogger.warn(`NumericInferenceVisitor: Numbers are tracked as floating-point values, therefore precision might be lost for integer at node ID ${node.info.id}`);
		}

		if(Number.isNaN(node.content.num)) {
			// NaN is part of the general Top, which is represented as undefined in the state abstract domain, so we can just skip it here.
			return;
		}

		const interval = IntervalDomain.scalar(node.content.num, this.config.ctx.config.abstractInterpretation.numeric.significantFigures);
		this.currentState.set(node.info.id, interval);
	}

	protected override onFunctionCall({ call}: { call: DataflowGraphVertexFunctionCall }) {
		super.onFunctionCall({ call });

		if(this.currentState.isBottom()) {
			return;
		}

		const result = applyIntervalExpressionSemantics(call.name, call.args, this, this.config.ctx.config.abstractInterpretation.numeric.significantFigures);

		if(isUndefined(result)) {
			return;
		}

		return this.currentState.set(call.id, result);
	}

	setInterval(state: StateAbstractDomain<IntervalDomain>): (node: NodeId, value: (IntervalDomain | undefined)) => void {
		return (node: NodeId, interval: IntervalDomain | undefined) => isUndefined(interval) ? state.remove(node) : state.set(node, interval);
	}

	getInterval(node: NodeId, state?: StateAbstractDomain<IntervalDomain>): IntervalDomain | undefined {
		return this.getAbstractValue(node, state);
	}

	protected override applyConditionSemantics(state: StateAbstractDomain<IntervalDomain>, conditionNodeId: NodeId, trueBranch: boolean): StateAbstractDomain<IntervalDomain> {
		let result: StateAbstractDomain<IntervalDomain> | undefined;

		const { applyConditionSemantics: intervalPositiveSemantics, applyNegatedConditionSemantics: intervalNegativeSemantics } = getIntervalConditionSemantics<StateAbstractDomain<IntervalDomain>, this>();

		if(trueBranch) {
			result = intervalPositiveSemantics(
				conditionNodeId,
				state,
				this,
				this.config.dfg);
		} else {
			result = intervalNegativeSemantics(
				conditionNodeId,
				state,
				this,
				this.config.dfg);
		}

		return result;
	}
}
