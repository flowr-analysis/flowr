import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from '../abstract-interpretation/domains/lattice';
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
	extends AbstractDomain<Elements[number], Elements[number], Top, Bot, Elements[number]> {
	private readonly _config: FiniteLatticeConfig<Top, Bot, Elements>;

	constructor(value: Elements[number], config: FiniteLatticeConfig<Top, Bot, Elements>) {
		super(value);
		this._config = config;
	}

	join(other: this): this {
		if(this.equals(other)) {
			return this;
		}

		if(this.isTop() || other.isTop()) {
			return this.top() as this;
		}

		if(this.isBottom()) {
			return other;
		}

		if(other.isBottom()) {
			return this;
		}

		return this.findLeastUpperBound(other);
	}

	private findLeastUpperBound(other: this): this {
		const thisSuccessors = this.transitiveClosure(this.value);
		const otherSuccessors = this.transitiveClosure(other.value);

		const commonSuccessors = new Set<Elements[number]>();
		for(const succ of thisSuccessors) {
			if(otherSuccessors.has(succ)) {
				commonSuccessors.add(succ);
			}
		}

		let minimal: Elements[number] | undefined;
		for(const candidate of commonSuccessors) {
			if(minimal === undefined) {
				minimal = candidate;
			} else {
				const candidateSuccessors = this.transitiveClosure(candidate);
				if(candidateSuccessors.has(minimal)) {
					minimal = candidate;
				}
			}
		}

		return minimal ? this.create(minimal) : this.top();
	}

	meet(other: this): this {
		if(this.equals(other)) {
			return this;
		}

		if(this.isBottom() || other.isBottom()) {
			return this.bottom() as this;
		}

		if(this.isTop()) {
			return other;
		}

		if(other.isTop()) {
			return this;
		}

		return this.findGreatestLowerBound(other);
	}

	private findGreatestLowerBound(other: this): this {
		const elements = this._config.elements;
		let greatestLowerBound: Elements[number] | null = null;

		for(const candidate of elements) {
			if(this.leq(this.create(candidate), this) && this.leq(this.create(candidate), other)) {
				if(
					greatestLowerBound === null ||
					this.leq(this.create(greatestLowerBound), this.create(candidate))
				) {
					greatestLowerBound = candidate;
				}
			}
		}

		guard(greatestLowerBound, 'Could not determine greatest lower bound');
		return this.create(greatestLowerBound);
	}

	leq(elementA: this, elementB?: this): boolean {
		const a = elementB === undefined ? this : elementA;
		const b = elementB ?? elementA;

		if(a.value === b.value) {
			return true; // Reflexivity
		}

		if(a.value === b._config.top) {
			return b.value === a._config.top;
		}
		if(b.value === a._config.top) {
			return true;
		}

		if(a.value === a._config.bottom) {
			return true;
		}
		if(b.value === a._config.bottom) {
			return false;
		}

		const closure = this.transitiveClosure(a.value);
		return closure.has(b.value);
	}

	private transitiveClosure(element: Elements[number]): Set<Elements[number]> {
		const visited = new Set<Elements[number]>();
		const stack = [element];
		while(stack.length > 0) {
			const current = stack.pop();
			guard(current, 'Error in transitive lattice closure');
			if(current !== element) {
				visited.add(current);
			}
			const successors = this._config.leq.get(current) ?? new Set();
			stack.push(...successors);
		}
		return visited;
	}

	create(value: Elements[number]): this;
	create(value: Elements[number]): FiniteDomain<Top, Bot, Elements> {
		return new FiniteDomain<Top, Bot, Elements>(value, this._config);
	}

	top(): this & FiniteDomain<Top, Bot, [Top]> {
		return this.create(this._config.top) as this & FiniteDomain<Top, Bot, [Top]>;
	}

	bottom(): this & FiniteDomain<Top, Bot, [Bot]> {
		return this.create(this._config.bottom) as this & FiniteDomain<Top, Bot, [Bot]>;
	}

	isTop(): this is AbstractDomain<Elements[number], Elements[number], Top, Bot, Top> {
		return this.value === this._config.top;
	}

	isBottom(): this is AbstractDomain<Elements[number], Elements[number], Top, Bot, Bot> {
		return this.value === this._config.bottom;
	}

	isValue(): this is AbstractDomain<Elements[number], Elements[number], Top, Bot, Bot> {
		return this.value !== Top && this.value !== Bottom;
	}

	equals(other: FiniteDomain<Top, Bot, Elements>): boolean {
		return this.value === other.value;
	}

	toString(): string {
		if(this.value === Top) {
			return TopSymbol;
		}
		if(this.value === Bottom) {
			return BottomSymbol;
		}
		return this.value.description ?? this.value.toString();
	}

	toJSON(): unknown {
		return this.value.description ?? this.value.toString();
	}

	narrow(other: this): this {
		return this.meet(other);  // Using meet for narrowing as the lattice is finite
	}

	widen(other: this): this {
		return this.join(other);  // Using join for widening as the lattice is finite
	}

	concretize(_limit: number): ReadonlySet<Elements[number]> | typeof Top {
		return new Set<Elements[number]>([this._value]); // Simply fulfills identity property of Galois connection.
	}

	abstract(_concrete: ReadonlySet<Elements[number]> | typeof Top): this {
		return this.create(this._value); // Simply fulfills identity property of Galois connection.
	}
}