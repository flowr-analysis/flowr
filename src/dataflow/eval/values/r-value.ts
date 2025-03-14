import type { RNumberValue, RStringValue } from '../../../r-bridge/lang-4.x/convert-values';
import type { RLogicalValue } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';

export const Top = { type: Symbol('⊤') };
export const Bottom = { type: Symbol('⊥') };

export type Lift<N> = N | typeof Top | typeof Bottom

export interface ValueInterval<Limit extends ValueNumber = ValueNumber> {
    type:           'interval'
    start:          Lift<Limit>
    startInclusive: boolean
    end:            Lift<Limit>
    endInclusive:   boolean
}
export interface ValueSet<Elements extends unknown[]> {
    type:     'set'
    elements: Lift<Elements>
}
export interface ValueVector<Elements extends unknown[]> {
    type:     'vector'
    elements: Lift<Elements>
}
export interface ValueNumber<Num extends RNumberValue = RNumberValue> {
    type:  'number'
    value: Lift<Num>
}
export interface ValueString<Str extends RStringValue = RStringValue> {
    type:  'string'
    value: Lift<Str>
}
export type TernaryLogical = RLogicalValue | 'maybe'
export interface ValueLogical {
    type:  'logical'
    value: Lift<TernaryLogical>
}

export type Value = Lift<
        ValueInterval
        | ValueSet<Value[]>
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
	return typeof value === 'object' && value !== null && 'type' in value && value.type === Top.type;
}
// @ts-expect-error -- this is a save cast
export function isBottom<V extends Lift<unknown>>(value: V): value is typeof Bottom {
	return typeof value === 'object' && value !== null && 'type' in value && value.type === Bottom.type;
}

