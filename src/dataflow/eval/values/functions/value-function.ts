import type { Value, ValueTypes } from '../r-value';
import { Top , stringifyValue } from '../r-value';


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
    readonly canApply:    (args: readonly ValueArgument[], fname: string) => boolean;
    /**
     * Apply the function to the given arguments.
     * You may assume that `canApply` holds.
     */
    readonly apply:       (args: readonly ValueArgument[], fname: string) => Value;
}

export function requiresSignature(
	...types: ValueTypes[]
): (args: readonly Value[]) => boolean {
	return args => args.length === types.length && args.every((a, i) => a.type === types[i]);
}

export function isOfEitherType(
	v: Value,
	...orTypes: readonly Value['type'][]
): boolean {
	return orTypes.some(t => v.type === t);
}

export type ValueArgument<Name = string | undefined, V = Value> = [Name, V];

export function stringifyValueArgument(
	[a, v]: ValueArgument
): string {
	return `${a ? a + '=' : ''}${stringifyValue(v)}`;
}

export function getArgument(
	args: readonly ValueArgument[],
	from: {
        position: number,
        name?:    string
    }
): Value {
	if(from.name) {
		return args.find(([name]) => name === from.name)?.[1] ?? args[from.position]?.[1] ?? Top;
	} else {
		return args[from.position]?.[1] ?? Top;
	}
}