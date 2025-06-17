import type { AbstractDomain } from './abstract-domain';

export abstract class ProductDomain<Product extends Record<string, AbstractDomain<unknown, unknown, unknown>>>
implements AbstractDomain<Product, Product, Product> {
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
			result._value[key] =  result.value[key].bottom() as Product[Extract<keyof Product, string>];
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

	public toString(): string {
		return '(' + Object.entries<AbstractDomain<unknown>>(this.value).map(([key, value]) => `${key}: ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is ProductDomain<Product> {
		return Object.values<AbstractDomain<unknown>>(this.value).every(value => value.isTop());
	}

	public isBottom(): this is ProductDomain<Product> {
		return Object.values<AbstractDomain<unknown>>(this.value).every(value => value.isBottom());
	}

	public isValue(): this is ProductDomain<Product> {
		return !this.isTop() && !(this as ProductDomain<Product>).isBottom();
	}
}
