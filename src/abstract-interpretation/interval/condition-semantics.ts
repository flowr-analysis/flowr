import { Identifier } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { NumericInferenceVisitor } from './numeric-inference';
import type { IntervalDomain } from '../domains/interval-domain';
import { MutableStateAbstractDomain } from '../domains/state-abstract-domain';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { AbstractDomain } from '../domains/abstract-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../../util/logic';
import { FloatingPointComparison } from '../../util/floating-point';

const IntervalConditionSemanticsMapper = [
	[Identifier.make('!'), unaryOpSemantics(applyNegatedIntervalConditionSemantics), unaryOpSemantics(applyIntervalConditionSemantics)],
	[Identifier.make('('), unaryOpSemantics(applyIntervalConditionSemantics), unaryOpSemantics(applyNegatedIntervalConditionSemantics)],
	[Identifier.make('=='), binaryOpSemantics(intervalEqualsOp), binaryOpSemantics(intervalNotEqualsOp)],
	[Identifier.make('!='), binaryOpSemantics(intervalNotEqualsOp), binaryOpSemantics(intervalEqualsOp)],
	[Identifier.make('>'), binaryOpSemantics(intervalGreaterOp), binaryOpSemantics(intervalLessEqualOp)],
	[Identifier.make('>='), binaryOpSemantics(intervalGreaterEqualOp), binaryOpSemantics(intervalLessOp)],
	[Identifier.make('<'), binaryOpSemantics(intervalLessOp), binaryOpSemantics(intervalGreaterEqualOp)],
	[Identifier.make('<='), binaryOpSemantics(intervalLessEqualOp), binaryOpSemantics(intervalGreaterOp)],
	[Identifier.make('is.na'), unaryOpSemantics(intervalIsNaFn), unaryOpSemantics(intervalNegatedIsNaFn)]
] as const satisfies IntervalConditionSemanticsMapperInfo[];

type IntervalConditionSemanticsMapperInfo = [identifier: Identifier, semantics: NAryFnSemantics, negatedSemantics: NAryFnSemantics];

type UnaryOpSemantics = (argNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => MutableStateAbstractDomain<IntervalDomain> | undefined;

type BinaryOpSemantics = (leftNodeId: NodeId, rightNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => MutableStateAbstractDomain<IntervalDomain> | undefined;

type NAryFnSemantics = (argNodeIds: readonly (NodeId | undefined)[], state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => MutableStateAbstractDomain<IntervalDomain> | undefined;

/**
 * Applies the abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
export function applyIntervalConditionSemantics(argNodeId: NodeId | undefined, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	if(isUndefined(argNodeId)) {
		return state;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = IntervalConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [_, semantics] = match;
			return semantics(vertex.args.map(FunctionArgument.getReference), state, visitor, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = visitor.getAbstractValue(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating an expression and evaluating a condition, we can just apply the semantics for evaluating an expression
	// in this case.
	if(argState?.isValue() && argState.value[0] == 0 && argState.value[1] == 0) {
		if(isNotUndefined(state)) {
			return state.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	return state;
}

/**
 * Applies the negated abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the negated semantics should be applied.
 * @param state - The state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the negated semantics.
 */
export function applyNegatedIntervalConditionSemantics(argNodeId: NodeId | undefined, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	if(isUndefined(argNodeId)) {
		return state;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = IntervalConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [, , negatedSemantics] = match;
			return negatedSemantics(vertex.args.map(FunctionArgument.getReference), state, visitor, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = visitor.getAbstractValue(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating a negated expression and evaluating a negated condition, we can just apply the semantics for
	// evaluating a negated expression in this case.
	if(argState?.isValue() && (0 < argState.value[0] || argState.value[1] < 0)) {
		if(isNotUndefined(state)) {
			return state.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	return state;
}

function unaryOpSemantics(unaryOperatorSemantics: UnaryOpSemantics): NAryFnSemantics {
	return (argNodeIds: readonly (NodeId | undefined)[], state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 1 || isUndefined(argNodeIds[0])) {
			return state;
		}
		return unaryOperatorSemantics(argNodeIds[0], state, visitor, dfg);
	};
}

function binaryOpSemantics(binaryOperatorSemantics: BinaryOpSemantics): NAryFnSemantics {
	return (argNodeIds: readonly (NodeId | undefined)[], state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 2 || isUndefined(argNodeIds[0]) || isUndefined(argNodeIds[1])) {
			return state;
		}

		return binaryOperatorSemantics(argNodeIds[0], argNodeIds[1], state, visitor, dfg);
	};
}

function intervalEqualsOp(leftNodeId: NodeId, rightNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	const leftValue = visitor.getAbstractValue(leftNodeId, state);
	const rightValue = visitor.getAbstractValue(rightNodeId, state);

	const meet = AbstractDomain.meetAll([leftValue, rightValue].filter(isNotUndefined));

	if(meet.isBottom()) {
		if(isNotUndefined(state)) {
			return state.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	if(isUndefined(state)) {
		state = new MutableStateAbstractDomain(new Map());
	}

	visitor.getVariableOrigins(leftNodeId).forEach(originNodeId => {
		state.set(originNodeId, meet);
	});
	visitor.getVariableOrigins(rightNodeId).forEach(originNodeId => {
		state.set(originNodeId, meet);
	});

	return state;
}

function intervalNotEqualsOp(leftNodeId: NodeId, rightNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor): MutableStateAbstractDomain<IntervalDomain> | undefined {
	const leftValue = visitor.getAbstractValue(leftNodeId, state);
	const rightValue = visitor.getAbstractValue(rightNodeId, state);

	if(isNotUndefined(leftValue) && leftValue.isValue() && isNotUndefined(rightValue) && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(a == b && c == d && leftValue?.equals(rightValue)) {
			if(isNotUndefined(state)) {
				return state.bottom();
			}
			return new MutableStateAbstractDomain(new Map(), true);
		}
	}

	return state;
}

function intervalGreaterOp(leftNodeId: NodeId, rightNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	if(isUndefined(state)) {
		return state;
	}

	const leftValue = visitor.getAbstractValue(leftNodeId, state);
	const rightValue = visitor.getAbstractValue(rightNodeId, state);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return state;
	}

	if(leftValue.isValue() && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c < b || FloatingPointComparison.isNearlyLess(c, b, leftValue.significantFigures) != Ternary.Never) {
			const maxAC = a < c ? c : a;
			visitor.getVariableOrigins(leftNodeId).forEach(originNodeId => {
				state.set(originNodeId, leftValue.create([maxAC, b]));
			});
			const minBD = b < d ? b : d;
			visitor.getVariableOrigins(rightNodeId).forEach(originNodeId => {
				state.set(originNodeId, rightValue.create([c, minBD]));
			});
			return state;
		}
	}

	return state.bottom();
}

function intervalLessOp(leftNodeId: NodeId, rightNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	return intervalGreaterOp(rightNodeId, leftNodeId, state, visitor);
}

function intervalGreaterEqualOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	if(isUndefined(currentState)) {
		return currentState;
	}

	const leftValue = visitor.getAbstractValue(leftNodeId, currentState);
	const rightValue = visitor.getAbstractValue(rightNodeId, currentState);

	if(isUndefined(leftValue) || isUndefined(rightValue)) {
		return currentState;
	}

	if(leftValue.isValue() && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c <= b || FloatingPointComparison.isNearlyLessOrEqual(c, b, leftValue.significantFigures) != Ternary.Never) {
			const maxAC = a < c ? c : a;
			visitor.getVariableOrigins(leftNodeId).forEach(originNodeId => {
				currentState.set(originNodeId, leftValue.create([maxAC, b]));
			});
			const minBD = b < d ? b : d;
			visitor.getVariableOrigins(rightNodeId).forEach(originNodeId => {
				currentState.set(originNodeId, rightValue.create([c, minBD]));
			});
			return currentState;
		}
	}

	return currentState.bottom();
}

function intervalLessEqualOp(leftNodeId: NodeId, rightNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	return intervalGreaterEqualOp(rightNodeId, leftNodeId, state, visitor);
}

function intervalIsNaFn(argNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	if(isUndefined(state)) {
		return state;
	}

	const argValue = visitor.getAbstractValue(argNodeId, state);

	if(isUndefined(argValue)) {
		return state;
	}

	return state.bottom();
}

function intervalNegatedIsNaFn(argNodeId: NodeId, state: MutableStateAbstractDomain<IntervalDomain> | undefined) {
	return state;
}