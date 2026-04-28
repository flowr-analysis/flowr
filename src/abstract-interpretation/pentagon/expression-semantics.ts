import { FunctionArgument } from '../../dataflow/graph/graph';
import { Identifier } from '../../dataflow/environments/identifier';
import type { NumericPentagonInferenceVisitor } from './numeric-pentagon-inference';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';
import { numericInferenceLogger } from '../interval/numeric-interval-inference';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { getMin } from '../../util/numbers';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

const PentagonExpressionSemanticsMapper = [
	[Identifier.make('-'), binaryExprOpSemantics(pentagonSubtractOp)]
] as const satisfies readonly PentagonSemanticsMapperInfo[];

type PentagonSemanticsMapperInfo = [identifier: Identifier, semantics: NaryFnSemantics];

/**
 * Semantics definition function for binary numeric operators.
 * @param left - The left interval operand of the binary operator.
 * @param right - The right interval operand of the binary operator.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @returns The resulting interval after applying the binary operator semantics to the provided operands.
 */
type BinaryOpSemantics = (left: [NodeId, ClosedPentagonValueDomain | undefined], right: [NodeId, ClosedPentagonValueDomain | undefined], significantFigures: number | undefined) => ClosedPentagonValueDomain | undefined;

type NaryFnSemantics = (args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, significantFigures: number | undefined) => ClosedPentagonValueDomain | undefined;

/**
 * T
 * @param functionIdentifier
 * @param args
 * @param visitor
 * @param significantFigures
 */
export function applyPentagonExpressionSemantics(functionIdentifier: Identifier, args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, significantFigures?: number) {
	const match = PentagonExpressionSemanticsMapper.find(([id]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		numericInferenceLogger.debug(`Function identifier ${functionIdentifier.toString()} is not a valid pentagon operation. Returning undefined semantics.`);
		return undefined;
	}

	const [_, semantics] = match;

	return semantics(args, visitor, significantFigures);
}

/**
 * Guard for binary numerical operators, filtering all calls with more/less than 2 arguments.
 * If the call has exactly 2 arguments that are not empty, the provided semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param binaryOperatorSemantics - The semantics function for the binary operator.
 * @returns A semantics function for n-ary functions that applies the provided binary numeric operator semantics if the call has exactly 2 non-empty numeric arguments, and logs a warning and returns bottom otherwise.
 */
function binaryExprOpSemantics(binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics {
	return (args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, significantFigures: number | undefined): ClosedPentagonValueDomain | undefined => {
		if(args.length !== 2) {
			numericInferenceLogger.warn('Called binary operator with more/less than 2 arguments, which is not supported.');
			return ClosedPentagonValueDomain.bottom(significantFigures);
		}

		if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
			numericInferenceLogger.warn('Called binary operator with at least one empty argument, which is not supported.');
			return ClosedPentagonValueDomain.bottom(significantFigures);
		}

		const left = visitor.getAbstractValue(args[0].nodeId);
		const right = visitor.getAbstractValue(args[1].nodeId);

		return binaryOperatorSemantics([args[0].nodeId, left], [args[1].nodeId, right], significantFigures);
	};
}

function pentagonSubtractOp(left: [NodeId, ClosedPentagonValueDomain | undefined], right: [NodeId, ClosedPentagonValueDomain | undefined]): ClosedPentagonValueDomain | undefined {
	const [leftNodeId, leftValue] = left;
	const [rightNodeId, rightValue] = right;

	const smallestSignificantFigures = getMin([leftValue?.value.interval.significantFigures, rightValue?.value.interval.significantFigures].filter(isNotUndefined));

	if(leftValue?.isBottom() || rightValue?.isBottom()) {
		return ClosedPentagonValueDomain.bottom(smallestSignificantFigures);
	}


	if(leftValue?.isValue() && leftValue.value.interval.isValue() && rightValue?.isValue() && rightValue.value.interval.isValue()) {
		const resultPentagon = ClosedPentagonValueDomain.top();
		const [a, b] = leftValue.value.interval.value;
		const [c, d] = rightValue.value.interval.value;

		// Interval part
		if((a === Infinity && d === Infinity)
			|| (a === -Infinity && d === -Infinity)
			|| (b === Infinity && c === Infinity)
			|| (b === -Infinity && c === -Infinity)) {
			return undefined;
		}

		if(rightValue.value.upperBounds.has(leftNodeId) && leftValue.value.upperBounds.has(rightNodeId)) {
			// left and right are equal
			resultPentagon.value.interval = leftValue.value.interval.create([0, 0]);
		} else if(rightValue.value.upperBounds.has(leftNodeId)) {
			// right <= left: result must be positive
			resultPentagon.value.interval = leftValue.value.interval.create([a - d, b - c]).meet(leftValue.value.interval.create([0, Infinity]));
		} else if(leftValue.value.upperBounds.has(rightNodeId)) {
			// left <= right: result must be negative
			resultPentagon.value.interval = leftValue.value.interval.create([a - d, b - c]).meet(leftValue.value.interval.create([-Infinity, 0]));
		} else {
			resultPentagon.value.interval = leftValue.value.interval.create([a - d, b - c]);
		}

		// Upper Bounds Part (TODO: Incomplete)
		if(c >= 0) {
			resultPentagon.value.upperBounds = leftValue.value.upperBounds.create(leftValue.value.upperBounds.value);
			resultPentagon.value.upperBounds.add(leftNodeId);
		}


		return resultPentagon;
	}
	return undefined;
}