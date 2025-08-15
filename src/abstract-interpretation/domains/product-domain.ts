import { DEFAULT_INFERENCE_LIMIT, type AbstractDomain } from './abstract-domain';
import { Top } from './lattice';

type ConcreteProduct<Product extends Record<string, AbstractDomain<unknown, unknown, unknown, unknown>>> = {
	[Key in keyof Product]: Product[Key] extends AbstractDomain<infer Concrete, unknown, unknown, unknown> ? Concrete : never;
};
type AbstractProduct = Record<string, AbstractDomain<unknown, unknown, unknown, unknown>>;

export abstract class ProductDomain<Product extends AbstractProduct>
implements AbstractDomain<ConcreteProduct<Product>, Product, Product, Product> {
	private _value: Product;

	constructor(value: Product) {
		this._value = value;
	}

	public abstract create(value: Product): ProductDomain<Product>;

	public get value(): Product {
		return this._value;
	}

	public bottom(): ProductDomain<Product> {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].bottom() as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public top(): ProductDomain<Product> {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] =  result.value[key].top() as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public equals(other: ProductDomain<Product>): boolean {
		if(this.value === other.value) {
			return true;
		}
		for(const key in this.value) {
			if(!this.value[key].equals(other.value[key])) {
				return false;
			}
		}
		return true;
	}

	public leq(other: ProductDomain<Product>): boolean {
		if(this.value === other.value) {
			return true;
		}
		for(const key in this.value) {
			if(!this.value[key].leq(other.value[key])) {
				return false;
			}
		}
		return true;
	}

	public join(...values: ProductDomain<Product>[]): ProductDomain<Product> {
		const result = this.create(this.value);

		for(const value of values) {
			for(const key in result.value) {
				result._value[key] = result.value[key].join(value.value[key]) as Product[Extract<keyof Product, string>];
			}
		}
		return result;
	}

	public meet(...values: ProductDomain<Product>[]): ProductDomain<Product> {
		const result = this.create(this.value);

		for(const value of values) {
			for(const key in result.value) {
				result._value[key] = result.value[key].meet(value.value[key]) as Product[Extract<keyof Product, string>];
			}
		}
		return result;
	}

	public widen(other: ProductDomain<Product>): ProductDomain<Product> {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].widen(other.value[key]) as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public narrow(other: ProductDomain<Product>): ProductDomain<Product> {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].narrow(other.value[key]) as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<ConcreteProduct<Product>> | typeof Top {
		let result = new Set<ConcreteProduct<Product>>();

		for(const key in this.value) {
			const concrete = this.value[key].concretize(limit);

			if(concrete === Top) {
				return Top;
			}
			const newResult = new Set<ConcreteProduct<Product>>();

			for(const value of concrete) {
				for(const entry of result) {
					if(newResult.size >= limit) {
						return Top;
					}
					newResult.add({ ...entry, [key]: value });
				}
			}
			result = newResult;
		}
		return result;
	}

	public abstract(concrete: ReadonlySet<ConcreteProduct<Product>> | typeof Top): ProductDomain<Product> {
		if(concrete === Top) {
			return this.top();
		}
		const result = this.create(this.value);

		for(const key in result.value) {
			const concreteValues = new Set(concrete.values().map(value => value[key]));
			result._value[key] = result.value[key].abstract(concreteValues) as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public toString(): string {
		return '(' + Object.entries<AbstractDomain<unknown, unknown, unknown, unknown>>(this.value).map(([key, value]) => `${key}: ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is ProductDomain<Product> {
		return Object.values<AbstractDomain<unknown, unknown, unknown, unknown>>(this.value).every(value => value.isTop());
	}

	public isBottom(): this is ProductDomain<Product> {
		return Object.values<AbstractDomain<unknown, unknown, unknown, unknown>>(this.value).every(value => value.isBottom());
	}

	public isValue(): this is ProductDomain<Product> {
		return true;
	}
}
