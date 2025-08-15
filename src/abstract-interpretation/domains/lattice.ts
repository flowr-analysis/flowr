export const Top = Symbol('top');
export const Bottom = Symbol('bottom');

export interface Lattice<Value, Top = typeof Top, Bot = typeof Bottom, Lift extends Value | Top | Bot = Value | Top | Bot> {
	get value(): Lift;

	top(): Lattice<Value, Top, Bot, Top>;

	bottom(): Lattice<Value, Top, Bot, Bot>;

	equals(other: Lattice<Value, Top, Bot>): boolean;

	leq(other: Lattice<Value, Top, Bot>): boolean;

	join(...values: Lattice<Value, Top, Bot>[]): Lattice<Value, Top, Bot>;

	meet(...values: Lattice<Value, Top, Bot>[]): Lattice<Value, Top, Bot>;

	toString(): string;

	isTop(): this is Lattice<Value, Top, Bot, Top>;

	isBottom(): this is Lattice<Value, Top, Bot, Bot>;

	isValue(): this is Lattice<Value, Top, Bot, Value>;
}
