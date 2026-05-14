import type { AnyStateDomain } from '../../domains/state-domain-like';
import type { AnyAbstractDomain } from '../../domains/abstract-domain';
import { AbstractDomain } from '../../domains/abstract-domain';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import { isNotUndefined, isUndefined } from '../../../util/assert';
import type { ConditionSemanticsMapperInfo, UnaryConditionSemantics } from '../../absint-condition-semantics';
import {
	binaryConditionSemanticsGuard,
	createConditionApplier,
	unaryConditionSemanticsGuard,
	unaryIdentityConditionSemantics
} from '../../absint-condition-semantics';
import type { AbstractInterpretationVisitor } from '../../absint-visitor';

/**
 * Interface that needs to be implemented by any {@link AbstractInterpretationVisitor} that applies upper bounds
 * condition semantics.
 */
export interface UpperBoundsDomainAccess<StateDomain extends AnyStateDomain<AnyAbstractDomain>> {
	setUpperBounds(state: StateDomain): (node: NodeId, value: UpperBoundsValueDomain) => void;
	getUpperBounds(node: NodeId, state?: StateDomain): UpperBoundsValueDomain;
}

type UpperBoundsConditionSemanticsVisitor<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = AbstractInterpretationVisitor<StateDomain> & UpperBoundsDomainAccess<StateDomain>;

/**
 * Wrapper for the upper bounds condition semantics that adds all upper bounds specific condition semantics and returns
 * the applyConditionSemantics and applyNegatedConditionSemantics functions.
 */
export function getUpperBoundsConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(): { applyConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor>, applyNegatedConditionSemantics: UnaryConditionSemantics<StateDomain, Visitor> } {
	return createConditionApplier<StateDomain, Visitor>(getUpperBoundsSemanticsMapper<StateDomain, Visitor>());
}

function getUpperBoundsSemanticsMapper<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(): ConditionSemanticsMapperInfo<StateDomain, Visitor>[] {
	return [
		[Identifier.make('=='), binaryConditionSemanticsGuard(upperBoundsEqualsOp), binaryConditionSemanticsGuard(upperBoundsNotEqualsOp)],
		[Identifier.make('!='), binaryConditionSemanticsGuard(upperBoundsNotEqualsOp), binaryConditionSemanticsGuard(upperBoundsEqualsOp)],
		[Identifier.make('>'), binaryConditionSemanticsGuard(upperBoundsGreaterOp), binaryConditionSemanticsGuard(upperBoundsLessEqualOp)],
		[Identifier.make('>='), binaryConditionSemanticsGuard(upperBoundsGreaterEqualOp), binaryConditionSemanticsGuard(upperBoundsLessOp)],
		[Identifier.make('<'), binaryConditionSemanticsGuard(upperBoundsLessOp), binaryConditionSemanticsGuard(upperBoundsGreaterEqualOp)],
		[Identifier.make('<='), binaryConditionSemanticsGuard(upperBoundsLessEqualOp), binaryConditionSemanticsGuard(upperBoundsGreaterOp)],
		[Identifier.make('is.na'), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics)],
	] as const satisfies ConditionSemanticsMapperInfo<StateDomain, Visitor>[];
}

// Semantics

function upperBoundsEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const leftValue = visitor.getUpperBounds(leftNodeId, state);
	const rightValue = visitor.getUpperBounds(rightNodeId, state);

	// We need to include the origin ids instead of the reference ids if the variable has an origin.
	// We can only include the origin if there is only one origin, as we only then know that this is the only possible origin.
	const originNodeIds = new Set<NodeId>();

	const leftOrigins = visitor.getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = visitor.getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;
	if(leftOrigins.length <= 1) {
		originNodeIds.add(leftOrigin);
	}
	if(rightOrigins.length <= 1) {
		originNodeIds.add(rightOrigin);
	}

	const resultingUpperBounds = AbstractDomain.meetAll([leftValue, rightValue, new UpperBoundsValueDomain(originNodeIds)].filter(isNotUndefined));

	if(resultingUpperBounds.isBottom()) {
		return state.bottom();
	}

	if(leftOrigins.length <= 1) {
		visitor.setUpperBounds(state)(leftOrigin, resultingUpperBounds);
	}
	if(rightOrigins.length <= 1) {
		visitor.setUpperBounds(state)(rightOrigin, resultingUpperBounds);
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
	const leftOrigins = visitor.getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = visitor.getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;
	if(leftOrigins.length <= 1 && rightOrigins.length <= 1 && leftValue.has(rightOrigin) && rightValue.has(leftOrigin)) {
		return state.bottom();
	}

	return state;
}

function upperBoundsGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const leftValue = visitor.getUpperBounds(leftNodeId, state);
	const rightValue = visitor.getUpperBounds(rightNodeId, state);

	const leftOrigins = visitor.getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = visitor.getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;

	// We want to upper bounds of the right side, which we can only do if there is exactly on origin that we can update.
	if(rightOrigins.length > 1) {
		return state;
	}

	// We can only include the left side as upper bounds, if the left side has exactly one origin that we can include.
	const resultingUpperBounds = AbstractDomain.meetAll([leftValue, rightValue, new UpperBoundsValueDomain(new Set(leftOrigins.length <= 1 ? [leftOrigin] : []))].filter(isNotUndefined));

	// Update the upper-bounds of the right side
	if(resultingUpperBounds.isBottom()) {
		return state.bottom();
	}

	visitor.setUpperBounds(state)(rightOrigin, resultingUpperBounds);

	return state;
}

function upperBoundsGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return upperBoundsGreaterEqualOp(leftNodeId, rightNodeId, state, visitor);
}

function upperBoundsLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return upperBoundsGreaterEqualOp(rightNodeId, leftNodeId, state, visitor);
}

function upperBoundsLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends UpperBoundsConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return upperBoundsGreaterOp(rightNodeId, leftNodeId, state, visitor);
}
