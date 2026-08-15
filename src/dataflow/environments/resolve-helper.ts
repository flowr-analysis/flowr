import { resolveByName, resolveByNameAnyType, resolvesToBuiltInConstant } from './resolve-by-name';
import { resolveIdToValue, resolveIdToSingleString, resolveToConstants } from '../eval/resolve/alias-tracking';
import {
	resolveIdToArgName,
	resolveIdToArgStringVector,
	resolveIdToArgValue,
	resolveIdToArgValueSymbolName,
	resolveIdToArgVectorLength
} from '../../abstract-interpretation/data-frame/resolve-args';

/**
 * The helper object for resolution: from a name to the definitions it may refer to, and from a node to the
 * value(s) it may hold. Reachable as {@link Dataflow.resolve} as well.
 *
 * Take the narrowest entry point that answers your question, they differ a lot in cost:
 *
 * - {@link Resolve.byName} walks the environment layers once and answers repeat questions from the layer's own
 *   lookup cache. Use it whenever the {@link ReferenceType} does not matter.
 * - {@link Resolve.byNameAndType} additionally filters and merges the definitions of every layer it passes.
 *   Given the unknown reference type it only forwards to {@link Resolve.byName}, so ask that one directly instead.
 * - {@link Resolve.toValue} and the {@link Resolve.argument} family run the evaluator on top of a resolution.
 * @example
 * ```ts
 * Resolve.byName('x', environment);          // every definition `x` may refer to
 * Resolve.toValue(id, { graph, ctx });       // the value(s) the node may hold
 * Resolve.argument.value(call, 'file', ...); // the value of a named argument
 * ```
 */
export const Resolve = {
	name:           'Resolve',
	/** Every definition the identifier may refer to, whatever its type. */
	byName:         resolveByNameAnyType,
	/** The definitions the identifier may refer to that fit the wanted {@link ReferenceType}. */
	byNameAndType:  resolveByName,
	/** Whether the name always, never, or maybe refers to a built-in constant of the given value. */
	toBuiltIn:      resolvesToBuiltInConstant,
	/** The constant values the name resolves to. */
	toConstants:    resolveToConstants,
	/** The value(s) the node may hold, tracking aliases as the configuration allows. */
	toValue:        resolveIdToValue,
	/** The single string the node resolves to, or `undefined` if it is not exactly one. */
	toSingleString: resolveIdToSingleString,
	/** The same, for the arguments of a call. */
	argument:       {
		name:         'argument',
		/** The argument's name. */
		toName:       resolveIdToArgName,
		/** The argument's value. */
		value:        resolveIdToArgValue,
		/** The argument's value as a vector of strings. */
		stringVector: resolveIdToArgStringVector,
		/** The argument's value as the name of the symbol it holds. */
		symbolName:   resolveIdToArgValueSymbolName,
		/** The length of the vector the argument holds. */
		vectorLength: resolveIdToArgVectorLength
	}
} as const;
