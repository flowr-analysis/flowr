import { IntervalDomain } from '../domains/interval-domain';
import { Identifier } from '../../dataflow/environments/identifier';
import { isUndefined } from '../../util/assert';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { NumericInferenceVisitor } from './numeric-inference';
import { numericInferenceLogger } from './numeric-inference';

/**
 * Maps function/operator names to the semantic functions.
 */
const IntervalSemanticsMapper = [
	[Identifier.make('+'), unaryBinaryOpSemantics(defaultPositiveOp, defaultAddOp)],
	[Identifier.make('-'), unaryBinaryOpSemantics(defaultNegativeOp, defaultSubtractOp)],
	[Identifier.make('*'), binaryOpSemantics(defaultMultiplyOp)],
	[Identifier.make('length'), unaryFnSemantics(defaultLengthFn)],
] as const satisfies readonly IntervalSemanticsMapperInfo[];

/**
 * Semantics definition function for unary numeric operators.
 * @param arg - The interval operand of the unary operator.
 * @returns The resulting interval after applying the unary operator semantics to the provided operand.
 */
type UnaryOpSemantics = (arg: IntervalDomain | undefined) => IntervalDomain | undefined;

/**
 * Semantics definition function for binary numeric operators.
 * @param left - The left interval operand of the binary operator.
 * @param right - The right interval operand of the binary operator.
 * @returns The resulting interval after applying the binary operator semantics to the provided operands.
 */
type BinaryOpSemantics = (left: IntervalDomain | undefined, right: IntervalDomain | undefined) => IntervalDomain | undefined;

/**
 * Semantics definition function for unary functions.
 * @param arg - The raw argument of the function.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve the argument interval.
 * @returns The resulting interval after applying the semantics.
 */
type UnaryFnSemantics = (arg: FunctionArgument, visitor: NumericInferenceVisitor) => IntervalDomain | undefined;

/**
 * Semantics definition function n-ary functions/operators.
 * @param args - The raw arguments of the function/operator.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @returns The resulting interval after applying the semantics.
 */
type NaryFnSemantics = (args: readonly FunctionArgument[], visitor: NumericInferenceVisitor) => IntervalDomain | undefined;

type IntervalSemanticsMapperInfo = [identifier: Identifier, semantics: NaryFnSemantics];

/**
 * Applies the abstract expression semantics of the provided function with respect to the interval domain to the provided args.
 * @param functionIdentifier - The {@link Identifier} of the function/operator.
 * @param args - The arguments of the function/operator.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @returns The resulting interval after applying the semantics.
 */
export function applyIntervalExpressionSemantics(functionIdentifier: Identifier, args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	if(visitor.currentState.isBottom()) {
		return IntervalDomain.bottom();
	}

	const match = IntervalSemanticsMapper.find(([id]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		numericInferenceLogger.debug(`Function identifier ${functionIdentifier.toString()} is not a valid interval operation. Returning undefined semantics.`);
		return undefined;
	}

	const [_, semantics] = match;

	return semantics(args, visitor);
}

/**
 * Guard for numerical operators that can be used as both unary and binary operators, filtering all calls with more than 2 arguments.
 * If the call has exactly 1 argument that is not empty, the provided unary operator semantics function is applied.
 * If the call has exactly 2 arguments that are not empty, the provided binary operator semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param unaryOperatorSemantics - The semantics function for the unary operator.
 * @param binaryOperatorSemantics - The semantics function for the binary operator.
 * @returns A semantics function for n-ary functions that applies the correct provided operator based on the provided arguments.
 */
function unaryBinaryOpSemantics(unaryOperatorSemantics: UnaryOpSemantics, binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics {
	return (args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined => {
		// Usage as unary operator
		if(args.length === 1) {
			if(FunctionArgument.isEmpty(args[0])) {
				numericInferenceLogger.warn('Called unary operator with an empty argument, which is not supported.');
				return IntervalDomain.bottom();
			}

			const arg = visitor.getAbstractValue(args[0].nodeId);
			return unaryOperatorSemantics(arg);
		}

		return binaryOpSemantics(binaryOperatorSemantics)(args, visitor);
	};
}

/**
 * Guard for binary numerical operators, filtering all calls with more/less than 2 arguments.
 * If the call has exactly 2 arguments that are not empty, the provided semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param binaryOperatorSemantics - The semantics function for the binary operator.
 * @returns A semantics function for n-ary functions that applies the provided binary numeric operator semantics if the call has exactly 2 non-empty numeric arguments, and logs a warning and returns bottom otherwise.
 */
function binaryOpSemantics(binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics {
	return (args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined => {
		if(args.length !== 2) {
			numericInferenceLogger.warn('Called binary operator with more/less than 2 arguments, which is not supported.');
			return IntervalDomain.bottom();
		}

		if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
			numericInferenceLogger.warn('Called binary operator with at least one empty argument, which is not supported.');
			return IntervalDomain.bottom();
		}

		const left = visitor.getAbstractValue(args[0].nodeId);
		const right = visitor.getAbstractValue(args[1].nodeId);

		return binaryOperatorSemantics(left, right);
	};
}

/**
 * Guard for unary functions, filtering all calls with more/less than 1 argument.
 * If the call has exactly 1 argument, the provided semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param unaryFunctionSemantics - The semantics function for the unary function.
 * @returns A semantics function for n-ary functions that applies the provided unary function semantics if the call has exactly 1 argument, and logs a warning and returns bottom otherwise.
 */
function unaryFnSemantics(unaryFunctionSemantics: UnaryFnSemantics): NaryFnSemantics {
	return (args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined => {
		if(args.length !== 1) {
			numericInferenceLogger.warn('Called unary function with more/less than 1 argument, which is not supported.');
			return IntervalDomain.bottom();
		}

		return unaryFunctionSemantics(args[0], visitor);
	};
}

/**
 * Applies the unary plus operator to the provided interval.
 * @param arg - The interval to apply the unary plus operator to (undefined meaning no information).
 * @returns The resulting interval after applying the unary plus operator, which is the same as the input interval.
 */
function defaultPositiveOp(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	return arg;
}

/**
 * Adds the provided intervals.
 * @param left - The left interval to add (undefined meaning no information).
 * @param right - The right interval to add (undefined meaning no information).
 * @returns The resulting interval after addition. If one of the intervals is undefined, the result is also undefined.
 */
function defaultAddOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	if(left?.isBottom() || right?.isBottom()) {
		return left?.bottom() ?? right?.bottom();
	}

	if(left?.isValue() && right?.isValue()) {
		const [a, b] = left.value;
		const [c, d] = right.value;

		if((a === Infinity && c === -Infinity)
			|| (a === -Infinity && c === Infinity)
			|| (b === Infinity && d === -Infinity)
			|| (b === -Infinity && d === Infinity)) {
			return undefined;
		}

		return left.create([a + c, b + d]);
	}
	return undefined;
}

/**
 * Negates the provided interval.
 * @param arg - The interval to negate (undefined meaning no information).
 * @returns The resulting interval after negation. If the interval is undefined, the result is also undefined.
 */
function defaultNegativeOp(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	if(arg?.isValue()) {
		const [a, b] = arg.value;
		return arg.create([-b, -a]);
	}
	return arg;
}

/**
 * Subtracts the provided intervals.
 * @param left - The left interval to subtract from (undefined meaning no information).
 * @param right - The right interval to subtract (undefined meaning no information).
 * @returns The resulting interval after subtraction. If one of the intervals is undefined, the result is also undefined.
 */
function defaultSubtractOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	return defaultAddOp(left, defaultNegativeOp(right));
}

/**
 * Multiplies the provided intervals.
 * @param left - The left interval to multiply (undefined meaning no information).
 * @param right - The right interval to multiply (undefined meaning no information).
 * @returns The resulting interval after multiplication. If one of the intervals is undefined, the result is also undefined.
 */
function defaultMultiplyOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	if(left?.isBottom() || right?.isBottom()) {
		return left?.bottom() ?? right?.bottom();
	}

	if(left?.isValue() && right?.isValue()) {
		const [a, b] = left.value;
		const [c, d] = right.value;

		if(((a === -Infinity || b === Infinity) && c <= 0 && d >= 0)
			|| ((c === -Infinity || d === Infinity) && a <= 0 && b >= 0)) {
			return undefined;
		}

		const products = [a * c, a * d, b * c, b * d];

		let min = Infinity;
		let max = -Infinity;

		for(const product of products) {
			if(product < min) {
				min = product;
			}
			if(product > max) {
				max = product;
			}
		}

		return left.create([min, max]);
	}

	return undefined;
}

/**
 * Infers the interval resulting from applying the `length` function to the provided argument.
 * @param arg - The argument to apply the `length` function to.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @returns Bottom if the provided argument is bottom or empty, otherwise overapproximates to the interval [0, Infinity].
 *          If the argument can be resolved to a supported value, the resulting interval is more precise (e.g.: [1,1] for scalar numbers).
 */
function defaultLengthFn(arg: FunctionArgument, visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	if(FunctionArgument.isEmpty(arg)) {
		numericInferenceLogger.warn('Called unary "length" with an empty argument, which is not supported.');
		return IntervalDomain.bottom();
	}

	const inferredInterval = visitor.getAbstractValue(arg.nodeId);

	if(inferredInterval?.isBottom()) {
		return inferredInterval.bottom();
	}

	if(inferredInterval?.isValue()) {
		return inferredInterval.create([1, 1]);
	}

	return new IntervalDomain([0, Infinity]);
}