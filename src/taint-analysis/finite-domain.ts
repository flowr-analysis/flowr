import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { Bottom, Top } from '../abstract-interpretation/domains/lattice';
import { guard } from '../util/assert';

export type LatticeElements<Top, Bottom> = (symbol | Top | Bottom)[];

export interface FiniteLatticeConfig<Top, Bot, Elements extends LatticeElements<Top, Bot> = [Top, Bot]> {
	/** The Top element of the lattice (greatest element). */
	readonly top: Top | typeof Top;

	/** The Bottom element of the lattice (least element). */
	readonly bottom: Bot | typeof Bottom;

	/** The set of all lattice elements. */
	readonly elements: ReadonlySet<Elements[number]>;

	/**
	 * The partial order defining relationships between elements.
	 * leq[a] contains all elements b where a ≤ b (elements greater than or equal to a)
	 */
	readonly leq: ReadonlyMap<Elements[number], ReadonlySet<Elements[number]>>;
}

export class FiniteDomain<Top extends symbol, Bot extends symbol, Elements extends LatticeElements<Top, Bot>>
	extends AbstractDomain<Elements[number], Top, Bot, Elements[number]> {
	private readonly _config: FiniteLatticeConfig<Top, Bot, Elements>;

	constructor(value: Elements[number], config: FiniteLatticeConfig<Top, Bot, Elements>) {
		super(value);
		this._config = config;
	}

	create(value: Elements[number]): this {
		return new FiniteDomain<Top, Bot, Elements>(value, this._config) as this;
	}

	top(): this & AbstractDomain<Elements[number], Top, Bot, Top> {
		return this.create(this._config.top) as this & AbstractDomain<Elements[number], Top, Bot, Top>;
	}

	bottom(): this & AbstractDomain<Elements[number], Top, Bot, Bot> {
		return this.create(this._config.bottom) as this & AbstractDomain<Elements[number], Top, Bot, Bot>;
	}

	isTop(): this is this & AbstractDomain<Elements[number], Top, Bot, Top> {
		return this.value === this._config.top;
	}

	isBottom(): this is this & AbstractDomain<Elements[number], Top, Bot, Bot> {
		return this.value === this._config.bottom;
	}

	isValue(): this is this & AbstractDomain<Elements[number], Top, Bot, Elements[number]> {
		return this.value !== this._config.top && this.value !== this._config.bottom;
	}

	protected equalsValue(this: FiniteDomain<Top, Bot, Elements>, other: FiniteDomain<Top, Bot, Elements>): boolean {
		return this.value === other.value;
	}

	protected leqValue(this: FiniteDomain<Top, Bot, Elements>, other: FiniteDomain<Top, Bot, Elements>): boolean {
		return this.transitiveClosure(this.value).has(other.value);
	}

	protected joinValue(this: this & FiniteDomain<Top, Bot, Elements>, other: FiniteDomain<Top, Bot, Elements>): this {
		const thisUpper = this.upperClosure(this.value);
		const otherUpper = this.upperClosure(other.value);

		const commonUpper = new Set<Elements[number]>();
		for(const element of thisUpper) {
			if(otherUpper.has(element)) {
				commonUpper.add(element);
			}
		}

		let minimal: Elements[number] | undefined;
		for(const candidate of commonUpper) {
			if(minimal === undefined || this.upperClosure(candidate).has(minimal)) {
				minimal = candidate;
			}
		}

		return minimal !== undefined ? this.create(minimal) : this.top();
	}

	protected meetValue(this: this & FiniteDomain<Top, Bot, Elements>, other: FiniteDomain<Top, Bot, Elements>): this {
		const commonLower = new Set<Elements[number]>();
		for(const candidate of this._config.elements) {
			const upper = this.upperClosure(candidate);
			if(upper.has(this.value) && upper.has(other.value)) {
				commonLower.add(candidate);
			}
		}

		let maximal: Elements[number] | undefined;
		for(const candidate of commonLower) {
			if(maximal === undefined || this.upperClosure(maximal).has(candidate)) {
				maximal = candidate;
			}
		}

		guard(maximal !== undefined, 'Could not determine greatest lower bound');
		return this.create(maximal);
	}

	/** All elements greater than or equal to the given element (including the element itself). */
	private upperClosure(element: Elements[number]): Set<Elements[number]> {
		const closure = this.transitiveClosure(element);
		closure.add(element);
		return closure;
	}

	/** All elements strictly greater than the given element. */
	private transitiveClosure(element: Elements[number]): Set<Elements[number]> {
		const visited = new Set<Elements[number]>();
		const stack = [element];
		while(stack.length > 0) {
			const current = stack.pop();
			guard(current, 'Error in transitive lattice closure');
			if(visited.has(current)) {
				continue;
			}
			if(current !== element) {
				visited.add(current);
			}
			for(const successor of this._config.leq.get(current) ?? []) {
				stack.push(successor);
			}
		}
		return visited;
	}

	protected stringify(): string {
		return this.value.description ?? this.value.toString();
	}

	protected jsonify(): unknown {
		return this.value.description ?? this.value.toString();
	}

	narrow(other: this): this {
		return this.meet(other);  // Using meet for narrowing as the lattice is finite
	}

	widen(other: this): this {
		return this.join(other);  // Using join for widening as the lattice is finite
	}

	abstract(_concrete: ReadonlySet<Elements[number]> | typeof Top): this {
		return this.create(this._value);
	}
}
