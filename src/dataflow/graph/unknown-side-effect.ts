import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { DataflowGraph } from './graph';

export type UnknownSideEffectHandler = (graph: DataflowGraph, env: REnvironmentInformation, id: NodeId, target?: LinkTo<RegExp | string>) => void;

const handlers: UnknownSideEffectHandler[] = [];


/**
 *
 */
export function onUnknownSideEffect(handler: UnknownSideEffectHandler) {
	handlers.push(handler);
}


/**
 *
 */
export function handleUnknownSideEffect(graph: DataflowGraph, env: REnvironmentInformation, id: NodeId, target?: LinkTo<RegExp | string>) {
	graph.markIdForUnknownSideEffects(id, target);
	handlers.forEach(handler => handler(graph, env, id, target));
}
