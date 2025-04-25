import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from './graph';

export type UnknownSideEffectHandler = (graph: DataflowGraph, id: NodeId) => void;

const handlers: UnknownSideEffectHandler[] = [];

export function onUnknownSideEffect(handler: UnknownSideEffectHandler) {
	handlers.push(handler);
}

export function handleUnknownSideEffect(graph: DataflowGraph, id: NodeId, target?: LinkTo<RegExp | string>) {
	graph.markIdForUnknownSideEffects(id, target);
	handlers.forEach(handler => handler(graph, id));
}
