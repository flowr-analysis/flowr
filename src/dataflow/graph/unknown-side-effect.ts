import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { DataflowGraph } from './graph';

export type UnknownSideEffectHandler = (graph: DataflowGraph, env: REnvironmentInformation, id: NodeId, target?: LinkTo<RegExp | string>) => void;

const handlers: UnknownSideEffectHandler[] = [];

/**
 * Globally registers a handler for unknown side effects.
 * @see {@link handleUnknownSideEffect} for triggering the handlers.
 */
export function onUnknownSideEffect(handler: UnknownSideEffectHandler) {
	handlers.push(handler);
}

/**
 * Handles an unknown side effect occurring at the given node in the dataflow graph.
 * @see {@link onUnknownSideEffect} for registering handlers.
 */
export function handleUnknownSideEffect(graph: DataflowGraph, env: REnvironmentInformation, id: NodeId, target?: LinkTo<RegExp | string>) {
	graph.markIdForUnknownSideEffects(id, target);
	for(const handler of handlers) {
		handler(graph, env, id, target);
	}
}
