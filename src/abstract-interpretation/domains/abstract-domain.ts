export const Top = Symbol('top');
export const Bottom = Symbol('bottom');

export interface AbstractDomain<Value, Top = typeof Top, Bot = typeof Bottom, Lift extends Value | Top | Bot = Value | Top | Bot> {
	get value(): Lift;

	top(): AbstractDomain<Value, Top, Bot, Top>;

	bottom(): AbstractDomain<Value, Top, Bot, Bot>;

	equals(other: AbstractDomain<Value, Top, Bot>): boolean;

	leq(other: AbstractDomain<Value, Top, Bot>): boolean;

	join(...values: AbstractDomain<Value, Top, Bot>[]): AbstractDomain<Value, Top, Bot>;

	meet(...values: AbstractDomain<Value, Top, Bot>[]): AbstractDomain<Value, Top, Bot>;

	widen(other: AbstractDomain<Value, Top, Bot>): AbstractDomain<Value, Top, Bot>;

	toString(): string;

	isTop(): this is AbstractDomain<Value, Top, Bot, Top>;

	isBottom(): this is AbstractDomain<Value, Top, Bot, Bot>;

	isValue(): this is AbstractDomain<Value, Top, Bot, Value>;
}
