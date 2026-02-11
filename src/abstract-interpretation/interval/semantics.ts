import { IntervalDomain } from '../domains/interval-domain';
import { Identifier } from '../../dataflow/environments/identifier';
import { isUndefined } from '../../util/assert';
import { log } from '../../util/log';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { NumericInferenceVisitor } from './numeric-inference';

/**
 * Maps function/operator names to the semantic functions.
 */
const IntervalSemanticsMapper: readonly IntervalSemanticsMapperInfo[] = [
	[Identifier.make('+'), addSemantics],
	[Identifier.make('-'), subtractSemantics],
	[Identifier.make('*'), multiplySemantics],
	[Identifier.make('length'), lengthSemantics],
] as const;

/**
 * Semantics definition function for the interval domain.
 * @param args - The raw arguments of the function/operator.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @returns The resulting interval after applying the semantics.
 */
type IntervalSemantics = (args: readonly FunctionArgument[], visitor: NumericInferenceVisitor) => (IntervalDomain | undefined);

type IntervalSemanticsMapperInfo = [identifier: Identifier, semantics: IntervalSemantics];

/**
 * Applies the abstract expression semantics of the provided function with respect to the interval domain to the provided args.
 * @param functionIdentifier - The {@link Identifier} of the function/operator.
 * @param args - The arguments of the function/operator.
 * @param visitor - The numeric inference visitor performing the analysis used to resolve argument intervals.
 * @returns The resulting interval after applying the semantics.
 */
export function applyIntervalExpressionSemantics(functionIdentifier: Identifier, args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	const match = IntervalSemanticsMapper.find(([id]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		log.debug(`Function identifier ${functionIdentifier.toString()} is not a valid interval operation. Returning undefined semantics.`);
		return undefined;
	}

	const [_, semantics] = match;

	return semantics(args, visitor);
}

/**
 * Adds the provided intervals.
 * If one argument is provided, it is treated as a unary plus operation.
 * If two arguments are provided, they are added together.
 * @param args - The intervals to add.
 * @returns The resulting interval after addition.
 */
function intervalAdd(args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	if(args.length === 1) {
		if(args[0]?.isBottom()) {
			return args[0].bottom();
		}
		if(args[0]?.isValue()) {
			const [a, b] = args[0].value;
			return args[0].create([a, b]);
		}
		return undefined;
	}

	if(args.length === 2) {
		const left = args[0];
		const right = args[1];

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

	log.warn('Called "+" with more than 2 arguments, which is not supported.');
	return IntervalDomain.bottom();
}

function addSemantics(args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		if(FunctionArgument.isEmpty(args[0])) {
			log.warn('Called unary "+" with an empty argument, which is not supported.');
			return IntervalDomain.bottom();
		}

		const arg = visitor.getAbstractValue(args[0].nodeId);
		return intervalAdd([arg]);
	}

	// Usage as addition
	if(args.length === 2) {
		if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
			log.warn('Called binary "+" with at least one empty argument, which is not supported.');
			return IntervalDomain.bottom();
		}

		const left = visitor.getAbstractValue(args[0].nodeId);
		const right = visitor.getAbstractValue(args[1].nodeId);

		return intervalAdd([left, right]);
	}

	log.warn('Called "+" with more than 2 arguments, which is not supported.');
	return IntervalDomain.bottom();
}

/**
 * Subtracts the provided intervals.
 * If one argument is provided, it is treated as a unary minus operation.
 * If two arguments are provided, the second is subtracted from the first.
 * @param args - The intervals to subtract.
 * @returns The resulting interval after subtraction.
 */
function intervalSubtract(args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	if(args.length === 1) {
		const arg = args[0];
		if(arg?.isBottom()) {
			return arg.bottom();
		}
		if(arg?.isValue()) {
			const [a, b] = arg.value;
			return arg.create([-b, -a]);
		}
		return undefined;
	}

	if(args.length === 2) {
		const left = args[0];
		const right = args[1];

		return intervalAdd([left, intervalSubtract([right])]);
	}

	log.warn('Called "-" with more than 2 arguments, which is not supported.');
	return IntervalDomain.bottom();
}

function subtractSemantics(args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		if(FunctionArgument.isEmpty(args[0])) {
			log.warn('Called unary "-" with an empty argument, which is not supported.');
			return IntervalDomain.bottom();
		}

		const arg = visitor.getAbstractValue(args[0].nodeId);
		return intervalSubtract([arg]);
	}

	// Usage as subtraction
	if(args.length === 2) {
		if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
			log.warn('Called binary "-" with at least one empty argument, which is not supported.');
			return IntervalDomain.bottom();
		}

		const left = visitor.getAbstractValue(args[0].nodeId);
		const right = visitor.getAbstractValue(args[1].nodeId);

		return intervalSubtract([left, right]);
	}

	log.warn('Called "-" with more than 2 arguments, which is not supported.');
	return IntervalDomain.bottom();
}

function multiplySemantics(args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	if(args.length !== 2) {
		log.warn('Called "*" with more/less than 2 arguments, which is not supported.');
		return IntervalDomain.bottom();
	}

	if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
		log.warn('Called binary "*" with at least one empty argument, which is not supported.');
		return IntervalDomain.bottom();
	}

	const left = visitor.getAbstractValue(args[0].nodeId);
	const right = visitor.getAbstractValue(args[1].nodeId);

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

		return left.create([Math.min(...products), Math.max(...products)]);
	}

	return undefined;
}

function lengthSemantics(args: readonly FunctionArgument[], visitor: NumericInferenceVisitor): IntervalDomain | undefined {
	if(args.length !== 1) {
		log.warn('Called "length" with more/less than 1 argument, which is not supported.');
		return IntervalDomain.bottom();
	}

	if(FunctionArgument.isEmpty(args[0])) {
		log.warn('Called unary "length" with an empty argument, which is not supported.');
		return IntervalDomain.bottom();
	}

	const arg = visitor.getAbstractValue(args[0].nodeId);

	if(arg?.isBottom()) {
		return arg.bottom();
	}

	if(arg?.isValue()) {
		return arg.create([1, 1]);
	}

	return new IntervalDomain([0, Infinity]);
}