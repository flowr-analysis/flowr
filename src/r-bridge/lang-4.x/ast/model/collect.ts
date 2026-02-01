import type { RNode } from './model';
import { visitAst } from './processing/visitor';
import type { NodeId } from './processing/node-id';
import type { ParentInformation } from './processing/decorate';
import type { RProject } from './nodes/r-project';
import { RType } from './type';

/**
 * Collects all node ids within a tree given by a respective root node
 * @param nodes - The root id nodes to start collecting from
 * @param stop  - A function that determines whether to stop collecting at a given node, does not stop by default
 */
export function collectAllIds<OtherInfo>(nodes: RProject<OtherInfo & ParentInformation> | RNode<OtherInfo & ParentInformation> | (RNode<OtherInfo & ParentInformation> | null | undefined)[] | undefined, stop: (node: RNode<OtherInfo & ParentInformation>) => boolean = () => false): Set<NodeId> {
	if(nodes && 'type' in nodes && nodes.type === RType.Project) {
		nodes = nodes.files.map(f => f.root);
	}
	const ids = new Set<NodeId>();
	visitAst(nodes, (node) => {
		if(stop(node)) {
			return true;
		}
		ids.add(node.info.id);
		return false;
	});
	return ids;
}
