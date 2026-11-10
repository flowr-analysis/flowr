import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { type BrandedIdentifier, Identifier } from '../environments/identifier';

/** Classes an error carries (`stop` raises a `simpleError`); a `warning`/`message`/`interrupt` names none of them. */
export const ErrorConditionClasses: ReadonlySet<BrandedIdentifier> = new Set(['error', 'simpleError', 'condition']);

/** Whether the arguments written for a condition-handling call name a handler catching an error (matched by name). */
export function namesAnErrorHandler<Info>(args: readonly PotentiallyEmptyRArgument<Info>[]): boolean {
	return args.some(a => RArgument.isNamed(a) && ErrorConditionClasses.has(Identifier.getName(a.name.content)));
}

/** Classes the session signals on its own (a user interrupt) rather than the code, so a handler of them catches no error the code raises. */
export const SessionConditionClasses: ReadonlySet<BrandedIdentifier> = new Set(['interrupt']);
