import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from '../abstract-interpretation/domains/lattice';

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
		const thisSuccessors = this._config.leq.get(this.value) ?? new Set();
		const otherSuccessors = this._config.leq.get(other.value) ?? new Set();

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
				const candidateSuccessors = this._config.leq.get(candidate) ?? new Set();
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

	private findGreatestLowerBound(_other: this): this {
		return this; // TODO
	}

	leq(other: this): boolean {
		if(this.value === this._config.bottom) {
			return true;
		}
		if(this.value === this._config.top) {
			return other.value === this._config.bottom;
		}
		if(other.value === this._config.top) {
			return true;
		}
		if(other.value === this._config.bottom) {
			return false;
		}
		const successors = this._config.leq.get(this.value);
		return successors?.has(other.value) ?? false;
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

	isValue(): this is AbstractDomain<Element, Element, Top, Bot, Element> {
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
		throw new Error('Method not implemented.');
	}

	abstract(_concrete: ReadonlySet<Element> | typeof Top): this {
		throw new Error('Method not implemented.');
	}
}