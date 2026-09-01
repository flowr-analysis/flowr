import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Identifier } from '../environments/identifier';

/** Classes an error carries (`stop` raises a `simpleError`); a `warning`/`message`/`interrupt` names none of them. */
export const ErrorConditionClasses: ReadonlySet<string> = new Set(['error', 'simpleError', 'condition']);

/** Whether the arguments written for a condition-handling call name a handler catching an error (matched by name). */
export function namesAnErrorHandler<Info>(args: readonly PotentiallyEmptyRArgument<Info>[]): boolean {
	return args.some(a => RArgument.isNamed(a) && ErrorConditionClasses.has(Identifier.getName(a.name.content)));
}
