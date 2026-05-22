import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import type { FiniteLatticeConfig } from '../finite-domain';
import { FiniteDomain } from '../finite-domain';
import { guard } from '../../util/assert';

export class FiniteDomainBuilder<Element extends Top | Bottom | symbol, Top extends symbol, Bottom extends symbol> {
	private readonly elements: Set<Element> = new Set();
	private readonly leqMap:   Map<Element, Set<Element>> = new Map();
	private _top:              Top | undefined;
	private _bottom:           Bottom | undefined;

	addElements(...elements: Element[]): this {
		for(const element of elements) {
			this.elements.add(element);
			if(!this.leqMap.has(element)) {
				this.leqMap.set(element, new Set());
			}
		}
		return this;
	}

	setTop(element: Top): this {
		this._top = element;
		this.addElements(element as Element);
		return this;
	}

	setBottom(element: Bottom): this {
		this._bottom = element;
		this.addElements(element as Element);
		return this;
	}

	addLeqOrder(from: Element, to: Element | Element[]): this {
		if(from === Bottom) {
			this.addElements(Bottom as Element);
		}
		if(to === Top) {
			this.addElements(Top as Element);
		}

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

	private buildConfig(): FiniteLatticeConfig<Element, Top, Bottom> {
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

	build(initialElement?: Element): FiniteDomain<Element, Top, Bottom> {
		return new FiniteDomain(initialElement ?? this._top as Element, this.buildConfig());
	}
}
