import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import type { FiniteLatticeConfig, LatticeElements } from '../finite-domain';
import { FiniteDomain } from '../finite-domain';
import { guard } from '../../util/assert';

export class FiniteDomainBuilder<Top extends symbol, Bottom extends symbol, Elements extends LatticeElements<Top, Bottom> = [Top, Bottom]> {
	private readonly elements: Set<Elements[number]> = new Set();
	private readonly leqMap:   Map<Elements[number], Set<Elements[number]>> = new Map();
	private _top:              Top | undefined;
	private _bottom:           Bottom | undefined;

	private addElements(...elements: Elements[number][]) {
		for(const element of elements) {
			if(!this.elements.has(element)) {
				this.elements.add(element);
			}
			if(!this.leqMap.has(element)) {
				this.leqMap.set(element, new Set());
			}
		}
	}

	setTop(element: Top): this {
		this._top = element;
		this.addElements(element as Elements[number]);
		return this;
	}

	setBottom(element: Bottom): this {
		this._bottom = element;
		this.addElements(element as Elements[number]);
		return this;
	}

	addLeqOrder(from: Elements[number], to: Elements[number] | Elements[number][]): this {
		this.addElements(from, ...(Array.isArray(to) ? to : [to]));

		if(!this.elements.has(from)) {
			throw new Error(`Source element not registered: ${String(from)}`);
		}
		if(!Array.isArray(to)) {
			to = [to];
		}

		const successors = this.leqMap.get(from);
		guard(successors, 'Internal error: A successor set should always exist');

		for(const t of to) {
			if(!this.elements.has(t)) {
				throw new Error(`Target element not registered: ${String(t)}`);
			}

			successors.add(t);
		}
		return this;
	}

	private buildConfig(): FiniteLatticeConfig<Top, Bottom, Elements> {
		if(!this._top) {
			this.setTop(Top as Top);
		}

		if(!this._bottom) {
			this.setBottom(Bottom as Bottom);
		}

		return {
			top:      this._top as Top,
			bottom:   this._bottom as Bottom,
			elements: new Set(this.elements),
			leq:      new Map(this.leqMap),
		};
	}

	build(initialElement?: Elements[number]): FiniteDomain<Top, Bottom, Elements> {
		return new FiniteDomain(initialElement ?? this._top as Elements[number], this.buildConfig());
	}
}
