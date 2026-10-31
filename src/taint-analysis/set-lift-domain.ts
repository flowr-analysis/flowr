import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { FiniteDomain, LatticeElements } from './finite-domain';

export class SetLiftDomain<
	Top extends symbol,
	Bottom extends symbol,
	Elements extends LatticeElements<Top, Bottom>
> extends AbstractDomain<
		ReadonlySet<Elements[number]>,
		ReadonlySet<Elements[number]>,
		ReadonlySet<Elements[number]>,
		ReadonlySet<Elements[number]>
	> {
	constructor(
		private readonly base: FiniteDomain<Top, Bottom, Elements>,
		value: ReadonlySet<Elements[number]> = new Set()
	) {
		super(value);
	}
	public create(value: ReadonlySet<Elements[number]>): this {
		return new SetLiftDomain<Top, Bottom, Elements>(this.base, value) as this;
	}
	public top(): this & AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>> {
		return this.create(new Set([this.base.baseTop.value]));
	}
	public bottom(): this & AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>> {
		return this.create(new Set([this.base.baseBottom.value]));
	}
	protected equalsValue(this: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>, other: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>): boolean {
		throw new Error('Method not implemented.');
	}
	protected leqValue(this: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>, other: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>): boolean {
		throw new Error('Method not implemented.');
	}
	protected joinValue(this: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>, other: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>): this {
		throw new Error('Method not implemented.');
	}
	protected meetValue(this: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>, other: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>): this {
		throw new Error('Method not implemented.');
	}
	protected jsonify(this: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>): unknown {
		return [...this.value].reduce( // just a draft dont know if this makes sense yet
			(acc, value) => acc.concat(value.description ?? value.toString()),
			''
		);
	}
	protected stringify(this: AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>>): string {
		return [...this.value].reduce( // just a draft dont know if this makes sense yet
			(acc, value) => acc.concat(value.description ?? value.toString()),
			''
		);
	}
	public isTop(): this is this & AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>> {
		throw new Error('Method not implemented.');
	}
	public isBottom(): this is this & AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>> {
		throw new Error('Method not implemented.');
	}
	public isValue(): this is this & AbstractDomain<ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>, ReadonlySet<Elements[number]>> {
		throw new Error('Method not implemented.');
	}
}