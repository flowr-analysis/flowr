import { DeepReadonly } from "ts-essentials"
import { RNode } from '../model'
import { foldAstStateful, StatefulFoldFunctions } from './statefulFold'

export type FoldFunctions<Info, T> = Omit<StatefulFoldFunctions<Info, undefined, T>, 'down'>

const down = () => undefined

/**
 * Folds in old functional-fashion over the AST structure.
 * <p>
 * Internally implemented as a special case of a two-way fold (with the down part as an essential no-op)
 */
export function foldAst<Info, T>(ast: RNode<Info>, folds: DeepReadonly<FoldFunctions<Info, T>>): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- just so we do not have to re-create
  const statefulFolds: any = folds
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  statefulFolds.down = down
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return foldAstStateful(ast, undefined, statefulFolds)
}

