import { DeepReadonly } from "ts-essentials"
import { RNode } from '../model'
import { foldAstTwoWay, TwoWayFoldFunctions } from './twoWayFold'

export type FoldFunctions<Info, T> = Omit<TwoWayFoldFunctions<Info, undefined, T>, 'down'>

const down = () => { return undefined }

/**
 * Folds in old functional-fashion over the AST structure.
 * <p>
 * Internally implemented as a special case of a two-way fold (with the down part as an essential no-op)
 */
export function foldAst<Info, T>(ast: RNode<Info>, folds: DeepReadonly<FoldFunctions<Info, T>>): T {
  const twoWayFolds: DeepReadonly<TwoWayFoldFunctions<Info, undefined, T>> = {
    down,
    ...folds
  }
  return foldAstTwoWay(ast, undefined, twoWayFolds)
}

