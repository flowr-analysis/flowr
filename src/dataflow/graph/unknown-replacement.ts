import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';

export type ReplacementOperatorHandlerArgs = {
    operator: string,
    target:   string | undefined,
    env:      REnvironmentInformation, 
    id:       NodeId
}
export type ReplacementOperatorHandler = (args: ReplacementOperatorHandlerArgs) => void;

const handlers: ReplacementOperatorHandler[] = [];

export function onReplacementOperator(handler: ReplacementOperatorHandler) {
	handlers.push(handler);
}

export function handleReplacementOperator(args: ReplacementOperatorHandlerArgs) {
	handlers.forEach(handler => handler(args));
}
