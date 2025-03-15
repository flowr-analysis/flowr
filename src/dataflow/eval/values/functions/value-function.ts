import type { Value, ValueTypes } from '../r-value';

export interface ValueFunctionDescription {
    /**
     * A human-readable description of what the function is about to do
     */
    readonly description: string;
    /**
     * A check whether this function overload is applicable to the given arguments
     * This must not have any side effects on the values.
     *
     * @see requiresSignature - a helper function to check the types of the arguments
     */
    readonly canApply:    (args: readonly Value[]) => boolean;
    /**
     * Apply the function to the given arguments.
     * You may assume that `canApply` holds.
     */
    readonly apply:       (args: readonly Value[]) => Value;
}

export function requiresSignature(
	...types: ValueTypes[]
): (args: readonly Value[]) => boolean {
	return args => args.length === types.length && args.every((a, i) => a.type === types[i]);
}

export function isOfEitherType<T extends Value>(
	v: Value,
	...orTypes: readonly Value['type'][]
): boolean {
	return orTypes.some(t => v.type === t);
}