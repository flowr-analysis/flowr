import { Identifier } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { numericInferenceLogger } from './numeric-interval-inference';
import type { IntervalDomain } from '../domains/interval-domain';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { AbstractDomain, type AnyAbstractDomain } from '../domains/abstract-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../../util/logic';
import { FloatingPointComparison } from '../../util/floating-point';
import { getMin } from '../../util/numbers';
import type { AnyStateDomain } from '../domains/state-domain-like';

function getSemanticsMapper<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(): IntervalConditionSemanticsMapperInfo<StateDomain>[] {
	return [
		[Identifier.make('!'), unaryCondOpSemantics(applyNegatedIntervalConditionSemantics), unaryCondOpSemantics(applyIntervalConditionSemantics)],
		[Identifier.make('('), unaryCondOpSemantics(applyIntervalConditionSemantics), unaryCondOpSemantics(applyNegatedIntervalConditionSemantics)],
		[Identifier.make('=='), binaryCondOpSemantics(intervalEqualsOp), binaryCondOpSemantics(intervalNotEqualsOp)],
		[Identifier.make('!='), binaryCondOpSemantics(intervalNotEqualsOp), binaryCondOpSemantics(intervalEqualsOp)],
		[Identifier.make('>'), binaryCondOpSemantics(intervalGreaterOp), binaryCondOpSemantics(intervalLessEqualOp)],
		[Identifier.make('>='), binaryCondOpSemantics(intervalGreaterEqualOp), binaryCondOpSemantics(intervalLessOp)],
		[Identifier.make('<'), binaryCondOpSemantics(intervalLessOp), binaryCondOpSemantics(intervalGreaterEqualOp)],
		[Identifier.make('<='), binaryCondOpSemantics(intervalLessEqualOp), binaryCondOpSemantics(intervalGreaterOp)],
		[Identifier.make('is.na'), unaryCondOpSemantics(intervalIsNaFn), unaryCondOpSemantics(intervalUnaryIdentity)]
	] as const satisfies IntervalConditionSemanticsMapperInfo<StateDomain>[];
}

type IntervalConditionSemanticsMapperInfo<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = [identifier: Identifier, semantics: NAryFnSemantics<StateDomain>, negatedSemantics: NAryFnSemantics<StateDomain>];

type SetIntervalState<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (state: StateDomain) => (node: NodeId, interval: IntervalDomain | undefined) => void;
type GetInterval<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (nodeId: NodeId, state?: StateDomain) => IntervalDomain | undefined;
type GetVariableOrigins = (node: NodeId) => NodeId[];

/**
 * Condition semantics definition for unary operators.
 * @param argNodeId - The node id of the argument of the unary operator.
 * @param state - The state to retrieve the argument values and apply the semantics to.
 * @param set - Setter function to update an interval in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
type UnaryOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (argNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => StateDomain;

/**
 * Condition semantics definition for binary operators.
 * @param leftNodeId - The node id of the left argument of the binary operator.
 * @param rightNodeId - The node id of the right argument of the binary operator.
 * @param state - The state to retrieve the argument values and apply the semantics to.
 * @param set - Setter function to update an interval in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
type BinaryOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => StateDomain;

/**
 * Condition semantics definition for n-ary functions, where the semantics can be applied to any number of arguments.
 * @param argNodeIds - The node ids of the arguments of the function.
 * @param state - The state to retrieve the argument values and apply the semantics to.
 * @param set - Setter function to update an interval in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
type NAryFnSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => StateDomain;

/**
 * Applies the abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param set - Setter function to update an interval in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
export function applyIntervalConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
	if(isUndefined(argNodeId)) {
		return state;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = getSemanticsMapper<StateDomain>().find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [_, semantics] = match;
			return semantics(vertex.args.map(FunctionArgument.getReference), state, set, getInterval, getVariableOrigins, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = getInterval(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating an expression and evaluating a condition, we can just apply the semantics for evaluating an expression
	// in this case.
	if(argState?.isValue() && argState.value[0] == 0 && argState.value[1] == 0) {
		return state.bottom();
	}

	return state;
}

/**
 * Applies the negated abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the negated semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param set - Setter function to update an interval in the provided state.
 * @param getInterval - Retrieves the inferred abstract interval from the visitor for the provided node.
 * @param getVariableOrigins - Retrieves the origins of a node from the visitor.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the negated semantics.
 */
export function applyNegatedIntervalConditionSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId | undefined, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph): StateDomain {
	if(isUndefined(argNodeId)) {
		return state;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = getSemanticsMapper<StateDomain>().find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [, , negatedSemantics] = match;
			return negatedSemantics(vertex.args.map(FunctionArgument.getReference), state, set, getInterval, getVariableOrigins, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = getInterval(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating a negated expression and evaluating a negated condition, we can just apply the semantics for
	// evaluating a negated expression in this case.
	if(argState?.isValue() && (0 < argState.value[0] || argState.value[1] < 0)) {
		return state.bottom();
	}

	return state;
}

/**
 * Guard for unary operators, filtering all calls with more/less than 1 argument or with undefined argument.
 * If the call has exactly 1 defined argument, the provided unary operator semantics is applied to it.
 * Otherwise, the state is returned unmodified and a warning is logged.
 * @param unaryOperatorSemantics - The semantics to apply if the call has exactly 1 defined argument.
 * @returns The semantics to apply for a unary operator call, which includes the guard for the number of arguments.
 */
function unaryCondOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(unaryOperatorSemantics: UnaryOpSemantics<StateDomain>): NAryFnSemantics<StateDomain> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 1 || isUndefined(argNodeIds[0])) {
			numericInferenceLogger.warn('Called unary condition operator with more/less than 1 argument or with undefined argument.');
			return state;
		}
		return unaryOperatorSemantics(argNodeIds[0], state, set, getInterval, getVariableOrigins, dfg);
	};
}

/**
 * Guard for binary operators, filtering all calls with more/less than 2 arguments or with undefined arguments.
 * If the call has exactly 2 defined arguments, the provided binary operator semantics is applied to them.
 * Otherwise, the state is returned unmodified and a warning is logged.
 * @param binaryOperatorSemantics - The semantics to apply if the call has exactly 2 defined arguments.
 * @returns The semantics to apply for a binary operator call, which includes the guard for the number of arguments.
 */
function binaryCondOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(binaryOperatorSemantics: BinaryOpSemantics<StateDomain>): NAryFnSemantics<StateDomain> {
	return (argNodeIds: readonly (NodeId | undefined)[], state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 2 || isUndefined(argNodeIds[0]) || isUndefined(argNodeIds[1])) {
			numericInferenceLogger.warn('Called binary condition operator with more/less than 2 arguments or with undefined arguments.');
			return state;
		}

		return binaryOperatorSemantics(argNodeIds[0], argNodeIds[1], state, set, getInterval, getVariableOrigins, dfg);
	};
}

function intervalEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins) {
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

function intervalNotEqualsOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>): StateDomain {
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

function intervalGreaterOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins) {
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

function intervalLessOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins) {
	return intervalGreaterOp(rightNodeId, leftNodeId, state, set, getInterval, getVariableOrigins);
}

function intervalGreaterEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
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

function intervalLessEqualOp<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(leftNodeId: NodeId, rightNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>, getVariableOrigins: GetVariableOrigins): StateDomain {
	return intervalGreaterEqualOp(rightNodeId, leftNodeId, state, set, getInterval, getVariableOrigins);
}

function intervalIsNaFn<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(argNodeId: NodeId, state: StateDomain, set: SetIntervalState<StateDomain>, getInterval: GetInterval<StateDomain>) {
	const argValue = getInterval(argNodeId, state);

	if(isUndefined(argValue)) {
		return state;
	}

	return state.bottom();
}

function intervalUnaryIdentity<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(_argNodeId: NodeId, state: StateDomain): StateDomain {
	return state;
}