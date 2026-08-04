// diverging from boolean | maybe requires explicit handling
export enum Ternary {
	Always = 'always',
	Maybe = 'maybe',
	Never = 'never'
}

export const TernaryLogic = {
	name: 'Ternary',
	negate(this: void, value: Ternary): Ternary {
		if(value === Ternary.Always) {
			return Ternary.Never;
		} else if(value === Ternary.Never) {
			return Ternary.Always;
		}
		return Ternary.Maybe;
	},
	or(this: void, ...values: Ternary[]): Ternary {
		if(values.some(value => value === Ternary.Always)) {
			return Ternary.Always;
		} else if(values.some(value => value === Ternary.Maybe)) {
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
