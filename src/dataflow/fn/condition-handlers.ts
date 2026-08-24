import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Identifier } from '../environments/identifier';

/**
 * The classes an error carries, which is what a handler has to be named to catch it: `stop` raises a
 * `simpleError`, whose classes are `simpleError`, `error` and `condition`. A `warning`, `message`, `interrupt`
 * or a class of the caller's own names none of them, and `finally` never catches.
 */
export const ErrorConditionClasses: ReadonlySet<string> = new Set(['error', 'simpleError', 'condition']);

/**
 * Whether the arguments written for a condition-handling call name a handler catching an error. Handlers are
 * matched by the class of the condition, so only the name each is written under decides.
 */
export function namesAnErrorHandler<Info>(args: readonly PotentiallyEmptyRArgument<Info>[]): boolean {
	return args.some(a => RArgument.isNamed(a) && ErrorConditionClasses.has(Identifier.getName(a.name.content)));
}
