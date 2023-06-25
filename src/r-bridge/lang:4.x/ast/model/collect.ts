import { NodeId, ParentInformation } from './processing'
import { RNode } from './model'
import { Type } from './type'
import { assertUnreachable } from '../../../../util/assert'

// TODO: promote to visitor?
function* collectSingleNode<OtherInfo>(node: RNode<OtherInfo & ParentInformation>): IterableIterator<NodeId> {
  yield node.info.id
  const type = node.type
  switch (type) {
    case Type.FunctionCall:
      yield* collectAllIds(node.functionName)
      yield* collectAllIds(node.arguments)
      break
    case Type.FunctionDefinition:
      yield* collectAllIds(node.body)
      break
    case Type.ExpressionList:
      yield* collectAllIds(node.children)
      break
    case Type.For:
      yield* collectAllIds(node.variable)
      yield* collectAllIds(node.vector)
      yield* collectAllIds(node.body)
      break
    case Type.While:
      yield* collectAllIds(node.condition)
      yield* collectAllIds(node.body)
      break
    case Type.Repeat:
      yield* collectAllIds(node.body)
      break
    case Type.If:
      yield* collectAllIds(node.condition)
      yield* collectAllIds(node.then)
      yield* collectAllIds(node.otherwise)
      break
    case Type.BinaryOp:
      yield* collectAllIds(node.lhs)
      yield* collectAllIds(node.rhs)
      break
    case Type.UnaryOp:
      yield* collectAllIds(node.operand)
      break
    case Type.Parameter:
      yield* collectAllIds(node.name)
      yield* collectAllIds(node.defaultValue)
      break
    case Type.Argument:
      yield* collectAllIds(node.name)
      yield* collectAllIds(node.value)
      break
    case Type.Access:
      yield* collectAllIds(node.name)
      if(node.op === '[' || node.op === '[[') {
        yield* collectAllIds(node.access)
      }
      break
    case Type.Symbol:
    case Type.Logical:
    case Type.Number:
    case Type.String:
    case Type.Comment:
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
 * @param nodes - The root id nodes to start collecting from
 */
export function* collectAllIds<OtherInfo>(nodes: RNode<OtherInfo & ParentInformation> | RNode<OtherInfo & ParentInformation>[] | undefined): IterableIterator<NodeId> {
  if(Array.isArray(nodes)) {
    for (const node of nodes) {
      yield* collectSingleNode(node)
    }
  } else if(nodes !== undefined) {
    yield* collectSingleNode(nodes)
  }
}
