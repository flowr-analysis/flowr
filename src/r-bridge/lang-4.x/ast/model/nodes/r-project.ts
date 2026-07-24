import type { NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import type { RExpressionList } from './r-expression-list';
import type { NodeId } from '../processing/node-id';
import type { OnEnter, OnExit } from '../processing/visitor';
import type { ParentInformation } from '../processing/decorate';

/**
 * Holds a single R file starting with an expression list.
 */
export interface RProjectFile<Info = NoInfo> {
	readonly filePath?: string;
	readonly root:      RExpressionList<Info>;
}

/**
 * Holds a collection of files (started with the expression list)
 * @see {@link RProject.visitAst} - to visit all nodes in the project and related helper functions
 * @see {@link RExpressionList} - for the root of each file
 * @see {@link RProject.merge} - to merge multiple projects into a single one
 * @see {@link RProjectFile} - for each file in the project
 */
export interface RProject<Info = NoInfo> {
	readonly type:  RType.Project;
	readonly files: RProjectFile<Info>[];
	readonly info?: {
		id: NodeId;
	}
}

/**
 * Helper object to identify RProject nodes by their type and to provide related functions.
 * @see {@link RNode.visitAst} - to visit all nodes in the project
 */
export const RProject = {
	name: 'RProject',
	/**
	 * Visits all nodes in the project by visiting the root of each file.
	 * @param project          - The project to visit file by file
	 * @param onVisit        - Called before visiting the subtree of each node. Can be used to stop visiting the subtree starting with this node (return `true` stop)
	 * @param onExit         - Called after the subtree of a node has been visited, called for leafs too (even though their subtree is empty)
	 */
	visitAst<OtherInfo>(this: void, project: RProject<OtherInfo>, onVisit?: OnEnter<OtherInfo>, onExit?: OnExit<OtherInfo>) {
		return RNode.visitAst(project.files.map(f => f.root), onVisit, onExit);
	},
	/**
	 * Collects all node ids within a project
	 * @param project - The project to collect ids from
	 * @see {@link RNode.collectAllIds} - to stop collecting at certain nodes
	 * @see {@link RProject.collectAllIdsWithStop} - to stop collecting at certain nodes
	 */
	collectAllIds<OtherInfo>(this: void, project: RProject<OtherInfo & ParentInformation>): Set<NodeId> {
		return RNode.collectAllIds(RProject.asNodes(project));
	},
	/**
	 * Collects all node ids within a project, but stops collecting at nodes where the given `stop` function returns `true`.
	 * @param project - The project to collect ids from
	 * @param stop    - A function that determines whether to stop collecting at a given node, does not stop by default
	 * @see {@link RNode.collectAllIdsWithStop} - to collect all ids without stopping
	 * @see {@link RProject.collectAllIds} - to collect all ids without stopping
	 */
	collectAllIdsWithStop<OtherInfo>(this: void, project: RProject<OtherInfo & ParentInformation>, stop: (node: RNode<OtherInfo & ParentInformation>) => boolean): Set<NodeId> {
		return RNode.collectAllIdsWithStop(RProject.asNodes(project), stop);
	},
	/**
	 * Flattens the project to an array of nodes by collecting the root nodes of each file.
	 */
	asNodes<OtherInfo>(this: void, project: RProject<OtherInfo>): RNode<OtherInfo>[] {
		return project.files.map(f => f.root);
	},
	/**
	 * Type guard for RProject nodes.
	 */
	is<OtherInfo = NoInfo>(this: void, node: unknown): node is RProject<OtherInfo> {
		return typeof node === 'object' && node !== null && 'type' in node && node.type === RType.Project;
	},
	/**
	 * Merge multiple projects into a single one by concatenating their files.
	 * This will remove the `info` property of the resulting project.
	 */
	merge<Info = NoInfo>(this: void, projects: readonly RProject<Info>[]): RProject<Info> {
		return {
			type:  RType.Project,
			files: projects.flatMap(p => p.files)
		};
	}
} as const;
