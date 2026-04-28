import { ClosedPentagonDomain } from './closed-pentagon-domain';
import type { AbsintVisitorConfiguration } from '../absint-visitor';
import { AbstractInterpretationVisitor } from '../absint-visitor';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { IntervalDomain } from '../domains/interval-domain';
import { numericInferenceLogger } from '../interval/numeric-interval-inference';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { applyPentagonExpressionSemantics } from './expression-semantics';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export class NumericPentagonInferenceVisitor extends AbstractInterpretationVisitor<ClosedPentagonDomain> {
	constructor(config: AbsintVisitorConfiguration) {
		super(config, ClosedPentagonDomain.top(ClosedPentagonValueDomain.top()));
	}

	protected override onAssignmentCall({ call, target, source }: {
		call:    DataflowGraphVertexFunctionCall,
		target?: NodeId,
		source?: NodeId
	}): void {
		super.onAssignmentCall({ call, target, source });

		if(isNotUndefined(source) && isNotUndefined(target)) {
			const sourcePentagon = this.currentState.get(source);
			const targetPentagon = this.currentState.get(target);

			if(sourcePentagon?.isValue() && targetPentagon?.isValue()) {
				sourcePentagon.value.upperBounds.add(target);
				targetPentagon.value.upperBounds.add(source);
			}
		}
	}

	protected override onNumberConstant({ vertex, node }: { vertex: DataflowGraphVertexValue, node: RNumber<ParentInformation> }) {
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

		const pentagon = new ClosedPentagonValueDomain({
			interval:    IntervalDomain.scalar(node.content.num, this.config.ctx.config.abstractInterpretation.numeric.significantFigures),
			upperBounds: new UpperBoundsValueDomain(new Set())
		});
		this.currentState.set(node.info.id, pentagon);
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }) {
		super.onFunctionCall({ call });

		if(this.currentState.isBottom()) {
			return;
		}

		const result = applyPentagonExpressionSemantics(call.name, call.args, this, this.config.ctx.config.abstractInterpretation.numeric.significantFigures);

		if(isUndefined(result)) {
			return;
		}

		return this.currentState.set(call.id, result);
	}
}