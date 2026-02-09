import { IntervalDomain } from '../domains/interval-domain';
import { Identifier } from '../../dataflow/environments/identifier';
import { isUndefined } from '../../util/assert';

/**
 * Maps function/operator names to the semantic functions.
 */
const IntervalSemanticsMapper: [identifier: Identifier, semantics: IntervalSemanticsMapperInfo][] = [
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

type IntervalSemanticsMapperInfo = IntervalSemantics;

/**
 * Applies the abstract semantics of the provided function name to the provided args.
 * @param functionIdentifier - The {@link Identifier} of the function/operator.
 * @param args - The resolved inferred intervals of the arguments.
 * @returns The resulting interval after applying the semantics.
 */
export function applyIntervalSemantics(functionIdentifier: Identifier, args: (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	const match = IntervalSemanticsMapper.find(([id, _]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		console.warn(`Function identifier ${functionIdentifier.toString()} is not a valid interval operation. Returning undefined semantics.`);
		return undefined;
	}

	const [_, semantics] = match;

	return semantics(IntervalDomain.bottom(), args);
}

function addSemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		const left = args[0];
		if(left?.isBottom()) {
			return domain.bottom();
		}
		if(left?.isValue()) {
			const [a, b] = left.value;
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

	console.error('Called add with more than 2 arguments, which is not supported.');
	return undefined;
}

function subtractSemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		const left = args[0];
		if(left?.isBottom()) {
			return domain.bottom();
		}
		if(left?.isValue()) {
			const [a, b] = left.value;
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

	console.error('Called subtract with more than 2 arguments, which is not supported.');
	return undefined;
}

function multiplySemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	if(args.length !== 2) {
		console.error('Called multiply with more than 2 arguments, which is not supported.');
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
		console.error('Called length with more than 1 argument, which is not supported.');
		return undefined;
	}

	const arg = args[0];

	if(arg?.isBottom()) {
		return IntervalDomain.bottom();
	}

	if(arg?.isValue()) {
		return domain.create([1, 1]);
	}

	return domain.create([0, Infinity]);
}