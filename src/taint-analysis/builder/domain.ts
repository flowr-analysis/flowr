import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import type { FiniteLatticeConfig } from '../finite-domain';
import { FiniteDomain } from '../finite-domain';

export class FiniteDomainBuilder<Element extends Top | Bottom | symbol, Top extends symbol, Bottom extends symbol> {
	private readonly elements: Set<Element> = new Set();
	private readonly leqMap:   Map<Element, Set<Element>> = new Map();
	private _top:              Top | undefined;
	private _bottom:           Bottom | undefined;

	constructor() {
		this.setTop(Top as Top);
		this.setBottom(Bottom as Bottom);
	}

	addElement(element: Element): this {
		this.elements.add(element);
		if(!this.leqMap.has(element)) {
			this.leqMap.set(element, new Set());
		}
		return this;
	}

	setTop(element: Top): this {
		this._top = element;
		this.addElement(element as Element);
		return this;
	}

	setBottom(element: Bottom): this {
		this._bottom = element;
		this.addElement(element as Element);
		return this;
	}

	addLeqOrder(from: Element, to: Element | Element[]): this {
		if(!this.elements.has(from)) {
			throw new Error(`Source element not registered: ${String(from)}`);
		}
		if(!Array.isArray(to)) {
			to = [to];
		}
		for(const t of to) {
			if(!this.elements.has(t)) {
				throw new Error(`Target element not registered: ${String(to)}`);
			}

			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const successors = this.leqMap.get(from)!;
			successors.add(t);
		}
		return this;
	}

	private buildConfig(): FiniteLatticeConfig<Element, Top, Bottom> {
		return {
			top:      this._top as Top,
			bottom:   this._bottom as Bottom,
			elements: new Set(this.elements),
			leq:      new Map(this.leqMap),
		};
	}

	build(initialElement?: Element): FiniteDomain<Element, Top, Bottom> {
		const config = this.buildConfig();
		return new FiniteDomain(initialElement ?? this._top as Element, config);
	}
}
