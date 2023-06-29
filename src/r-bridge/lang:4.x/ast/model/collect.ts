import { NodeId, ParentInformation } from './processing'
import { RNode } from './model'
import { Type } from './type'
import { assertUnreachable } from '../../../../util/assert'

// TODO: promote to visitor?
function* collectSingleNode<OtherInfo>(node: RNode<OtherInfo & ParentInformation>, stop: (node: RNode<OtherInfo & ParentInformation>)  => boolean): IterableIterator<NodeId> {
  yield node.info.id
  const type = node.type
  switch (type) {
    case Type.FunctionCall:
      yield* collectAllIds(node.functionName, stop)
      yield* collectAllIds(node.arguments, stop)
      break
    case Type.FunctionDefinition:
      yield* collectAllIds(node.body, stop)
      break
    case Type.ExpressionList:
      yield* collectAllIds(node.children, stop)
      break
    case Type.For:
      yield* collectAllIds(node.variable, stop)
      yield* collectAllIds(node.vector, stop)
      yield* collectAllIds(node.body, stop)
      break
    case Type.While:
      yield* collectAllIds(node.condition, stop)
      yield* collectAllIds(node.body, stop)
      break
    case Type.Repeat:
      yield* collectAllIds(node.body, stop)
      break
    case Type.If:
      yield* collectAllIds(node.condition, stop)
      yield* collectAllIds(node.then, stop)
      yield* collectAllIds(node.otherwise, stop)
      break
    case Type.Pipe:
    case Type.BinaryOp:
      yield* collectAllIds(node.lhs, stop)
      yield* collectAllIds(node.rhs, stop)
      break
    case Type.UnaryOp:
      yield* collectAllIds(node.operand, stop)
      break
    case Type.Parameter:
      yield* collectAllIds(node.name, stop)
      yield* collectAllIds(node.defaultValue, stop)
      break
    case Type.Argument:
      yield* collectAllIds(node.name, stop)
      yield* collectAllIds(node.value, stop)
      break
    case Type.Access:
      yield* collectAllIds(node.accessed, stop)
      if(node.operator === '[' || node.operator === '[[') {
        yield* collectAllIds(node.access, stop)
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
 * @param stop - A function that determines whether to stop collecting at a given node, does not stop by default
 */
export function* collectAllIds<OtherInfo>(nodes: RNode<OtherInfo & ParentInformation> | (RNode<OtherInfo & ParentInformation> | null | undefined)[] | undefined, stop: (node: RNode<OtherInfo & ParentInformation>)  => boolean = () => false): IterableIterator<NodeId> {
  if(Array.isArray(nodes)) {
    for (const node of nodes) {
      if(node === null || node === undefined || stop(node)) {
        continue
      }
      yield* collectSingleNode(node, stop)
    }
  } else if(nodes !== undefined) {
    if(stop(nodes)) {
      return
    }
    yield* collectSingleNode(nodes, stop)
  }
}
