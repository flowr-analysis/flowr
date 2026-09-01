// diverging from boolean | maybe requires explicit handling
export enum Ternary {
	Always = 'always',
	Maybe = 'maybe',
	Never = 'never'
}

/**
 * Always, never, or maybe, which is what a static answer about a running program usually is.
 * Its operators keep `maybe` infectious, so a conclusion never claims more than what is known.
 */
export const TernaryLogic = {
	name: 'TernaryLogic',
	negate(this: void, value: Ternary): Ternary {
		if(value === Ternary.Always) {
			return Ternary.Never;
		} else if(value === Ternary.Never) {
			return Ternary.Always;
		}
		return Ternary.Maybe;
	},
	or(this: void, ...values: Ternary[]): Ternary {
		if(values.includes(Ternary.Always)) {
			return Ternary.Always;
		} else if(values.includes(Ternary.Maybe)) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	},
	and(this: void, ...values: Ternary[]): Ternary {
		if(values.every(value => value === Ternary.Always)) {
			return Ternary.Always;
		} else if(values.every(value => value === Ternary.Always || value === Ternary.Maybe)) {
			return Ternary.Maybe;
		}
		return Ternary.Never;
	}
};
