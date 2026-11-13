import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { FiniteDomain, LatticeElements } from './finite-domain';

export type SetLiftValue<E> = ReadonlySet<E>;
export type SetLiftTop<E> = ReadonlySet<E>;
export type SetLiftBottom<E> = ReadonlySet<E>;
export class SetLiftDomain<
	Top extends symbol,
	Bottom extends symbol,
	Elements extends LatticeElements<Top, Bottom>
> extends AbstractDomain<
		SetLiftValue<Elements[number]>,
		SetLiftTop<Elements[number]>,
		SetLiftBottom<Elements[number]>,
	SetLiftValue<Elements[number]> | SetLiftTop<Elements[number]> | SetLiftBottom<Elements[number]>
	> {
	constructor(
		private readonly base: FiniteDomain<Top, Bottom, Elements>,
		value: Elements[number] | SetLiftValue<Elements[number]> = new Set()
	) {
		const lifted: SetLiftValue<Elements[number]> =
			typeof value === 'symbol'
				? new Set([value])
				: value;

		super(lifted);
	}

	create(value: SetLiftValue<Elements[number]> | SetLiftTop<Elements[number]> | SetLiftBottom<Elements[number]>): this {
		return new SetLiftDomain<Top, Bottom, Elements>(this.base, value) as this;
	}

	top(): this & AbstractDomain<SetLiftValue<Elements[number]>, SetLiftTop<Elements[number]>, SetLiftBottom<Elements[number]>, SetLiftTop<Elements[number]>> {
		return this.create(new Set([this.base.baseTop.value]));
	}

	bottom(): this & AbstractDomain<SetLiftValue<Elements[number]>, SetLiftTop<Elements[number]>, SetLiftBottom<Elements[number]>, SetLiftBottom<Elements[number]>> {
		return this.create(new Set([this.base.baseBottom.value]));
	}

	public equalsValue(this: SetLiftDomain<Top, Bottom, Elements>, other: SetLiftDomain<Top, Bottom, Elements>): boolean {
		return this.value.size === other.value.size
			&& this.value.symmetricDifference(other.value).size === 0;
	}

	protected leqValue(
		this: SetLiftDomain<Top, Bottom, Elements>,
		other: SetLiftDomain<Top, Bottom, Elements>
	): boolean {
		return this.reduce(this.value).isSubsetOf(this.reduce(other.value));
	}

	protected joinValue(this: SetLiftDomain<Top, Bottom, Elements>, other: SetLiftDomain<Top, Bottom, Elements>): this {
		const union = this.value.union(other.value);
		const reducedUnion = this.reduce(union);
		return this.create(this.collapseSet(reducedUnion)) as this;
	}

	protected meetValue(this: SetLiftDomain<Top, Bottom, Elements>, other: SetLiftDomain<Top, Bottom, Elements>): this {
		const reducedIntersection = this.reduce(this.value).intersection(this.reduce(other.value));
		return this.create(this.collapseSet(reducedIntersection)) as this;
	}

	protected jsonify(): unknown {
		return [...this.value].reduce( // just a draft dont know if this makes sense yet
			(acc, value) => acc.concat(value.description ?? value.toString()),
			''
		);
	}

	protected stringify(): string {
		return [...this.value].reduce( // just a draft dont know if this makes sense yet
			(acc, value) => acc.concat(value.description ?? value.toString()),
			''
		);
	}

	isTop(): this is this & AbstractDomain<SetLiftValue<Elements[number]>, SetLiftTop<Elements[number]>, SetLiftBottom<Elements[number]>, SetLiftTop<Elements[number]>> {
		return this.isSingletonEqual(this.base.baseTop.value) || this.isFullSet(this.value);
	}

	isBottom(): this is this & AbstractDomain<SetLiftValue<Elements[number]>, SetLiftTop<Elements[number]>, SetLiftBottom<Elements[number]>, SetLiftBottom<Elements[number]>> {
		return this.isSingletonEqual(this.base.baseBottom.value) || this.value.size === 0;
	}

	isValue(): this is this & AbstractDomain<SetLiftValue<Elements[number]>, SetLiftTop<Elements[number]>, SetLiftBottom<Elements[number]>, SetLiftValue<Elements[number]>> {
		// return !this.isBottom() && !this.isTop(); //Linter does not like this
		// return !(this.isSingletonEqual(this.base.baseBottom.value) || this.value.size === 0)
		// && !(this.isSingletonEqual(this.base.baseTop.value) || this.isFullSet(this.value));
		return this.value.size > 0 // less readable but will short circuit faster - another option would be to put bot and top checks in seperate helper functions and calling them in isBottom, isTop and (negated) isValue
			&& !this.isSingletonEqual(this.base.baseBottom.value)
			&& !this.isSingletonEqual(this.base.baseTop.value)
			&& !this.isFullSet(this.value);
	}

	narrow(other: this): this {
		return this.meet(other); //same behaviour as FiniteDomain
	}

	widen(other: this): this {
		return this.join(other); //same behaviour as FiniteDomain
	}

	private isFullSet(elements: ReadonlySet<Elements[number]>): boolean {
		const domain = this.base.domain;
		return elements.size === domain.size
			&& [...domain].every(element => elements.has(element));
	}

	private isSingletonEqual(element: Elements[number]): boolean {
		return this.value.size === 1 && this.value.has(element);
	}


	public reduce(elements: ReadonlySet<Elements[number]>): ReadonlySet<Elements[number]> {
		return new Set(
			[...elements].flatMap(element =>
				this.isLowestRow(element)
					? [element]
					: [...this.reduce(this.base.predecessors(element))]
			)
		);
	}

	private isLowestRow(element: Elements[number]): boolean {
		return this.base.baseBottom.value !== element
			&& (this.base.successors(this.base.baseBottom.value)?.has(element) ?? false);
	}

	private collapseSet(
		elements: ReadonlySet<Elements[number]>
	): ReadonlySet<Elements[number]> {
		let current = new Set(elements);

		while(true) {
			const values = [...current];
			const toDelete = new Set<Elements[number]>();
			const toAdd = new Set<Elements[number]>();

			for(let i = 0; i < values.length; i++) {
				for(let j = i + 1; j < values.length; j++) {
					const left = values[i];
					const right = values[j];

					const joined = this.base.create(left).join(right);

					if(joined.value !== this.base.baseTop.value) {
						toDelete.add(left);
						toDelete.add(right);
						toAdd.add(joined.value);
					}
				}
			}
			if(toDelete.size === 0) {
				return current;
			}
			let next = new Set(current);
			next = next.difference(toDelete).union(toAdd);
			current = next;
		}
	}
}