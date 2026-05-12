import { Identifier } from '../../dataflow/environments/identifier';
import type { IntervalDomain } from '../domains/interval-domain';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { AbstractDomain, type AnyAbstractDomain } from '../domains/abstract-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../../util/logic';
import { FloatingPointComparison } from '../../util/floating-point';
import { getMin } from '../../util/numbers';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type {
	ConditionSemanticsMapperInfo,
	GetValue,
	GetVariableOrigins,
	SetValue,
	UnaryConditionSemantics
} from '../absint-condition-semantics';
import {
	binaryConditionSemanticsGuard,
	createConditionApplier,
	unaryConditionSemanticsGuard,
	unaryIdentityConditionSemantics
} from '../absint-condition-semantics';

/**
 *
 */
export function getIntervalConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(): { applyConditionSemantics: UnaryConditionSemantics<IntervalDomain | undefined, StateDomain>, applyNegatedConditionSemantics: UnaryConditionSemantics<IntervalDomain | undefined, StateDomain> } {
	return createConditionApplier<IntervalDomain | undefined, StateDomain>(getIntervalSemanticsMapper<StateDomain>(), onUnknownPositiveFunctionCall, onUnknownNegativeFunctionCall);
}

function getIntervalSemanticsMapper<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(): ConditionSemanticsMapperInfo<IntervalDomain | undefined, StateDomain>[] {
	return [
		[Identifier.make('=='), binaryConditionSemanticsGuard(intervalEqualsOp), binaryConditionSemanticsGuard(intervalNotEqualsOp)],
		[Identifier.make('!='), binaryConditionSemanticsGuard(intervalNotEqualsOp), binaryConditionSemanticsGuard(intervalEqualsOp)],
		[Identifier.make('>'), binaryConditionSemanticsGuard(intervalGreaterOp), binaryConditionSemanticsGuard(intervalLessEqualOp)],
		[Identifier.make('>='), binaryConditionSemanticsGuard(intervalGreaterEqualOp), binaryConditionSemanticsGuard(intervalLessOp)],
		[Identifier.make('<'), binaryConditionSemanticsGuard(intervalLessOp), binaryConditionSemanticsGuard(intervalGreaterEqualOp)],
		[Identifier.make('<='), binaryConditionSemanticsGuard(intervalLessEqualOp), binaryConditionSemanticsGuard(intervalGreaterOp)],
		[Identifier.make('is.na'), unaryConditionSemanticsGuard(intervalIsNaFn), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics)],
	] as const satisfies ConditionSemanticsMapperInfo<IntervalDomain | undefined, StateDomain>[];
}

function onUnknownPositiveFunctionCall<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, _setValue: SetValue<IntervalDomain | undefined, StateDomain>, getValue: GetValue<IntervalDomain | undefined, StateDomain>) {
	if(isUndefined(argNodeId)) {
		return state;
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = getValue(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating an expression and evaluating a condition, we can just apply the semantics for evaluating an expression
	// in this case.
	if(argState?.isValue() && argState.value[0] == 0 && argState.value[1] == 0) {
		return state.bottom();
	}

	return state;
}

function onUnknownNegativeFunctionCall<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, _setValue: SetValue<IntervalDomain | undefined, StateDomain>, getValue: GetValue<IntervalDomain | undefined, StateDomain>) {
	if(isUndefined(argNodeId)) {
		return state;
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = getValue(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating a negated expression and evaluating a negated condition, we can just apply the semantics for
	// evaluating a negated expression in this case.
	if(argState?.isValue() && (0 < argState.value[0] || argState.value[1] < 0)) {
		return state.bottom();
	}

	return state;
}

// Semantics

function intervalEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>, getVariableOrigins: GetVariableOrigins) {
	const leftValue = getInterval(leftNodeId, state);
	const rightValue = getInterval(rightNodeId, state);

	let meet: IntervalDomain | undefined = undefined;
	// TOP = undefined is the neutral element in the meet
	if(isUndefined(leftValue)) {
		meet = rightValue;
	} else if(isUndefined(rightValue)) {
		meet = leftValue;
	} else {
		meet = AbstractDomain.meetAll([leftValue, rightValue]);
	}

	if(meet?.isBottom()) {
		return state.bottom();
	}

	getVariableOrigins(leftNodeId).forEach(originNodeId => {
		if(isUndefined(meet)) {
			set(state)(originNodeId, undefined);
		} else {
			set(state)(originNodeId, meet);
		}
	});
	getVariableOrigins(rightNodeId).forEach(originNodeId => {
		if(isUndefined(meet)) {
			set(state)(originNodeId, undefined);
		} else {
			set(state)(originNodeId, meet);
		}
	});

	return state;
}

function intervalNotEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, _set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>): StateDomain {
	const leftValue = getInterval(leftNodeId, state);
	const rightValue = getInterval(rightNodeId, state);

	if(isNotUndefined(leftValue) && leftValue.isValue() && isNotUndefined(rightValue) && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(a == b && c == d && leftValue?.equals(rightValue)) {
			return state.bottom();
		}
	}

	return state;
}

function intervalGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>, getVariableOrigins: GetVariableOrigins) {
	const leftValue = getInterval(leftNodeId, state);
	const rightValue = getInterval(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}

	if(leftValue.isValue() && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c < b || FloatingPointComparison.isNearlyLess(c, b, leftValue.significantFigures) != Ternary.Never) {
			const smallestSignificantFigures = getMin([leftValue.significantFigures, rightValue.significantFigures].filter(isNotUndefined));
			const maxLowerBound = a < c ? c : a;
			getVariableOrigins(leftNodeId).forEach(originNodeId => {
				set(state)(originNodeId, leftValue.create([maxLowerBound, b], smallestSignificantFigures));
			});
			const minUpperBound = b < d ? b : d;
			getVariableOrigins(rightNodeId).forEach(originNodeId => {
				set(state)(originNodeId, rightValue.create([c, minUpperBound], smallestSignificantFigures));
			});
			return state;
		}
	}

	return state.bottom();
}

function intervalLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>, getVariableOrigins: GetVariableOrigins) {
	return intervalGreaterOp(rightNodeId, leftNodeId, state, set, getInterval, getVariableOrigins);
}

function intervalGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	const leftValue = getInterval(leftNodeId, state);
	const rightValue = getInterval(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}

	if(leftValue.isValue() && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c <= b || FloatingPointComparison.isNearlyLessOrEqual(c, b, leftValue.significantFigures) != Ternary.Never) {
			const smallestSignificantFigures = getMin([leftValue.significantFigures, rightValue.significantFigures].filter(isNotUndefined));
			const maxAC = a < c ? c : a;
			getVariableOrigins(leftNodeId).forEach(originNodeId => {
				set(state)(originNodeId, leftValue.create([maxAC, b], smallestSignificantFigures));
			});
			const minBD = b < d ? b : d;
			getVariableOrigins(rightNodeId).forEach(originNodeId => {
				set(state)(originNodeId, rightValue.create([c, minBD], smallestSignificantFigures));
			});
			return state;
		}
	}

	return state.bottom();
}

function intervalLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return intervalGreaterEqualOp(rightNodeId, leftNodeId, state, set, getInterval, getVariableOrigins);
}

function intervalIsNaFn<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId, state: StateDomain, _set: SetValue<IntervalDomain | undefined, StateDomain>, getInterval: GetValue<IntervalDomain | undefined, StateDomain>) {
	const argValue = getInterval(argNodeId, state);

	if(isUndefined(argValue)) {
		return state;
	}

	return state.bottom();
}