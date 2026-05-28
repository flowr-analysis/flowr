import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from '../abstract-interpretation/domains/lattice';
import { guard } from '../util/assert';

export interface FiniteLatticeConfig<Element, Top, Bot> {
	/** The Top element of the lattice (greatest element). */
	readonly top: Top | typeof Top;

	/** The Bottom element of the lattice (least element). */
	readonly bottom: Bot | typeof Bottom;

	/** The set of all lattice elements. */
	readonly elements: ReadonlySet<Element>;

	/**
	 * The partial order defining relationships between elements.
	 * leq[a] contains all elements b where a ≤ b (elements greater than or equal to a)
	 */
	readonly leq: ReadonlyMap<Element, ReadonlySet<Element>>;
}

export class FiniteDomain<Element extends Top | Bot | symbol, Top extends symbol, Bot extends symbol> extends AbstractDomain<Element, Element, Top, Bot, Element> {
	private readonly _config: FiniteLatticeConfig<Element, Top, Bot>;

	constructor(value: Element, config: FiniteLatticeConfig<Element, Top, Bot>) {
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

		const commonSuccessors = new Set<Element>();
		for(const succ of thisSuccessors) {
			if(otherSuccessors.has(succ)) {
				commonSuccessors.add(succ);
			}
		}

		let minimal: Element | undefined;
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
		let greatestLowerBound: Element | null = null;

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

		return this.create(greatestLowerBound as Element);
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

	private transitiveClosure(element: Element): Set<Element> {
		const visited = new Set<Element>();
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

	create(value: Element): this;
	create(value: Element): FiniteDomain<Element, Top, Bot> {
		return new FiniteDomain<Element, Top, Bot>(value, this._config);
	}

	top(): this & AbstractDomain<Element, Element, Top, Bot, Top>{
		// @ts-expect-error i should know better
		return this.create(this._config.top as Element);
	}

	bottom(): this & AbstractDomain<Element, Element, Top, Bot, Bot> {
		// @ts-expect-error i should know better
		return this.create(this._config.bottom as Element);
	}

	isTop(): this is AbstractDomain<Element, Element, Top, Bot, Top> {
		return this.value === this._config.top;
	}

	isBottom(): this is AbstractDomain<Element, Element, Top, Bot, Bot> {
		return this.value === this._config.bottom;
	}

	isValue(): this is FiniteDomain<Element, Top, Bot> {
		return this.value !== Top && this.value !== Bottom;
	}

	equals(other: FiniteDomain<Element, Top, Bot>): boolean {
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

	toJson(): unknown {
		return this.value.description ?? this.value.toString();
	}

	narrow(other: this): this {
		return this.meet(other);  // Using meet for narrowing as the lattice is finite
	}

	widen(other: this): this {
		return this.join(other);  // Using join for widening as the lattice is finite
	}

	concretize(_limit: number): ReadonlySet<Element> | typeof Top {
		return new Set<Element>([this._value]); // Simply fulfills identity property of Galois connection.
	}

	abstract(_concrete: ReadonlySet<Element> | typeof Top): this {
		return this.create(this._value); // Simply fulfills identity property of Galois connection.
	}
}