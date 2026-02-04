import { IntervalDomain } from '../domains/interval-domain';

/**
 * Maps function/operator names to the semantic functions.
 */
const IntervalSemanticsMapper = {
	'+':       addSemantics,
	'-':       subtractSemantics,
	'*':       multiplySemantics,
	'length':  lengthSemantics,
	'unknown': () => undefined,
} as const satisfies Record<string, IntervalSemanticsMapperInfo>;

type IntervalSemanticsMapperInfo = IntervalSemantics;

/**
 * Semantics definition function for the interval domain.
 * @param domain - IntervalDomain used to create new domain elements.
 * @param args - The resolved inferred intervals of the arguments.
 * @returns The resulting interval after applying the semantics.
 */
type IntervalSemantics = (domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]) => (IntervalDomain | undefined);

/** All available interval operations. */
export type IntervalOperationName = keyof typeof IntervalSemanticsMapper;

/** The names of all interval operations. */
export const IntervalOperationNames = Object.keys(IntervalSemanticsMapper) as IntervalOperationName[];

/**
 * Applies the abstract semantics of the provided function name to the provided args.
 * @param fName - The name of the function/operator.
 * @param args - The resolved inferred intervals of the arguments.
 * @returns The resulting interval after applying the semantics.
 */
export function applyIntervalSemantics(fName: string, args: (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	// Check if fName is a valid IntervalOperationName. If not, set to 'unknown' to return undefined semantics.
	if(!IntervalOperationNames.includes(fName as IntervalOperationName)) {
		fName = 'unknown';
	}

	return IntervalSemanticsMapper[fName as IntervalOperationName](IntervalDomain.bottom(), args);
}

function addSemantics(domain: IntervalDomain, args: readonly (IntervalDomain | undefined)[]): IntervalDomain | undefined {
	// Usage as sign operator
	if(args.length === 1) {
		const left = args[0];
		if(left?.isBottom()) {
			return IntervalDomain.bottom();
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
			return IntervalDomain.bottom();
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
			return IntervalDomain.bottom();
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
		return IntervalDomain.bottom();
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