import type { RNumberValue, RStringValue } from '../../../r-bridge/lang-4.x/convert-values';
import type { RLogicalValue } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { assertUnreachable, guard } from '../../../util/assert';

export const Top = { type: Symbol('⊤') };
export const Bottom = { type: Symbol('⊥') };

export type Lift<N> = N | typeof Top | typeof Bottom;
export type Unlift<N> = N extends typeof Top ? never : N extends typeof Bottom ? never : N;

export interface ValueInterval<Limit extends ValueNumber = ValueNumber> {
	type:           'interval'
	start:          Limit
	startInclusive: boolean
	end:            Limit
	endInclusive:   boolean
}

/**
 * An R vector with either a known set of elements or a known domain.
 */
export interface ValueVector<Elements extends Lift<unknown[]> = Lift<Value[]>, Domain extends Lift<Value> = Lift<Value>> {
	type:          'vector'
	elements:      Elements
	/** if we do not know the amount of elements, we can still know the domain */
	elementDomain: Domain
}
/** describes the static case of we do not know which value */
export interface ValueSet<Elements extends Lift<unknown[]> = Lift<Value[]>> {
	type:     'set'
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
export interface ValueFunctionDefinition {
	type: 'function-definition'
}
export interface ValueMissing {
	type: 'missing'
}
export type TernaryLogical = RLogicalValue | 'maybe';
export interface ValueLogical {
	type:  'logical'
	value: Lift<TernaryLogical>
}

export type Value = Lift<
        ValueInterval
		| ValueVector
        | ValueSet
        | ValueNumber
        | ValueString
        | ValueLogical
		| ValueMissing
        | ValueFunctionDefinition
>;
export type ValueType<V> = V extends { type: infer T } ? T : never;
export type ValueTypes = ValueType<Value>;


/**
 *
 */
export function typeOfValue<V extends Value>(value: V): V['type'] {
	return value.type;
}

/** Checks whether the given value is the top value */
// @ts-expect-error -- this is a save cast
export function isTop<V extends Lift<unknown>>(value: V): value is typeof Top {
	return value === Top;
}
/** Checks whether the given value is the bottom value */
// @ts-expect-error -- this is a save cast
export function isBottom<V extends Lift<unknown>>(value: V): value is typeof Bottom {
	return value === Bottom;
}

/** Checks whether the given value is a proper value (neither top nor bottom) */
export function isValue<V extends Lift<unknown>>(value: V): value is Unlift<V> {
	return !isTop(value) && !isBottom(value);
}

/**
 * Treat a value as unlifted value, throws if it is top or bottom.
 */
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


/**
 *
 */
export function stringifyValue(value: Lift<Value>): string {
	return tryStringifyBoTop(value, v => {
		const t = v.type;
		switch(t) {
			case 'interval':
				return `${v.startInclusive ? '[' : '('}${stringifyValue(v.start)}, ${stringifyValue(v.end)}${v.endInclusive ? ']' : ')'}`;
			case 'vector':
				return tryStringifyBoTop(v.elements, e => {
					return `<${stringifyValue(v.elementDomain)}> c(${e.map(stringifyValue).join(',')})`;
				}, () => `⊤ (vector, ${stringifyValue(v.elementDomain)})`, () => `⊥ (vector, ${stringifyValue(v.elementDomain)})`);
			case 'set':
				return tryStringifyBoTop(v.elements, e => {
					return e.length === 1 ? stringifyValue(e[0]) : `{ ${e.map(stringifyValue).join(',')} }`;
				}, () => '⊤ (set)', () => '⊥ (set)');
			case 'number':
				return tryStringifyBoTop(v.value,
					n => `${n.num}${stringifyRNumberSuffix(n)}`,
					() => '⊤ (number)', () => '⊥ (number)'
				);
			case 'string':
				return tryStringifyBoTop(v.value, renderString, () => '⊤ (string)', () => '⊥ (string)');
			case 'logical':
				return tryStringifyBoTop(v.value, l => l === 'maybe' ? 'maybe' : l ? 'TRUE' : 'FALSE',  () => '⊤ (logical)', () => '⊥ (logical)');
			case 'missing':
				return '(missing)';
			case 'function-definition':
				return 'fn-def';
			default:
				assertUnreachable(t);
		}
	});
}