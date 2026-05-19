import type { AnyStateDomain } from '../../domains/state-domain-like';
import type { AnyAbstractDomain } from '../../domains/abstract-domain';
import { AbstractDomain } from '../../domains/abstract-domain';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import { isNotUndefined, isUndefined } from '../../../util/assert';
import type { ConditionAppliers, ConditionSemanticsMapperInfo } from '../../absint-condition-semantics';
import {
	binaryConditionSemanticsGuard,
	createConditionApplier,
	unaryConditionSemanticsGuard,
	unaryIdentityConditionSemantics
} from '../../absint-condition-semantics';
import type { AbstractInterpretationVisitor } from '../../absint-visitor';
import type { UpperBoundsInference } from '../numeric-pentagon-inference';

type UpperBoundsConditionSemanticsVisitor<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = AbstractInterpretationVisitor<StateDomain> & UpperBoundsInference<StateDomain>;

/**
 * Wrapper for the upper bounds condition semantics that adds all upper bounds specific condition semantics and returns
 * the applyConditionSemantics and applyNegatedConditionSemantics functions.
 */
export function getUpperBoundsConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(): ConditionAppliers<StateDomain, Visitor> {
	return createConditionApplier<StateDomain, Visitor>(UpperBoundsSemanticsMapper<StateDomain, Visitor>());
}

export const UpperBoundsSemanticsMapper = <StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>() => [
	[Identifier.make('=='), binaryConditionSemanticsGuard(upperBoundsEqualsOp), binaryConditionSemanticsGuard(upperBoundsNotEqualsOp)],
	[Identifier.make('!='), binaryConditionSemanticsGuard(upperBoundsNotEqualsOp), binaryConditionSemanticsGuard(upperBoundsEqualsOp)],
	[Identifier.make('>'), binaryConditionSemanticsGuard(upperBoundsGreaterOp), binaryConditionSemanticsGuard(upperBoundsLessEqualOp)],
	[Identifier.make('>='), binaryConditionSemanticsGuard(upperBoundsGreaterEqualOp), binaryConditionSemanticsGuard(upperBoundsLessOp)],
	[Identifier.make('<'), binaryConditionSemanticsGuard(upperBoundsLessOp), binaryConditionSemanticsGuard(upperBoundsGreaterEqualOp)],
	[Identifier.make('<='), binaryConditionSemanticsGuard(upperBoundsLessEqualOp), binaryConditionSemanticsGuard(upperBoundsGreaterOp)],
	[Identifier.make('is.na'), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics)],
] as const satisfies readonly ConditionSemanticsMapperInfo<StateDomain, Visitor>[];

function upperBoundsEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const leftValue = visitor.getUpperBounds(leftNodeId, state);
	const rightValue = visitor.getUpperBounds(rightNodeId, state);

	// We need to include the origin ids instead of the reference ids if the variable has an origin.
	// We can only include the origin if there is only one origin, as we only then know that this is the only possible origin.
	const leftOrigin = visitor.getOriginIfUnique(leftNodeId);
	const rightOrigin = visitor.getOriginIfUnique(rightNodeId);

	const resultingUpperBounds = AbstractDomain.meetAll([
		leftValue,
		rightValue,
		new UpperBoundsValueDomain(new Set([leftOrigin, rightOrigin].filter(isNotUndefined)))
	].filter(isNotUndefined));

	if(resultingUpperBounds.isBottom()) {
		return state.bottom();
	}

	if(isNotUndefined(leftOrigin)) {
		visitor.setUpperBounds(state, leftOrigin, resultingUpperBounds);
	}
	if(isNotUndefined(rightOrigin)) {
		visitor.setUpperBounds(state, rightOrigin, resultingUpperBounds);
	}

	return state;
}

function upperBoundsNotEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const leftValue = visitor.getUpperBounds(leftNodeId, state);
	const rightValue = visitor.getUpperBounds(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}
	if(leftValue.isBottom() || rightValue.isBottom()) {
		return state.bottom();
	}

	// We can only argue if both sides have exactly one origin (or are the origin).
	// In that case, if both sides include each others origins, they must be equal and therefore cannot be inequal.
	const leftOrigin = visitor.getOriginIfUnique(leftNodeId);
	const rightOrigin = visitor.getOriginIfUnique(rightNodeId);
	if(isNotUndefined(leftOrigin) && isNotUndefined(rightOrigin) && leftValue.has(rightOrigin) && rightValue.has(leftOrigin)) {
		return state.bottom();
	}

	return state;
}

function upperBoundsGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	// We want to update the upper bounds of the right side, which we can only do if there is exactly one origin that we can update.
	const rightOrigin = visitor.getOriginIfUnique(rightNodeId);
	if(isUndefined(rightOrigin)) {
		return state;
	}

	const leftValue = visitor.getUpperBounds(leftNodeId, state);
	const rightValue = visitor.getUpperBounds(rightNodeId, state);

	const leftOrigin = visitor.getOriginIfUnique(leftNodeId);

	// We can only include the left side as upper bounds, if the left side has exactly one origin that we can include.
	const resultingUpperBounds = AbstractDomain.meetAll([
		leftValue,
		rightValue,
		new UpperBoundsValueDomain(new Set([leftOrigin].filter(isNotUndefined)))
	].filter(isNotUndefined));

	// Update the upper-bounds of the right side
	if(resultingUpperBounds.isBottom()) {
		return state.bottom();
	}

	visitor.setUpperBounds(state, rightOrigin, resultingUpperBounds);

	return state;
}

/**
 * Simply calls {@link upperBoundsGreaterEqualOp} as we are only able to infer closed upper bounds (`>=`) and therefore
 * `>` has the same semantics as `>=`.
 */
function upperBoundsGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return upperBoundsGreaterEqualOp(leftNodeId, rightNodeId, state, visitor);
}

/**
 * Simply calls {@link upperBoundsGreaterEqualOp} with the left and right nodes switched, as `a <= b` is equivalent to `b >= a`.
 */
function upperBoundsLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return upperBoundsGreaterEqualOp(rightNodeId, leftNodeId, state, visitor);
}

/**
 * Simply calls {@link upperBoundsGreaterEqualOp} with the left and right nodes switched, as `a < b` is equivalent to `b > a`.
 * Further, we are only able to infer closed upper bounds (`>=`) and therefore `>` has the same semantics as `>=`.
 */
function upperBoundsLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return upperBoundsGreaterOp(rightNodeId, leftNodeId, state, visitor);
}
