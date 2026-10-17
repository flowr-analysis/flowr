import type { DeepReadonly } from 'ts-essentials';
import type { RNode } from '../model';
import { type StatefulFoldFunctions, foldAstStateful } from './stateful-fold';

export type FoldFunctions<Info, Out> = Omit<StatefulFoldFunctions<Info, undefined, Out>, 'down'>;

function down() {
	return undefined;
}

/**
 * Folds in old functional-fashion over the AST structure.
 * <p>
 * Internally implemented as a special case of a two-way fold (with the down part as an essential no-op)
 */
export function foldAst<Info, T>(ast: RNode<Info>, folds: DeepReadonly<FoldFunctions<Info, T>>): T {
	return foldAstStateful(ast, undefined, Object.assign(folds, { down }));
}

