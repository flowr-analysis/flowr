import { ClosedPentagonDomain } from './closed-pentagon-domain';
import type { AbsintVisitorConfiguration } from '../absint-visitor';
import { AbstractInterpretationVisitor } from '../absint-visitor';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexValue } from '../../dataflow/graph/vertex';
import type { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { IntervalDomain } from '../domains/interval-domain';
import type { IntervalValueDomainAccess } from '../interval/numeric-interval-inference';
import { numericInferenceLogger } from '../interval/numeric-interval-inference';
import { UpperBoundsValueDomain } from './upper-bounds/upper-bounds-value-domain';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { applyPentagonExpressionSemantics } from './expression-semantics';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getIntervalConditionSemantics } from '../interval/condition-semantics';
import { getUpperBoundsConditionSemantics } from './upper-bounds/upper-bounds-condition-semantics';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type { AnyAbstractDomain } from '../domains/abstract-domain';

/**
 * Interface that needs to be implemented by any {@link AbstractInterpretationVisitor} that applies upper bounds
 * condition semantics.
 */
export interface UpperBoundsDomainAccess<StateDomain extends AnyStateDomain<AnyAbstractDomain>> {
	setUpperBounds(state: StateDomain): (node: NodeId, value: UpperBoundsValueDomain) => void;
	getUpperBounds(node: NodeId, state?: StateDomain): UpperBoundsValueDomain;
	getUniqueOrigin(node: NodeId): NodeId | undefined;
}

export class NumericPentagonInferenceVisitor extends AbstractInterpretationVisitor<ClosedPentagonDomain> implements IntervalValueDomainAccess<ClosedPentagonDomain>, UpperBoundsDomainAccess<ClosedPentagonDomain> {
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
			const sourceOrigin = this.getUniqueOrigin(source);
			if(isUndefined(sourceOrigin)) {
				return;
			}

			const sourcePentagon = this.currentState.get(sourceOrigin);
			const targetPentagon = this.currentState.get(target);

			if(sourcePentagon?.isValue() && targetPentagon?.isValue()) {
				sourcePentagon.value.upperBounds.add(target);
				targetPentagon.value.upperBounds.add(sourceOrigin);
				// To every upper-bounds that contains source, also add target: a small reduction step to increase precision.
				if(this.currentState.isValue()) {
					this.currentState.value.forEach(closedPentagonValue => {
						if(closedPentagonValue.value.upperBounds.has(sourceOrigin)) {
							closedPentagonValue.value.upperBounds.add(target);
						}
					});
				}
				this.currentState.set(sourceOrigin, sourcePentagon);
				this.currentState.set(target, targetPentagon);
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
			upperBounds: UpperBoundsValueDomain.top()
		});
		this.currentState.set(node.info.id, pentagon);
	}

	protected override onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }) {
		super.onFunctionCall({ call });

		if(this.currentState.isBottom()) {
			return;
		}

		const result = applyPentagonExpressionSemantics(call.id, call.name, call.args, this, this.currentState, this.config.ctx.config.abstractInterpretation.numeric.significantFigures);

		if(isUndefined(result)) {
			return;
		}

		return this.currentState.set(call.id, result);
	}

	setInterval(state: ClosedPentagonDomain): (node: NodeId, value: (IntervalDomain | undefined)) => void {
		return (node: NodeId, value: (IntervalDomain | undefined)) => {
			if(isUndefined(value)) {
				state.remove(node);
			} else {
				let pentagon = state.get(node);
				if(isUndefined(pentagon)) {
					pentagon = ClosedPentagonValueDomain.top();
				}
				pentagon.value.interval = value;
				state.set(node, pentagon);
			}
		};
	}

	getInterval(node: NodeId, state?: ClosedPentagonDomain): IntervalDomain | undefined {
		return this.getAbstractValue(node, state)?.value.interval;
	}

	setUpperBounds(state: ClosedPentagonDomain): (node: NodeId, value: UpperBoundsValueDomain) => void {
		return (node: NodeId, value: UpperBoundsValueDomain) => {
			const pentagon = state.get(node);
			if(isUndefined(pentagon)) {
				// As we currently cannot describe that we have upper bounds-info but not know whether it is a numeric scalar value, we cannot infer upper-bounds values for non-numeric scalar values.
				return;
			}
			pentagon.value.upperBounds = value;
			state.set(node, pentagon);
		};
	}

	getUpperBounds(node: NodeId, state?: ClosedPentagonDomain): UpperBoundsValueDomain {
		return this.getAbstractValue(node, state)?.value.upperBounds ?? UpperBoundsValueDomain.top();
	}

	getUniqueOrigin(node: NodeId): NodeId | undefined {
		const origins = this.getVariableOrigins(node);
		if(origins.length === 0) {
			return node;
		}
		if(origins.length === 1) {
			return origins[0];
		}
		return undefined;
	}

	protected override applyConditionSemantics(state: ClosedPentagonDomain, conditionNodeId: NodeId, trueBranch: boolean): ClosedPentagonDomain {
		const reducePentagon = (state: ClosedPentagonDomain) => state.create(state.value);

		const { applyConditionSemantics: intervalPositiveSemantics, applyNegatedConditionSemantics: intervalNegativeSemantics } = getIntervalConditionSemantics<ClosedPentagonDomain, this>();
		const { applyConditionSemantics: upperBoundsPositiveSemantics, applyNegatedConditionSemantics: upperBoundsNegativeSemantics } = getUpperBoundsConditionSemantics<ClosedPentagonDomain, this>();

		if(trueBranch) {
			return reducePentagon(
				upperBoundsPositiveSemantics(
					conditionNodeId,
					intervalPositiveSemantics(
						conditionNodeId,
						state,
						this,
						this.config.dfg
					),
					this,
					this.config.dfg
				)
			);
		}
		return reducePentagon(
			upperBoundsNegativeSemantics(
				conditionNodeId,
				intervalNegativeSemantics(
					conditionNodeId,
					state,
					this,
					this.config.dfg
				),
				this,
				this.config.dfg
			)
		);
	}
}