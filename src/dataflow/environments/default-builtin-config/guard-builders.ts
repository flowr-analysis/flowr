import { RValueType, type GuardFacts, type RCondition, type RFailure, type ReturnedValue, type RValueTypes } from '../guard-facts';
import type { BrandedIdentifier } from '../identifier';

/* the words the guard fact tables are written in */
export const Numeric = RValueType.Integer | RValueType.Double;
export const Atomic = RValueType.Logical | Numeric | RValueType.Complex | RValueType.Character | RValueType.Raw;

/** Condition that holds if all given predicates hold. */
export const is = (...predicates: readonly BrandedIdentifier[]): RCondition => predicates.length === 1 ? { is: predicates[0] } : { any: predicates.map(p => ({ is: p })) };
/** Condition that holds if none of the given predicates hold. */
export const not = (...predicates: readonly BrandedIdentifier[]): RCondition => ({ all: predicates.map(p => ({ not: { is: p } })) });
/** Condition that holds if any of the given conditions holds. */
export const any = (...conditions: readonly RCondition[]): RCondition => ({ any: conditions });
/** Condition that holds if all of the given conditions hold. */
export const all = (...conditions: readonly RCondition[]): RCondition => ({ all: conditions });
/** A failure with the given message that applies if the required condition holds. */
export const fail = (requires: RCondition, message: string, more: Omit<RFailure, 'requires' | 'message'> = {}): RFailure => ({ requires, message, ...more });
/** A list with a single failure, see {@link fail}. */
export const fails = (requires: RCondition, message: string, more: Omit<RFailure, 'requires' | 'message'> = {}): readonly RFailure[] => [fail(requires, message, more)];
/** what R fails on unless the value has a class attribute, which may bring a method of its own */
export const dispatched = (requires: RCondition, message: string): readonly RFailure[] => fails(requires, message, { dispatches: true });
export const Computes: GuardFacts = { computes: true };
/** Guard facts describing the types the function returns. */
export const Returns = (types: RValueTypes, more: Omit<ReturnedValue, 'types'> = {}): GuardFacts => ({ returns: { types, ...more } });
/** The same facts for each of the names. */
export const each = (facts: GuardFacts, ...names: readonly BrandedIdentifier[]): Record<BrandedIdentifier, GuardFacts> => Object.fromEntries(names.map(name => [name, facts]));
