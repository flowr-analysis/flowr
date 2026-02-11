import { IntervalDomain } from '../domains/interval-domain';
import { Identifier } from '../../dataflow/environments/identifier';
import { isUndefined } from '../../util/assert';
import { log } from '../../util/log';

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
 * @param domain - IntervalDomain used to create new domain elements.
 * @param args - The resolved inferred intervals of the arguments.
 * @returns The resulting interval after applying the semantics.
 */
type IntervalSemantics = (domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]) => (IntervalDomain | undefined);

type IntervalSemanticsMapperInfo = [identifier: Identifier, semantics: IntervalSemantics];

/**
 * Applies the abstract expression semantics of the provided function with respect to the interval domain to the provided args.
 * @param functionIdentifier - The {@link Identifier} of the function/operator.
 * @param args - The resolved inferred intervals of the arguments.
 * @returns The resulting interval after applying the semantics.
 */
export function applyIntervalExpressionSemantics(functionIdentifier: Identifier, args: (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	const match = IntervalSemanticsMapper.find(([id]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		log.debug(`Function identifier ${functionIdentifier.toString()} is not a valid interval operation. Returning undefined semantics.`);
		return undefined;
	}

	const [_, semantics] = match;

	return semantics(IntervalDomain.bottom(), args);
}

function addSemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		const arg = args[0];
		if(arg?.isBottom()) {
			return domain.bottom();
		}
		if(arg?.isValue()) {
			const [a, b] = arg.value;
			return domain.create([a, b]);
		}
		return undefined;
	}

	// Usage as addition
	if(args.length === 2) {
		const left = args[0];
		const right = args[1];

		if(left?.isBottom() || right?.isBottom()) {
			return domain.bottom();
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

			return domain.create([a + c, b + d]);
		}
		return undefined;
	}

	log.warn('Called "+" with more than 2 arguments, which is not supported.');
	return undefined;
}

function subtractSemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		const arg = args[0];
		if(arg?.isBottom()) {
			return domain.bottom();
		}
		if(arg?.isValue()) {
			const [a, b] = arg.value;
			return domain.create([-b, -a]);
		}
		return undefined;
	}

	// Usage as subtraction
	if(args.length === 2) {
		const left = args[0];
		const right = args[1];

		return addSemantics(domain, [left, subtractSemantics(domain, [right])]);
	}

	log.warn('Called "-" with more than 2 arguments, which is not supported.');
	return undefined;
}

function multiplySemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	if(args.length !== 2) {
		log.warn('Called "*" with more/less than 2 arguments, which is not supported.');
		return undefined;
	}

	const left = args[0];
	const right = args[1];

	if(left?.isBottom() || right?.isBottom()) {
		return domain.bottom();
	}

	if(left?.isValue() && right?.isValue()) {
		const [a, b] = left.value;
		const [c, d] = right.value;

		if(((a === -Infinity || b === Infinity) && c <= 0 && d >= 0)
			|| ((c === -Infinity || d === Infinity) && a <= 0 && b >= 0)) {
			return undefined;
		}

		const products = [a * c, a * d, b * c, b * d];

		return domain.create([Math.min(...products), Math.max(...products)]);
	}

	return undefined;
}

function lengthSemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	if(args.length !== 1) {
		log.warn('Called "length" with more/less than 1 argument, which is not supported.');
		return undefined;
	}

	const arg = args[0];

	if(arg?.isBottom()) {
		return domain.bottom();
	}

	if(arg?.isValue()) {
		return domain.create([1, 1]);
	}

	return domain.create([0, Infinity]);
}