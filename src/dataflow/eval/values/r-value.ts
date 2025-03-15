import type { RNumberValue, RStringValue } from '../../../r-bridge/lang-4.x/convert-values';
import type { RLogicalValue } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { guard } from '../../../util/assert';

export const Top = { type: Symbol('⊤') };
export const Bottom = { type: Symbol('⊥') };

export type Lift<N> = N | typeof Top | typeof Bottom
export type Unlift<N> = N extends typeof Top ? never : N extends typeof Bottom ? never : N

export interface ValueInterval<Limit extends ValueNumber = ValueNumber> {
    type:           'interval'
    start:          Limit
    startInclusive: boolean
    end:            Limit
    endInclusive:   boolean
}
export interface ValueVector<Elements extends Lift<unknown[]> = Lift<Value[]>> {
    type:     'vector'
    elements: Elements
}
export interface ValueNumber<Num extends Lift<RNumberValue> = Lift<RNumberValue>> {
    type:  'number'
    value: Num
}
export interface ValueString<Str extends Lift<RStringValue> = Lift<RStringValue>> {
    type:  'string'
    value: Str
}
export type TernaryLogical = RLogicalValue | 'maybe'
export interface ValueLogical {
    type:  'logical'
    value: Lift<TernaryLogical>
}

export type Value = Lift<
        ValueInterval
        | ValueVector<Value[]>
        | ValueNumber
        | ValueString
        | ValueLogical
    >
export type ValueType<V> = V extends { type: infer T } ? T : never
export type ValueTypes = ValueType<Value>

export function typeOfValue<V extends Value>(value: V): V['type'] {
	return value.type;
}

// @ts-expect-error -- this is a save cast
export function isTop<V extends Lift<unknown>>(value: V): value is typeof Top {
	return value === Top;
}
// @ts-expect-error -- this is a save cast
export function isBottom<V extends Lift<unknown>>(value: V): value is typeof Bottom {
	return value === Bottom;
}

export function isValue<V extends Lift<unknown>>(value: V): value is Unlift<V> {
	return !isTop(value) && !isBottom(value);
}

export function asValue<V extends Lift<unknown>>(value: V): Unlift<V> {
	guard(isValue(value), 'Expected a value, but got a top or bottom value');
	return value;
}

function tryStringifyBoTop<V extends Lift<unknown>>(
	value: V,
	otherwise: (v: Unlift<V>) => string,
	onTop = () => '⊤',
	onBottom = () => '⊥'
): string {
	if(isTop(value)) {
		return onTop();
	} else if(isBottom(value)) {
		return onBottom();
	} else {
		return otherwise(value as Unlift<V>);
	}
}


function stringifyRNumberSuffix(value: RNumberValue): string {
	let suffix = '';
	if(value.markedAsInt) {
		suffix += 'L';
	}
	if(value.complexNumber) {
		suffix += 'i';
	}
	// do something about iL even though it is impossible?
	return suffix;
}

function renderString(value: RStringValue): string {
	const quote = value.quotes;
	const raw = value.flag === 'raw';
	if(raw) {
		return `r${quote}(${value.str})${quote}`;
	} else {
		return `${quote}${JSON.stringify(value.str).slice(1, -1)}${quote}`;
	}
}

export function stringifyValue(value: Lift<Value>): string {
	return tryStringifyBoTop(value, v => {
		switch(v.type) {
			case 'interval':
				return `${v.startInclusive ? '[' : '('}${stringifyValue(v.start)}, ${stringifyValue(v.end)}${v.endInclusive ? ']' : ')'}`;
			case 'vector':
				return tryStringifyBoTop(v.elements, e => {
					return `c(${e.map(stringifyValue).join(',')})`;
				}, () => '⊤ (vector)', () => '⊥ (vector)');
			case 'number':
				return tryStringifyBoTop(v.value,
					n => `${n.num}${stringifyRNumberSuffix(n)}`,
					() => '⊤ (number)', () => '⊥ (number)'
				);
			case 'string':
				return tryStringifyBoTop(v.value, renderString, () => '⊤ (string)', () => '⊥ (string)');
			case 'logical':
				return tryStringifyBoTop(v.value, l => l === 'maybe' ? 'maybe' : l ? 'TRUE' : 'FALSE',  () => '⊤ (logical)', () => '⊥ (logical)');
		}
	});
}