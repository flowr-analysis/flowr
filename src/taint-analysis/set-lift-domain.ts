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

	protected equalsValue(this: SetLiftDomain<Top, Bottom, Elements>, other: SetLiftDomain<Top, Bottom, Elements>): boolean {
		return this.value.size === other.value.size
			&& this.value.symmetricDifference(other.value).size === 0;
	}

	protected leqValue(this: SetLiftDomain<Top, Bottom, Elements>, _other: SetLiftDomain<Top, Bottom, Elements>): boolean {
		throw new Error('Method not implemented.');
	}

	protected joinValue(this: SetLiftDomain<Top, Bottom, Elements>, _other: SetLiftDomain<Top, Bottom, Elements>): this {
		throw new Error('Method not implemented.');
	}

	protected meetValue(this: SetLiftDomain<Top, Bottom, Elements>, _other: SetLiftDomain<Top, Bottom, Elements>): this {
		throw new Error('Method not implemented.');
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

	private isFullSet(value: ReadonlySet<Elements[number]>): boolean {
		const elements = this.base.domain;
		return value.size === elements.size
			&& [...elements].every(element => value.has(element));
	}

	private isSingletonEqual(element: Elements[number]): boolean {
		return this.value.size === 1 && this.value.has(element);
	}

	narrow(other: this): this {
		return this.meet(other); //same behaviour as FiniteDomain
	}

	widen(other: this): this {
		return this.join(other); //same behaviour as FiniteDomain
	}
}