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
import { SignificancePrecisionComparison, Ternary } from '../../util/logic';

const IntervalConditionSemanticsMapper = [
	[Identifier.make('!'), unaryOpSemantics(applyNegatedIntervalConditionSemantics), unaryOpSemantics(applyIntervalConditionSemantics)],
	[Identifier.make('('), unaryOpSemantics(applyIntervalConditionSemantics), unaryOpSemantics(applyNegatedIntervalConditionSemantics)],
	[Identifier.make('=='), binaryOpSemantics(defaultEqualsOp), binaryOpSemantics(defaultNotEqualsOp)],
	[Identifier.make('!='), binaryOpSemantics(defaultNotEqualsOp), binaryOpSemantics(defaultEqualsOp)],
	[Identifier.make('>'), binaryOpSemantics(defaultGreaterOp), binaryOpSemantics(defaultLessEqualOp)],
	[Identifier.make('>='), binaryOpSemantics(defaultGreaterEqualOp), binaryOpSemantics(defaultLessOp)],
	[Identifier.make('<'), binaryOpSemantics(defaultLessOp), binaryOpSemantics(defaultGreaterEqualOp)],
	[Identifier.make('<='), binaryOpSemantics(defaultLessEqualOp), binaryOpSemantics(defaultGreaterOp)],
	[Identifier.make('is.na'), unaryOpSemantics(defaultIsNaFn), unaryOpSemantics(defaultNegatedIsNaFn)]
] as const satisfies IntervalConditionSemanticsMapperInfo[];

type IntervalConditionSemanticsMapperInfo = [identifier: Identifier, semantics: NAryFnSemantics, negatedSemantics: NAryFnSemantics];

type UnaryOpSemantics = (argNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => MutableStateAbstractDomain<IntervalDomain> | undefined;

type BinaryOpSemantics = (leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => MutableStateAbstractDomain<IntervalDomain> | undefined;

type NAryFnSemantics = (argNodeIds: readonly (NodeId | undefined)[], currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => MutableStateAbstractDomain<IntervalDomain> | undefined;

/**
 * Applies the abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the semantics should be applied.
 * @param currentState - The current state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the semantics.
 */
export function applyIntervalConditionSemantics(argNodeId: NodeId | undefined, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	if(isUndefined(argNodeId)) {
		return currentState;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = IntervalConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [_, semantics] = match;
			return semantics(vertex.args.map(FunctionArgument.getReference), currentState, visitor, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = visitor.getAbstractValue(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating an expression and evaluating a condition, we can just apply the semantics for evaluating an expression
	// in this case.
	if(argState?.isValue() && argState.value[0] == 0 && argState.value[1] == 0) {
		// Map every variable in state to bottom (fix until state-domain rework)
		if(isNotUndefined(currentState)) {
			// for(const entry of currentState.value.entries()) {
			//  currentState.set(entry[0], entry[1].bottom());
			// }
			return currentState.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	return currentState;
}

/**
 * Applies the negated abstract condition semantics of the provided function with respect to the interval domain to the provided args.
 * @param argNodeId - The node id representing the condition to which the negated semantics should be applied.
 * @param currentState - The current state before applying the semantics, which can be used to determine the resulting state after applying the semantics.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @param dfg - The dataflow graph containing the vertex and its arguments.
 * @returns The filtered state after applying the negated semantics.
 */
export function applyNegatedIntervalConditionSemantics(argNodeId: NodeId | undefined, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph): MutableStateAbstractDomain<IntervalDomain> | undefined {
	if(isUndefined(argNodeId)) {
		return currentState;
	}

	const vertex = dfg.getVertex(argNodeId);
	if(isFunctionCallVertex(vertex)) {
		const match = IntervalConditionSemanticsMapper.find(([id]) => Identifier.matches(id, vertex.name));

		if(isNotUndefined(match)) {
			const [, , negatedSemantics] = match;
			return negatedSemantics(vertex.args.map(FunctionArgument.getReference), currentState, visitor, dfg);
		}
	}

	// If the argument is not a known condition function call, we need to check if it is an expression.
	// As the visitor has visited these nodes before, getAbstractValue will resolve to an interval if it is an expression.

	const argState = visitor.getAbstractValue(argNodeId);

	// As the handling for top (indicating either expression returning top or absence of expression) is the same for
	// evaluating a negated expression and evaluating a negated condition, we can just apply the semantics for
	// evaluating a negated expression in this case.
	if(argState?.isValue() && (0 < argState.value[0] || argState.value[1] < 0)) {
		// (fix until state-domain rework)
		if(isNotUndefined(currentState)) {
			// for(const entry of currentState.value.entries()) {
			//  currentState.set(entry[0], entry[1].bottom());
			// }
			return currentState.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	return currentState;
}

function unaryOpSemantics(unaryOperatorSemantics: UnaryOpSemantics): NAryFnSemantics {
	return (argNodeIds: readonly (NodeId | undefined)[], currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 1 || isUndefined(argNodeIds[0])) {
			return currentState;
		}
		return unaryOperatorSemantics(argNodeIds[0], currentState, visitor, dfg);
	};
}

function binaryOpSemantics(binaryOperatorSemantics: BinaryOpSemantics): NAryFnSemantics {
	return (argNodeIds: readonly (NodeId | undefined)[], currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor, dfg: DataflowGraph) => {
		if(argNodeIds.length !== 2 || isUndefined(argNodeIds[0]) || isUndefined(argNodeIds[1])) {
			return currentState;
		}

		return binaryOperatorSemantics(argNodeIds[0], argNodeIds[1], currentState, visitor, dfg);
	};
}

function defaultEqualsOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	const leftValue = visitor.getAbstractValue(leftNodeId, currentState);
	const rightValue = visitor.getAbstractValue(rightNodeId, currentState);

	const meet = AbstractDomain.meetAll([leftValue, rightValue].filter(isNotUndefined));

	if(meet.isBottom()) {
		if(isNotUndefined(currentState)) {
			return currentState.bottom();
		}
		return new MutableStateAbstractDomain(new Map(), true);
	}

	if(isUndefined(currentState)) {
		currentState = new MutableStateAbstractDomain(new Map());
	}

	currentState.set(leftNodeId, meet);
	currentState.set(rightNodeId, meet);

	return currentState;
}

function defaultNotEqualsOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor): MutableStateAbstractDomain<IntervalDomain> | undefined {
	const leftValue = visitor.getAbstractValue(leftNodeId, currentState);
	const rightValue = visitor.getAbstractValue(rightNodeId, currentState);

	if(isNotUndefined(leftValue) && leftValue.isValue() && isNotUndefined(rightValue) && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(a == b && c == d && leftValue?.equals(rightValue) != Ternary.Never) {
			if(isNotUndefined(currentState)) {
				return currentState.bottom();
			}
			return new MutableStateAbstractDomain(new Map(), true);
		}
	}

	return currentState;
}

function defaultGreaterOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	if(isUndefined(currentState)) {
		return currentState;
	}

	const leftValue = visitor.getAbstractValue(leftNodeId, currentState);
	const rightValue = visitor.getAbstractValue(rightNodeId, currentState);

	if(leftValue?.isTop() || rightValue?.isTop()) {
		return currentState;
	}

	if(isNotUndefined(leftValue) && leftValue.isValue() && isNotUndefined(rightValue) && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c < b || SignificancePrecisionComparison.isLowerWithSignificancePrecision(c, b, leftValue.significantFigures) != Ternary.Never) {
			const maxAC = a < c ? c : a;
			currentState.set(leftNodeId, leftValue.create([maxAC, b]));
			const minBD = b < d ? b : d;
			currentState.set(rightNodeId, rightValue.create([c, minBD]));
			return currentState;
		}
	}

	return currentState.bottom();
}

function defaultLessOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	return defaultGreaterOp(rightNodeId, leftNodeId, currentState, visitor);
}

function defaultGreaterEqualOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	if(isUndefined(currentState)) {
		return currentState;
	}

	const leftValue = visitor.getAbstractValue(leftNodeId, currentState);
	const rightValue = visitor.getAbstractValue(rightNodeId, currentState);

	if(leftValue?.isTop() || rightValue?.isTop()) {
		return currentState;
	}

	if(isNotUndefined(leftValue) && leftValue.isValue() && isNotUndefined(rightValue) && rightValue.isValue()) {
		const [a, b] = leftValue.value;
		const [c, d] = rightValue.value;

		if(c <= b || SignificancePrecisionComparison.isLowerEqualWithSignificancePrecision(c, b, leftValue.significantFigures) != Ternary.Never) {
			const maxAC = a < c ? c : a;
			currentState.set(leftNodeId, leftValue.create([maxAC, b]));
			const minBD = b < d ? b : d;
			currentState.set(rightNodeId, rightValue.create([c, minBD]));
			return currentState;
		}
	}

	return currentState.bottom();
}

function defaultLessEqualOp(leftNodeId: NodeId, rightNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	return defaultGreaterEqualOp(rightNodeId, leftNodeId, currentState, visitor);
}

function defaultIsNaFn(argNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined, visitor: NumericInferenceVisitor) {
	if(isUndefined(currentState)) {
		return currentState;
	}

	const argValue = visitor.getAbstractValue(argNodeId, currentState);

	if(isUndefined(argValue)) {
		return currentState;
	}

	return currentState.bottom();
}

function defaultNegatedIsNaFn(argNodeId: NodeId, currentState: MutableStateAbstractDomain<IntervalDomain> | undefined) {
	return currentState;
}