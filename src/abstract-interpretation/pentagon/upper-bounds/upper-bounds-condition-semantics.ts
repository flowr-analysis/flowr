import type { AnyStateDomain } from '../../domains/state-domain-like';
import type { AnyAbstractDomain } from '../../domains/abstract-domain';
import { AbstractDomain } from '../../domains/abstract-domain';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import { isNotUndefined, isUndefined } from '../../../util/assert';
import type {
	ConditionSemanticsMapperInfo,
	GetValue,
	GetVariableOrigins,
	SetValue,
	UnaryConditionSemantics } from '../../absint-condition-semantics';
import {
	binaryConditionSemanticsGuard,
	createConditionApplier,
	unaryConditionSemanticsGuard,
	unaryIdentityConditionSemantics
} from '../../absint-condition-semantics';

/**
 *
 */
export function getUpperBoundsConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(): { applyConditionSemantics: UnaryConditionSemantics<UpperBoundsValueDomain, StateDomain>, applyNegatedConditionSemantics: UnaryConditionSemantics<UpperBoundsValueDomain, StateDomain> } {
	return createConditionApplier<UpperBoundsValueDomain, StateDomain>(getUpperBoundsSemanticsMapper<StateDomain>());
}

function getUpperBoundsSemanticsMapper<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(): ConditionSemanticsMapperInfo<UpperBoundsValueDomain, StateDomain>[] {
	return [
		[Identifier.make('=='), binaryConditionSemanticsGuard(upperBoundsEqualsOp), binaryConditionSemanticsGuard(upperBoundsNotEqualsOp)],
		[Identifier.make('!='), binaryConditionSemanticsGuard(upperBoundsNotEqualsOp), binaryConditionSemanticsGuard(upperBoundsEqualsOp)],
		[Identifier.make('>'), binaryConditionSemanticsGuard(upperBoundsGreaterOp), binaryConditionSemanticsGuard(upperBoundsLessEqualOp)],
		[Identifier.make('>='), binaryConditionSemanticsGuard(upperBoundsGreaterEqualOp), binaryConditionSemanticsGuard(upperBoundsLessOp)],
		[Identifier.make('<'), binaryConditionSemanticsGuard(upperBoundsLessOp), binaryConditionSemanticsGuard(upperBoundsGreaterEqualOp)],
		[Identifier.make('<='), binaryConditionSemanticsGuard(upperBoundsLessEqualOp), binaryConditionSemanticsGuard(upperBoundsGreaterOp)],
		[Identifier.make('is.na'), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics)],
	] as const satisfies ConditionSemanticsMapperInfo<UpperBoundsValueDomain, StateDomain>[];
}

// Semantics

function upperBoundsEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<UpperBoundsValueDomain, StateDomain>, getUb: GetValue<UpperBoundsValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getUb(leftNodeId, state);
	const rightValue = getUb(rightNodeId, state);

	// We need to include the origin ids instead of the reference ids if the variable has an origin.
	// We can only include the origin if there is only one origin, as we only then know that this is the only possible origin.
	const originNodeIds = new Set<NodeId>();

	const leftOrigins = getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = getVariableOrigins(rightNodeId);
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
		set(state)(leftOrigin, resultingUpperBounds);
	}
	if(rightOrigins.length <= 1) {
		set(state)(rightOrigin, resultingUpperBounds);
	}

	return state;
}

function upperBoundsNotEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, _set: SetValue<UpperBoundsValueDomain, StateDomain>, getUb: GetValue<UpperBoundsValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getUb(leftNodeId, state);
	const rightValue = getUb(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}
	if(leftValue.isBottom() || rightValue.isBottom()) {
		return state.bottom();
	}

	// We can only argue if both sides have exactly one origin (or are the origin).
	// In that case, if both sides include each others origins, they must be equal and therefore cannot be inequal.
	const leftOrigins = getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = getVariableOrigins(rightNodeId);
	const rightOrigin = rightOrigins.length === 1 ? rightOrigins[0] : rightNodeId;
	if(leftOrigins.length <= 1 && rightOrigins.length <= 1 && leftValue.has(rightOrigin) && rightValue.has(leftOrigin)) {
		return state.bottom();
	}

	return state;
}

function upperBoundsGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<UpperBoundsValueDomain, StateDomain>, getUb: GetValue<UpperBoundsValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getUb(leftNodeId, state);
	const rightValue = getUb(rightNodeId, state);

	const leftOrigins = getVariableOrigins(leftNodeId);
	const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0] : leftNodeId;
	const rightOrigins = getVariableOrigins(rightNodeId);
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

	set(state)(rightOrigin, resultingUpperBounds);

	return state;
}

function upperBoundsGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<UpperBoundsValueDomain, StateDomain>, getUb: GetValue<UpperBoundsValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return upperBoundsGreaterEqualOp(leftNodeId, rightNodeId, state, set, getUb, getVariableOrigins);
}

function upperBoundsLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<UpperBoundsValueDomain, StateDomain>, getUb: GetValue<UpperBoundsValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return upperBoundsGreaterEqualOp(rightNodeId, leftNodeId, state, set, getUb, getVariableOrigins);
}

function upperBoundsLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<UpperBoundsValueDomain, StateDomain>, getUb: GetValue<UpperBoundsValueDomain, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return upperBoundsGreaterOp(rightNodeId, leftNodeId, state, set, getUb, getVariableOrigins);
}
