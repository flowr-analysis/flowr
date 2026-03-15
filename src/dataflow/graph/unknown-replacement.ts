import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { Identifier } from '../environments/identifier';

export type ReplacementOperatorHandlerArgs = {
	operator: Identifier,
	target:   string | undefined,
	env:      REnvironmentInformation,
	id:       NodeId
};
export type ReplacementOperatorHandler = (args: ReplacementOperatorHandlerArgs) => void;

const handlers: ReplacementOperatorHandler[] = [];

/**
 * Register a new (global) handler for replacement operators.
 * @see {@link handleReplacementOperator}
 */
export function onReplacementOperator(handler: ReplacementOperatorHandler) {
	handlers.push(handler);
}

/**
 * Handle a replacement operator by calling all registered handlers.
 * @see {@link onReplacementOperator}
 */
export function handleReplacementOperator(args: ReplacementOperatorHandlerArgs) {
	handlers.forEach(handler => handler(args));
}
