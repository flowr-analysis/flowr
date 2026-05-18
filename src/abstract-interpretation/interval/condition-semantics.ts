import { Identifier } from '../../dataflow/environments/identifier';
import type { IntervalDomain } from '../domains/interval-domain';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { AbstractDomain, type AnyAbstractDomain } from '../domains/abstract-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../../util/logic';
import { FloatingPointComparison } from '../../util/floating-point';
import { getMin } from '../../util/numbers';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type { ConditionAppliers, ConditionSemanticsMapperInfo } from '../absint-condition-semantics';
import {
	binaryConditionSemanticsGuard,
	createConditionApplier,
	unaryConditionSemanticsGuard,
	unaryIdentityConditionSemantics
} from '../absint-condition-semantics';
import type { AbstractInterpretationVisitor } from '../absint-visitor';
import type { IntervalInference } from './numeric-interval-inference';

type IntervalConditionSemanticsVisitor<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = AbstractInterpretationVisitor<StateDomain> & IntervalInference<StateDomain>;

/**
 * Wrapper for the interval condition semantics that adds all interval specific condition semantics and returns the
 * applyConditionSemantics and applyNegatedConditionSemantics functions.
 */
export function getIntervalConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(): ConditionAppliers<StateDomain, Visitor> {
	return createConditionApplier<StateDomain, Visitor>(getIntervalSemanticsMapper<StateDomain, Visitor>(), applyUnknownPositiveCondition, applyUnknownNegativeCondition);
}

function getIntervalSemanticsMapper<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(): readonly ConditionSemanticsMapperInfo<StateDomain, Visitor>[] {
	return [
		[Identifier.make('=='), binaryConditionSemanticsGuard(intervalEqualsOp), binaryConditionSemanticsGuard(intervalNotEqualsOp)],
		[Identifier.make('!='), binaryConditionSemanticsGuard(intervalNotEqualsOp), binaryConditionSemanticsGuard(intervalEqualsOp)],
		[Identifier.make('>'), binaryConditionSemanticsGuard(intervalGreaterOp), binaryConditionSemanticsGuard(intervalLessEqualOp)],
		[Identifier.make('>='), binaryConditionSemanticsGuard(intervalGreaterEqualOp), binaryConditionSemanticsGuard(intervalLessOp)],
		[Identifier.make('<'), binaryConditionSemanticsGuard(intervalLessOp), binaryConditionSemanticsGuard(intervalGreaterEqualOp)],
		[Identifier.make('<='), binaryConditionSemanticsGuard(intervalLessEqualOp), binaryConditionSemanticsGuard(intervalGreaterOp)],
		[Identifier.make('is.na'), unaryConditionSemanticsGuard(intervalIsNaFn), unaryConditionSemanticsGuard(unaryIdentityConditionSemantics)],
	] as const;
}

function applyUnknownPositiveCondition<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(argNodeId: NodeId | undefined, state: StateDomain, visitor: Visitor) {
	if(isUndefined(argNodeId)) {
		return state;
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = visitor.getInterval(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating an expression and evaluating a condition, we can just apply the semantics for evaluating an expression
	// in this case.
	if(argState?.isValue() && argState.value[0] == 0 && argState.value[1] == 0) {
		return state.bottom();
	}

	return state;
}

function applyUnknownNegativeCondition<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(argNodeId: NodeId | undefined, state: StateDomain, visitor: Visitor) {
	if(isUndefined(argNodeId)) {
		return state;
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = visitor.getInterval(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating a negated expression and evaluating a negated condition, we can just apply the semantics for
	// evaluating a negated expression in this case.
	if(argState?.isValue() && (0 < argState.value[0] || argState.value[1] < 0)) {
		return state.bottom();
	}

	return state;
}

function intervalEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor) {
	const leftValue = visitor.getInterval(leftNodeId, state);
	const rightValue = visitor.getInterval(rightNodeId, state);

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

	visitor.getVariableOrigins(leftNodeId).forEach(originNodeId => {
		if(isUndefined(meet)) {
			visitor.setInterval(state, originNodeId, undefined);
		} else {
			visitor.setInterval(state, originNodeId, meet);
		}
	});
	visitor.getVariableOrigins(rightNodeId).forEach(originNodeId => {
		if(isUndefined(meet)) {
			visitor.setInterval(state, originNodeId, undefined);
		} else {
			visitor.setInterval(state, originNodeId, meet);
		}
	});

	return state;
}

function intervalNotEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const leftValue = visitor.getInterval(leftNodeId, state);
	const rightValue = visitor.getInterval(rightNodeId, state);

	if(isNotUndefined(leftValue) && leftValue.isValue() && isNotUndefined(rightValue) && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(a == b && c == d && leftValue?.equals(rightValue)) {
			return state.bottom();
		}
	}

	return state;
}

function intervalGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor) {
	const leftValue = visitor.getInterval(leftNodeId, state);
	const rightValue = visitor.getInterval(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}

	if(leftValue.isValue() && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c < b || FloatingPointComparison.isNearlyLess(c, b, leftValue.significantFigures) != Ternary.Never) {
			const smallestSignificantFigures = getMin([leftValue.significantFigures, rightValue.significantFigures].filter(isNotUndefined));
			const maxLowerBound = a < c ? c : a;
			visitor.getVariableOrigins(leftNodeId).forEach(originNodeId => {
				visitor.setInterval(state, originNodeId, leftValue.create([maxLowerBound, b], smallestSignificantFigures));
			});
			const minUpperBound = b < d ? b : d;
			visitor.getVariableOrigins(rightNodeId).forEach(originNodeId => {
				visitor.setInterval(state, originNodeId, rightValue.create([c, minUpperBound], smallestSignificantFigures));
			});
			return state;
		}
	}

	return state.bottom();
}

/**
 * Simply calls the {@link intervalGreaterOp} with the left and right nodes switched, as `a < b` is equivalent to `b > a`.
 */
function intervalLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor) {
	return intervalGreaterOp(rightNodeId, leftNodeId, state, visitor);
}

function intervalGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const leftValue = visitor.getInterval(leftNodeId, state);
	const rightValue = visitor.getInterval(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}

	if(leftValue.isValue() && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c <= b || FloatingPointComparison.isNearlyLessOrEqual(c, b, leftValue.significantFigures) != Ternary.Never) {
			const smallestSignificantFigures = getMin([leftValue.significantFigures, rightValue.significantFigures].filter(isNotUndefined));
			const maxAC = a < c ? c : a;
			visitor.getVariableOrigins(leftNodeId).forEach(originNodeId => {
				visitor.setInterval(state, originNodeId, leftValue.create([maxAC, b], smallestSignificantFigures));
			});
			const minBD = b < d ? b : d;
			visitor.getVariableOrigins(rightNodeId).forEach(originNodeId => {
				visitor.setInterval(state, originNodeId, rightValue.create([c, minBD], smallestSignificantFigures));
			});
			return state;
		}
	}

	return state.bottom();
}

/**
 * Simply calls the {@link intervalGreaterEqualOp} with the left and right nodes switched, as `a <= b` is equivalent to `b >= a`.
 */
function intervalLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	return intervalGreaterEqualOp(rightNodeId, leftNodeId, state, visitor);
}

function intervalIsNaFn<StateDomain extends AnyStateDomain<AnyAbstractDomain>, Visitor extends IntervalConditionSemanticsVisitor<StateDomain>>(argNodeId: NodeId, state: StateDomain, visitor: Visitor): StateDomain {
	const argValue = visitor.getInterval(argNodeId, state);

	if(isUndefined(argValue)) {
		return state;
	}

	return state.bottom();
}