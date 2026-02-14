import { AbstractInterpretationVisitor } from '../absint-visitor';
import { IntervalDomain } from '../domains/interval-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { applyIntervalExpressionSemantics } from './semantics';
import { isUndefined } from '../../util/assert';
import { log } from '../../util/log';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MutableStateAbstractDomain } from '../domains/state-abstract-domain';
import { applyIntervalConditionSemantics, applyNegatedIntervalConditionSemantics } from './condition-semantics';
import { AbstractDomain } from '../domains/abstract-domain';

export const numericInferenceLogger = log.getSubLogger({ name: 'numeric-inference' });

/**
 * The control flow graph visitor to infer scalar numeric values using abstract interpretation.
 */
export class NumericInferenceVisitor extends AbstractInterpretationVisitor<IntervalDomain> {
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

		const interval = IntervalDomain.scalar(node.content.num);
		this.updateState(node.info.id, interval);
	}

	protected override onFunctionCall({ call}: { call: DataflowGraphVertexFunctionCall }) {
		super.onFunctionCall({ call });

		const result = applyIntervalExpressionSemantics(call.name, call.args, this);

		if(isUndefined(result)) {
			return;
		}

		return this.updateState(call.id, result);
	}

	protected override applyConditionSemantics(conditionNodeId: NodeId, trueBranch: boolean): MutableStateAbstractDomain<IntervalDomain> | undefined {
		const conditionHeadState = this.trace.get(conditionNodeId);
		const newState = isUndefined(conditionHeadState) ? undefined : AbstractDomain.joinAll([conditionHeadState]);

		const vertex = this.config.dfg.getVertex(conditionNodeId);

		let result: MutableStateAbstractDomain<IntervalDomain> | undefined;

		if(trueBranch) {
			result = applyIntervalConditionSemantics(vertex, newState, this, this.config.dfg);
		} else {
			result = applyNegatedIntervalConditionSemantics(vertex, newState, this, this.config.dfg);
		}

		return result;
	}
}