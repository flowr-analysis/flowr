import { IntervalDomain } from '../domains/interval-domain';
import { Identifier } from '../../dataflow/environments/identifier';
import { isNotUndefined, isUndefined } from '../../util/assert';
import type { DataflowGraph, NamedFunctionArgument, PositionalFunctionArgument } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { IntervalInference } from './numeric-interval-inference';
import { getMax, getMin, getMinMax } from '../../util/numbers';
import type { AnyStateDomain } from '../domains/state-domain-like';
import type { AnyAbstractDomain } from '../domains/abstract-domain';
import type { AbstractInterpretationVisitor } from '../absint-visitor';
import type { StateAbstractDomain } from '../domains/state-abstract-domain';
import { log } from '../../util/log';
import { Bottom } from '../domains/lattice';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RLogical } from '../../r-bridge/lang-4.x/ast/model/nodes/r-logical';

type IntervalExpressionSemanticsVisitor<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = AbstractInterpretationVisitor<StateDomain> & IntervalInference<StateDomain>;

const numericInferenceLogger = log.getSubLogger({ name: 'numeric-interval-inference' });

/**
 * Maps function/operator names to the semantic functions.
 */
export const IntervalExpressionSemanticsMapper = <StateDomain extends AnyStateDomain<AnyAbstractDomain>>() => [
	[Identifier.make('+'), unaryBinaryExprOpSemantics(intervalUnaryIdentityOp, intervalAddOp)],
	[Identifier.make('-'), unaryBinaryExprOpSemantics(intervalNegateOp, intervalSubtractOp)],
	[Identifier.make('*'), binaryExprOpSemantics(intervalMultiplyOp)],
	[Identifier.make('/'), binaryExprOpSemantics(intervalDivideOp)],
	[Identifier.make('^'), binaryExprOpSemantics(intervalPowerOp)],
	[Identifier.make('sqrt'), unaryExprOpSemantics(intervalSqrtOp)],
	[Identifier.make('length'), unaryExprFnSemantics(intervalOneIfArgIsNumElsePositiveNum)],
	[Identifier.make('nrow'), unaryExprFnSemantics(intervalNrowNcolFn)],
	[Identifier.make('ncol'), unaryExprFnSemantics(intervalNrowNcolFn)],
	[Identifier.make('NROW'), unaryExprFnSemantics(intervalOneIfArgIsNumElsePositiveNum)],
	[Identifier.make('NCOL'), unaryExprFnSemantics(intervalOneIfArgIsNumElsePositiveNum)],
	[Identifier.make('sum'), intervalSumFn],
	[Identifier.make('max'), intervalMaxFn],
	[Identifier.make('abs'), unaryExprOpSemantics(intervalAbs)],
	[Identifier.make('%%'), binaryExprOpSemantics(intervalModulo)],
	[Identifier.make('log'), intervalLog],
	[Identifier.make('mean'), intervalReturnNumIfAllArgsAreNum],
	[Identifier.make('min'), intervalReturnNumIfAllArgsAreNum],
	[Identifier.make('median'), intervalReturnNumIfAllArgsAreNum],
	[Identifier.make('round'), intervalRound],
	[Identifier.make('sign'), unaryExprOpSemantics(intervalSign)],
	[Identifier.make('runif'), intervalRunif],
	[Identifier.make('as.numeric'), intervalAsNumeric],
	[Identifier.make('as.integer'), intervalAsInteger],
	[Identifier.make('sin'), unaryExprOpSemantics(intervalSinCosOp)],
	[Identifier.make('cos'), unaryExprOpSemantics(intervalSinCosOp)],
] as const satisfies readonly IntervalSemanticsMapperInfo<StateDomain>[];

type IntervalSemanticsMapperInfo<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = [identifier: Identifier, semantics: NaryFnSemantics<StateDomain>];

/**
 * Semantics definition function for unary numeric operators.
 * @param arg - The interval operand of the unary operator.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @returns The resulting interval after applying the unary operator semantics to the provided operand.
 */
type UnaryOpSemantics = (arg: IntervalDomain | undefined, significantFigures: number | undefined) => IntervalDomain | undefined;

/**
 * Semantics definition function for binary numeric operators.
 * @param left - The left interval operand of the binary operator.
 * @param right - The right interval operand of the binary operator.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @returns The resulting interval after applying the binary operator semantics to the provided operands.
 */
type BinaryOpSemantics = (left: IntervalDomain | undefined, right: IntervalDomain | undefined, significantFigures: number | undefined) => IntervalDomain | undefined;

/**
 * Semantics definition function for unary functions.
 * @param arg - The raw argument of the function.
 * @param visitor - Visitor that is used to retrieve the inferred interval.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @param dfg - Is used to resolve constant values.
 * @returns The resulting interval after applying the semantics.
 */
type UnaryFnSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (arg: FunctionArgument, visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined, dfg: DataflowGraph) => IntervalDomain | undefined;

/**
 * Semantics definition function n-ary functions/operators.
 * @param args - The raw arguments of the function/operator.
 * @param visitor - Visitor that is used to retrieve the inferred interval.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @param dfg - Is used to resolve constant values.
 * @returns The resulting interval after applying the semantics.
 */
type NaryFnSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>> = (args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined, dfg: DataflowGraph) => IntervalDomain | undefined;

/**
 * Applies the abstract expression semantics of the provided function with respect to the interval domain to the provided args.
 * @param functionIdentifier - The {@link Identifier} of the function/operator.
 * @param args - The arguments of the function/operator.
 * @param visitor - Visitor that is used to retrieve the inferred interval.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @param dfg - Is used to resolve constant values.
 * @returns The resulting interval after applying the semantics.
 */
export function applyIntervalExpressionSemantics(functionIdentifier: Identifier, args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateAbstractDomain<IntervalDomain>>, significantFigures: number | undefined, dfg: DataflowGraph): IntervalDomain | undefined {
	const match = IntervalExpressionSemanticsMapper().find(([id]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		numericInferenceLogger.debug(`Function identifier ${functionIdentifier.toString()} is not a valid interval operation. Returning undefined semantics.`);
		return undefined;
	}

	const [_, semantics] = match;

	return semantics(args, visitor, significantFigures, dfg);
}

/**
 * Guard for unary numerical operators, filtering all calls with more/less than 1 argument.
 * If the call has exactly 1 argument that is not empty, the provided semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param unaryOperatorSemantics - The semantics function for the unary operator.
 * @returns A semantics function for n-ary functions that applies the provided unary numeric operator semantics if the call has exactly 1 non-empty numeric argument, and logs a warning and returns bottom otherwise.
 */
function unaryExprOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(unaryOperatorSemantics: UnaryOpSemantics): NaryFnSemantics<StateDomain> {
	return unaryExprFnSemantics((arg: FunctionArgument, visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined) => {
		if(FunctionArgument.isEmpty(arg)) {
			numericInferenceLogger.warn('Called unary operator with an empty argument, which is not supported.');
			return IntervalDomain.bottom(significantFigures);
		}

		const interval = visitor.getInterval(arg.nodeId);
		return unaryOperatorSemantics(interval, significantFigures);
	});
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
function unaryBinaryExprOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(unaryOperatorSemantics: UnaryOpSemantics, binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics<StateDomain> {
	return (args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined, dfg: DataflowGraph): IntervalDomain | undefined => {
		// Usage as unary operator
		if(args.length === 1) {
			if(FunctionArgument.isEmpty(args[0])) {
				numericInferenceLogger.warn('Called unary operator with an empty argument, which is not supported.');
				return IntervalDomain.bottom(significantFigures);
			}

			const arg = visitor.getInterval(args[0].nodeId);
			return unaryOperatorSemantics(arg, significantFigures);
		}

		return binaryExprOpSemantics(binaryOperatorSemantics)(args, visitor, significantFigures, dfg);
	};
}

/**
 * Guard for binary numerical operators, filtering all calls with more/less than 2 arguments.
 * If the call has exactly 2 arguments that are not empty, the provided semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param binaryOperatorSemantics - The semantics function for the binary operator.
 * @returns A semantics function for n-ary functions that applies the provided binary numeric operator semantics if the call has exactly 2 non-empty numeric arguments, and logs a warning and returns bottom otherwise.
 */
function binaryExprOpSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics<StateDomain> {
	return (args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined => {
		if(args.length !== 2) {
			numericInferenceLogger.warn('Called binary operator with more/less than 2 arguments, which is not supported.');
			return IntervalDomain.bottom(significantFigures);
		}

		if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
			numericInferenceLogger.warn('Called binary operator with at least one empty argument, which is not supported.');
			return IntervalDomain.bottom(significantFigures);
		}

		const left = visitor.getInterval(args[0].nodeId);
		const right = visitor.getInterval(args[1].nodeId);

		return binaryOperatorSemantics(left, right, significantFigures);
	};
}

/**
 * Guard for unary functions, filtering all calls with more/less than 1 argument.
 * If the call has exactly 1 argument, the provided semantics function is applied.
 * Otherwise, a warning is logged and bottom is returned.
 * @param unaryFunctionSemantics - The semantics function for the unary function.
 * @returns A semantics function for n-ary functions that applies the provided unary function semantics if the call has exactly 1 argument, and logs a warning and returns bottom otherwise.
 */
function unaryExprFnSemantics<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(unaryFunctionSemantics: UnaryFnSemantics<StateDomain>): NaryFnSemantics<StateDomain> {
	return (args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined, dfg: DataflowGraph): IntervalDomain | undefined => {
		if(args.length !== 1) {
			numericInferenceLogger.warn('Called unary function with more/less than 1 argument, which is not supported.');
			return IntervalDomain.bottom(significantFigures);
		}

		return unaryFunctionSemantics(args[0], visitor, significantFigures, dfg);
	};
}

function intervalUnaryIdentityOp(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	return arg;
}

/**
 * Adds the provided intervals.
 * @param left - The left interval to add (undefined meaning no information).
 * @param right - The right interval to add (undefined meaning no information).
 * @returns The resulting interval after addition. If one of the intervals is undefined, the result is also undefined.
 */
export function intervalAddOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	const smallestSignificantFigures = getMin([left?.significantFigures, right?.significantFigures].filter(isNotUndefined));
	if(left?.isBottom() || right?.isBottom()) {
		return left?.bottom(smallestSignificantFigures) ?? right?.bottom(smallestSignificantFigures);
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

		return left.create([a + c, b + d], smallestSignificantFigures);
	}
	return undefined;
}

/**
 * Negates the provided interval.
 * @param arg - The interval to negate (undefined meaning no information).
 * @returns The resulting interval after negation. If the interval is undefined, the result is also undefined.
 */
export function intervalNegateOp(arg: IntervalDomain | undefined): IntervalDomain | undefined {
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
export function intervalSubtractOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	return intervalAddOp(left, intervalNegateOp(right));
}

/**
 * Multiplies the provided intervals.
 * @param left - The left interval to multiply (undefined meaning no information).
 * @param right - The right interval to multiply (undefined meaning no information).
 * @returns The resulting interval after multiplication. If one of the intervals is undefined, the result is also undefined.
 */
function intervalMultiplyOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	const smallestSignificantFigures = getMin([left?.significantFigures, right?.significantFigures].filter(isNotUndefined));
	if(left?.isBottom() || right?.isBottom()) {
		return left?.bottom(smallestSignificantFigures) ?? right?.bottom(smallestSignificantFigures);
	}

	if(left?.isValue() && right?.isValue()) {
		const [a, b] = left.value;
		const [c, d] = right.value;

		if(((a === -Infinity || b === Infinity) && c <= 0 && d >= 0)
			|| ((c === -Infinity || d === Infinity) && a <= 0 && b >= 0)) {
			return undefined;
		}

		const products = [a * c, a * d, b * c, b * d];

		const minMax = getMinMax(products);
		if(isUndefined(minMax)) {
			return left.bottom(smallestSignificantFigures);
		}
		return left.create([minMax.min, minMax.max], smallestSignificantFigures);
	}

	return undefined;
}

function intervalDivideOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	const smallestSignificantFigures = getMin([left?.significantFigures, right?.significantFigures].filter(isNotUndefined));
	if(left?.isBottom() || right?.isBottom()) {
		return left?.bottom(smallestSignificantFigures) ?? right?.bottom(smallestSignificantFigures);
	}

	if(left?.isValue() && right?.isValue()) {
		const [c, d] = right.value;
		if(0 < c || d < 0) {
			return intervalMultiplyOp(left, right.create([1/d, 1/c]));
		} else {
			return intervalMultiplyOp(left, right.create([Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]));
		}
	}
	return undefined;
}

function intervalPowerOp(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	const smallestSignificantFigures = getMin([left?.significantFigures, right?.significantFigures].filter(isNotUndefined));
	if(left?.isBottom() || right?.isBottom()) {
		return left?.bottom(smallestSignificantFigures) ?? right?.bottom(smallestSignificantFigures);
	}

	if(left?.isValue() && right?.isValue()) {
		const [a, b] = left.value;
		const [c, d] = right.value;

		if(c !== d) {
			return undefined;
		}

		if(!Number.isInteger(c)) {
			if(a >= 0) {
				if(c === Infinity) {
					return left.create([a**c, b**c]);
				}
				if(c === -Infinity) {
					return left.create([b**c, a**c]);
				}
			}
			return undefined;
		}

		if(c === 0) {
			return left.create([1, 1], smallestSignificantFigures);
		} else if(0 <= a || (c % 2) === 1) {
			return left.create([a ** c, b ** c], smallestSignificantFigures);
		} else if(b <= 0 && (c % 2) === 0) {
			return left.create([b ** c, a ** c], smallestSignificantFigures);
		}
		const max = getMax([a ** c, b ** c]) ?? Number.POSITIVE_INFINITY;
		return left.create([0, max]);
	}
	return undefined;
}

function intervalSqrtOp(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	if(arg?.isBottom()) {
		return arg?.bottom();
	}

	if(arg?.isValue()) {
		const [a, b] = arg.value;

		if(a < 0) {
			// Negative values produce NaN which we cannot represent using our interval domain
			return undefined;
		}
		return arg.create([Math.sqrt(a), Math.sqrt(b)]);
	}
	return undefined;
}

/**
 * @param arg - The argument to apply the `length` function to.
 * @param visitor - Visitor that is used to retrieve the inferred interval.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @returns Bottom if the provided argument is bottom or empty, otherwise overapproximates to the interval [0, Infinity].
 *          If the argument can be resolved to a supported value, the resulting interval is more precise (e.g.: [1,1] for scalar numbers).
 */
function intervalOneIfArgIsNumElsePositiveNum<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(arg: FunctionArgument, visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(FunctionArgument.isEmpty(arg)) {
		numericInferenceLogger.warn('Called unary "length" with an empty argument, which is not supported.');
		return IntervalDomain.bottom(significantFigures);
	}

	let inferredLength: IntervalDomain = IntervalDomain.top(significantFigures);

	// Check if the value is a scalar number
	const inferredInterval = visitor.getInterval(arg.nodeId);
	if(inferredInterval?.isBottom()) {
		inferredLength = inferredInterval.bottom(significantFigures);
	} else if(inferredInterval?.isValue()) {
		inferredLength = inferredInterval.create([1, 1], significantFigures);
	}

	// Assure that the inferred value meets the general length semantics of being at least 0 and most Infinity
	return inferredLength.meet(new IntervalDomain([0, Infinity], significantFigures));
}

function intervalNrowNcolFn<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(arg: FunctionArgument, visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(FunctionArgument.isEmpty(arg)) {
		numericInferenceLogger.warn('Called unary "nrow/ncol" with an empty argument, which is not supported.');
		return IntervalDomain.bottom(significantFigures);
	}

	const inferredInterval = visitor.getInterval(arg.nodeId);
	if(isNotUndefined(inferredInterval)) {
		if(inferredInterval.isValue()) {
			// nrow/ncol cannot process scalar values and therefore returns null
			return undefined;
		}
		if(inferredInterval.isBottom()) {
			return IntervalDomain.bottom(significantFigures);
		}
	}

	numericInferenceLogger.warn('Applying the nrow/ncol semantics can possibly lead to an underapproximation, as we neglect the fact that they can return null.');
	return new IntervalDomain([0, Infinity], significantFigures);
}

function intervalSumFn<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined, dfg: DataflowGraph) {
	if(args.length === 0) {
		return IntervalDomain.scalar(0, significantFigures);
	}
	if(args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	const rmNaArg: NamedFunctionArgument | undefined = args.find(arg => FunctionArgument.isNamed(arg) && arg.name === 'na.rm') as NamedFunctionArgument | undefined;
	let rmNa = false;
	if(isNotUndefined(rmNaArg)) {
		if(isNotUndefined(rmNaArg.valueId)) {
			// Resolve the value to "TRUE" or "FALSE"
			const valueNode = dfg.idMap?.get(rmNaArg.valueId);
			if(RLogical.is(valueNode) && RLogical.isTrue(valueNode)) {
				rmNa = true;
			}
		}
	}

	const allArgumentIntervals = args
		.filter(arg => FunctionArgument.isNamed(arg) && arg.name !== 'na.rm' || FunctionArgument.isPositional(arg))
		.map(arg => visitor.getInterval((arg as NamedFunctionArgument | PositionalFunctionArgument).nodeId));

	// There is no argument besides the rmNa argument, so result is 0
	if(allArgumentIntervals.length === 0) {
		return IntervalDomain.scalar(0, significantFigures);
	}

	// Not all arguments are (known) numeric scalar values, so if NAs are removed, we know result must be numeric scalar.
	// If NA is not removed, result could be NA => undefined.
	if(allArgumentIntervals.some(isUndefined)) {
		if(rmNa) {
			return IntervalDomain.top(significantFigures);
		}
		return undefined;
	}

	// All arguments are known numeric scalar values, so we can return the sum of all intervals
	return allArgumentIntervals.reduce((acc, val) => intervalAddOp(acc, val), IntervalDomain.scalar(0));
}

function intervalMaxFn<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined, dfg: DataflowGraph) {
	if(args.length === 0) {
		return IntervalDomain.scalar(Number.NEGATIVE_INFINITY, significantFigures);
	}
	if(args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	const rmNaArg: NamedFunctionArgument | undefined = args.find(arg => FunctionArgument.isNamed(arg) && arg.name === 'na.rm') as NamedFunctionArgument | undefined;
	let rmNa = false;
	if(isNotUndefined(rmNaArg)) {
		if(isNotUndefined(rmNaArg.valueId)) {
			// Resolve the value to "TRUE" or "FALSE"
			const valueNode = dfg.idMap?.get(rmNaArg.valueId);
			if(RLogical.is(valueNode) && RLogical.isTrue(valueNode)) {
				rmNa = true;
			}
		}
	}

	const allArgumentIntervals = args
		.filter(arg => FunctionArgument.isNamed(arg) && arg.name !== 'na.rm' || FunctionArgument.isPositional(arg))
		.map(arg => visitor.getInterval((arg as NamedFunctionArgument | PositionalFunctionArgument).nodeId));

	// There is no argument besides the rmNa argument, so result is -Infinity
	if(allArgumentIntervals.length === 0) {
		return IntervalDomain.scalar(Number.NEGATIVE_INFINITY, significantFigures);
	}

	// Not all arguments are (known) numeric scalar values, so if NAs are removed, we know result must be numeric scalar.
	// If NA is not removed, result could be NA => undefined.
	if(allArgumentIntervals.some(isUndefined)) {
		if(rmNa) {
			return IntervalDomain.top(significantFigures);
		}
		return undefined;
	}

	// All arguments are known numeric scalar values, so we can return the max
	let maxLowerBound = Number.NEGATIVE_INFINITY;
	let maxUpperBound = Number.NEGATIVE_INFINITY;

	for(const interval of allArgumentIntervals) {
		if(interval?.value === Bottom){
			return IntervalDomain.bottom(significantFigures);
		}
		if(isNotUndefined(interval) && interval.value[0] > maxLowerBound) {
			maxLowerBound = interval.value[0];
		}
		if(isNotUndefined(interval) && interval.value[1] > maxUpperBound) {
			maxUpperBound = interval.value[1];
		}
	}

	return new IntervalDomain([maxLowerBound, maxUpperBound], significantFigures);
}

function intervalAbs(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	if(isUndefined(arg) || arg.value === Bottom) {
		return arg;
	}

	const [a, b] = arg.value;
	const minMax = getMinMax([Math.abs(a), Math.abs(b)]);
	if(isNotUndefined(minMax)) {
		return arg.create([minMax.min, minMax.max]);
	}
	return arg.top();
}

function intervalModulo(left: IntervalDomain | undefined, right: IntervalDomain | undefined): IntervalDomain | undefined {
	if(isUndefined(left) || isUndefined(right)) {
		return undefined;
	}
	const significantFigures = getMin([left.significantFigures, right.significantFigures].filter(isNotUndefined));
	if(left.isBottom() || right.isBottom()) {
		return left.bottom(significantFigures);
	}
	const [a, b] = left.value as [number, number];
	const [c, d] = right.value as [number, number];
	// left contains Inf/-Inf => Top (might be NaN)
	// right contains 0 => Top (might be NaN)
	if(a === Number.NEGATIVE_INFINITY || b === Number.POSITIVE_INFINITY || (c <= 0 && d >= 0)) {
		return undefined;
	}
	if(a === b && c == d) {
		return left.scalar(a % c, significantFigures);
	}
	// right decides the sign
	// result is at most max of right value
	const maxLeft = getMax([Math.abs(a), Math.abs(b)]) ?? 0;
	const maxRight = getMax([Math.abs(c), Math.abs(d)]) ?? 0;
	const maxModulo = maxLeft < maxRight ? maxLeft : maxRight;
	if(c > 0) {
		// result is positive
		return left.create([0, maxModulo], significantFigures);
	}
	// result is negative
	return left.create([-maxModulo, 0], significantFigures);
}

function intervalLog<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(args.length === 0 || args.length > 2 || args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	if(args.length === 1 && !FunctionArgument.isPositional(args[0])) {
		return IntervalDomain.bottom(significantFigures);
	}

	let operandArg: PositionalFunctionArgument;
	let baseArg: PositionalFunctionArgument | NamedFunctionArgument | undefined = undefined;
	if(args.length === 1) {
		operandArg = args[0] as PositionalFunctionArgument;
	} else {
		if(FunctionArgument.isNamed(args[0]) && FunctionArgument.isPositional(args[1])) {
			operandArg = args[1];
			baseArg = args[0];
		} else {
			operandArg = args[0] as PositionalFunctionArgument;
			baseArg = args[1] as NamedFunctionArgument | PositionalFunctionArgument;
		}
	}

	const operand = visitor.getInterval(operandArg.nodeId);
	let base: IntervalDomain | undefined = undefined;
	if(isNotUndefined(baseArg)) {
		let baseNodeId: NodeId | undefined;
		if(FunctionArgument.isNamed(baseArg) && baseArg?.name === 'base') {
			baseNodeId = baseArg?.valueId;
		} else if(FunctionArgument.isPositional(baseArg)) {
			baseNodeId = baseArg?.nodeId;
		} else {
			// Invalid argument
			return IntervalDomain.bottom(significantFigures);
		}

		if(isNotUndefined(baseNodeId)) {
			base = visitor.getInterval(baseNodeId);
		} else {
			base = IntervalDomain.top(significantFigures);
		}
	}

	if(isUndefined(operand) || operand.isBottom()) {
		return operand;
	}
	if(base?.isBottom()) {
		return operand.bottom(significantFigures);
	}

	const [a, b] = operand.value as [number, number];

	if(a < 0) {
		return undefined;
	}
	if(a == b) {
		if(isUndefined(base)) {
			return operand.scalar(Math.log(a));
		}
		const [c, d] = base?.value as [number, number];
		if(c === d) {
			return operand.scalar(Math.log(a) / Math.log(c));
		}
		return operand.top();
	}
	if(isUndefined(base)) {
		return operand.create([Math.log(a), Math.log(b)]);
	}
	const [c, d] = base?.value as [number, number];
	if(c === d) {
		return operand.create([Math.log(a) / Math.log(c), Math.log(b) / Math.log(c)]);
	}
	return operand.top();
}

function intervalReturnNumIfAllArgsAreNum<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(args.length === 0 || args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	const allArgIntervals = args.map(arg => {
		if(FunctionArgument.isPositional(arg)) {
			return visitor.getInterval(arg.nodeId);
		}
		return undefined;
	});

	if(allArgIntervals.some(isUndefined)) {
		return undefined;
	}
	return IntervalDomain.top();
}

function intervalRound<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(args.length === 0 || args.length > 2 || args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	let x: IntervalDomain | undefined | 'unknown' = 'unknown';
	let digits: IntervalDomain | undefined | 'unknown' = 'unknown';

	const namedArguments = args.filter(FunctionArgument.isNamed);

	for(const arg of namedArguments) {
		if(arg.name === 'x' && isNotUndefined(arg.valueId)) {
			x = visitor.getInterval(arg.valueId);
		} else if(arg.name === 'digits' && isNotUndefined(arg.valueId)) {
			digits = visitor.getInterval(arg.valueId);
		}
	}

	const positionalArguments = args.filter(FunctionArgument.isPositional);

	for(const arg of positionalArguments) {
		if(x === 'unknown') {
			x = visitor.getInterval(arg.nodeId);
		} else if(digits === 'unknown') {
			digits = visitor.getInterval(arg.nodeId);
		}
	}

	if(x === 'unknown' || isUndefined(x)) {
		return undefined;
	}
	if(isUndefined(digits)) {
		// digits can be any value, so we overapproximate
		return IntervalDomain.top();
	}
	if(x.value === Bottom) {
		return x.bottom();
	}
	if(digits === 'unknown') {
		// digits is not specified, so default is round with digits=0
		return x.create([Math.round(x.value[0]), Math.round(x.value[1])]);
	}
	if(digits.value === Bottom) {
		return x.bottom();
	}
	const [lDigits, uDigits] = digits.value;
	if(lDigits === uDigits && Number.isInteger(lDigits)) {
		const roundingFactor = 10 ** lDigits;
		return x.create([Math.round(x.value[0] * roundingFactor) / roundingFactor, Math.round(x.value[1] * roundingFactor) / roundingFactor]);
	}
	return x.top();
}

function intervalSign(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	if(isUndefined(arg) || arg.value === Bottom) {
		return arg;
	}

	const [a, b] = arg.value;

	return arg.create([Math.sign(a), Math.sign(b)]);
}

function intervalRunif<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(args.length === 0 || args.length > 3 || args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	let n: IntervalDomain | undefined | 'unknown' = 'unknown';
	let min: IntervalDomain | undefined | 'unknown' = 'unknown';
	let max: IntervalDomain | undefined | 'unknown' = 'unknown';

	const namedArguments = args.filter(FunctionArgument.isNamed);

	for(const arg of namedArguments) {
		if(isNotUndefined(arg.valueId)) {
			const interval = visitor.getInterval(arg.valueId);
			if(arg.name === 'n'){
				n = interval;
			} else if(arg.name === 'min') {
				min = interval;
			} else if(arg.name === 'max') {
				max = interval;
			} else {
				// Unused argument, so return bottom
				return IntervalDomain.bottom(significantFigures);
			}
		}
	}

	const positionalArguments = args.filter(FunctionArgument.isPositional);

	for(const arg of positionalArguments) {
		const interval = visitor.getInterval(arg.nodeId);
		if(n === 'unknown') {
			n = interval;
		} else if(min === 'unknown') {
			min = interval;
		} else if(max === 'unknown') {
			max = interval;
		} else {
			// Unused argument, so return bottom
			return IntervalDomain.bottom(significantFigures);
		}
	}

	if(n === 'unknown') {
		return IntervalDomain.bottom();
	}

	if(isUndefined(n) || n.value === Bottom) {
		return n;
	}

	const [ln, un] = n.value;

	// runif throws an error if n < 0
	if(un < 0) {
		return IntervalDomain.bottom(significantFigures);
	}
	// We can only infer something if exactly one value is returned by the function.
	if(ln !== un || ln !== 1) {
		return undefined;
	}

	let [lmin, rmin] = [0, 0];
	let [lmax, rmax] = [0, 0];
	// min and max default to 0 if not specified
	if(min !== 'unknown') {
		if(min?.value === Bottom) {
			return IntervalDomain.bottom();
		}
		if(isUndefined(min)) {
			// We do not know if the min arg potentially produces an error
			return undefined;
		}
		[lmin, rmin] = min.value;
	}

	if(max !== 'unknown') {
		if(max?.value === Bottom) {
			return IntervalDomain.bottom();
		}
		if(isUndefined(max)) {
			// We do not know if the max arg potentially produces an error
			return undefined;
		}
		[lmax, rmax] = max.value;
	}

	if(rmin > lmax) {
		// runif produces NaN if the provided min arg is greater than the provided max arg, so if the interval overlap
		// we need to overapproximate.
		return undefined;
	}

	return n.create([lmin, rmax]);
}

function intervalAsNumeric<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	if(args.length === 0) {
		// Providing no args returns numeric(0) which requires overapproximation
		return undefined;
	}
	if(args.some(FunctionArgument.isEmpty)) {
		return IntervalDomain.bottom(significantFigures);
	}

	let x: IntervalDomain | undefined = undefined;
	// uses the first argument if it is named x or positional
	if(FunctionArgument.isNamed(args[0])) {
		if(args[0].name === 'x' && isNotUndefined(args[0].valueId)) {
			x = visitor.getInterval(args[0].valueId);
		} else {
			return IntervalDomain.bottom(significantFigures);
		}
	} else if(FunctionArgument.isPositional(args[0])) {
		x = visitor.getInterval(args[0].nodeId);
	}

	return x?.create(x.value);
}

function intervalAsInteger<StateDomain extends AnyStateDomain<AnyAbstractDomain>>(args: readonly FunctionArgument[], visitor: IntervalExpressionSemanticsVisitor<StateDomain>, significantFigures: number | undefined): IntervalDomain | undefined {
	const asNumeric = intervalAsNumeric(args, visitor, significantFigures);

	if(isUndefined(asNumeric)) {
		return undefined;
	}
	if(asNumeric.value === Bottom) {
		return IntervalDomain.bottom(significantFigures);
	}

	const [a, b] = asNumeric.value;
	return asNumeric.create([Math.trunc(a), Math.trunc(b)]);
}

function intervalSinCosOp(arg: IntervalDomain | undefined): IntervalDomain | undefined {
	if(isUndefined(arg) || arg.value === Bottom) {
		return arg;
	}

	return arg.create([-1, 1]);
}