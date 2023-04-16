import * as Lang from '../../../src/r-bridge/lang/ast/model'

export const exprList = (...children: Lang.RNode[]): Lang.RExprList => {
  return { type: Lang.Type.ExprList, children }
}
