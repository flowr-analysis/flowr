// TODO: promote to visitor?
import { RNode } from '../model'
import { Type } from '../type'
import { assertUnreachable } from '../../../../../util/assert'

/** Return `true` to stop visiting from this node (i.e., do not continue to visit this node *and* the children) */
export type OnVisit<OtherInfo> = (node: RNode<OtherInfo>) => boolean

function visitSingle<OtherInfo>(node: RNode<OtherInfo>, onVisit: OnVisit<OtherInfo>): void {
  if(onVisit(node)) {
    return
  }

  const type = node.type
  switch (type) {
    case Type.FunctionCall:
      visit(node.flavour === 'named' ? node.functionName : node.calledFunction, onVisit)
      visit(node.arguments, onVisit)
      break
    case Type.FunctionDefinition:
      visit(node.body, onVisit)
      break
    case Type.ExpressionList:
      visit(node.children, onVisit)
      break
    case Type.For:
      visit(node.variable, onVisit)
      visit(node.vector, onVisit)
      visit(node.body, onVisit)
      break
    case Type.While:
      visit(node.condition, onVisit)
      visit(node.body, onVisit)
      break
    case Type.Repeat:
      visit(node.body, onVisit)
      break
    case Type.If:
      visit(node.condition, onVisit)
      visit(node.then, onVisit)
      visit(node.otherwise, onVisit)
      break
    case Type.Pipe:
    case Type.BinaryOp:
      visit(node.lhs, onVisit)
      visit(node.rhs, onVisit)
      break
    case Type.UnaryOp:
      visit(node.operand, onVisit)
      break
    case Type.Parameter:
      visit(node.name, onVisit)
      visit(node.defaultValue, onVisit)
      break
    case Type.Argument:
      visit(node.name, onVisit)
      visit(node.value, onVisit)
      break
    case Type.Access:
      visit(node.accessed, onVisit)
      if(node.operator === '[' || node.operator === '[[') {
        visit(node.access, onVisit)
      }
      break
    case Type.Symbol:
    case Type.Logical:
    case Type.Number:
    case Type.String:
    case Type.Comment:
    case Type.Question:
    case Type.Break:
    case Type.Next:
      // leafs
      break
    default:
      assertUnreachable(type)
  }
}

/**
 * Collects all node ids within a tree given by a respective root node
 *
 * @param nodes   - The root id nodes to start collecting from
 * @param onVisit - A function that is called for each node encountered - can be used to stop visiting the subtree starting with this node
 */
export function visit<OtherInfo>(nodes: RNode<OtherInfo> | (RNode<OtherInfo> | null | undefined)[] | undefined, onVisit: OnVisit<OtherInfo>): void {
  if(Array.isArray(nodes)) {
    for (const node of nodes) {
      if(node === null || node === undefined) {
        continue
      }
      visitSingle(node, onVisit)
    }
  } else if(nodes !== undefined) {
    visitSingle(nodes, onVisit)
  }
}
