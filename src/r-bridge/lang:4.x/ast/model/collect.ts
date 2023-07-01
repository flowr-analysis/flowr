import { NodeId, ParentInformation, visit } from './processing'
import { RNode } from './model'

/**
 * Collects all node ids within a tree given by a respective root node
 *
 * @param nodes - The root id nodes to start collecting from
 * @param stop  - A function that determines whether to stop collecting at a given node, does not stop by default
 */
export function collectAllIds<OtherInfo>(nodes: RNode<OtherInfo & ParentInformation> | (RNode<OtherInfo & ParentInformation> | null | undefined)[] | undefined, stop: (node: RNode<OtherInfo & ParentInformation>)  => boolean = () => false): Set<NodeId> {
  const ids = new Set<NodeId>()
  visit(nodes, (node) => {
    if(stop(node)) {
      return true
    }
    ids.add(node.info.id)
    return false
  })
  return ids
}
