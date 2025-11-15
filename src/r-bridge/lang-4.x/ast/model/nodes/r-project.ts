import type { NoInfo } from '../model';
import { RType } from '../type';
import type { RExpressionList } from './r-expression-list';
import type { NodeId } from '../processing/node-id';

/**
 * Holds a collection of files (started with the expression list)
 * @see {@link RExpressionList} - for the root of each file
 * @see {@link mergeProjects}  - to merge multiple projects into a single one
 */
export interface RProject<Info = NoInfo> {
	readonly type:  RType.Project;
	readonly files: {
		readonly filePath?: string;
		readonly root:      RExpressionList<Info>;
	}[];
	readonly info?: {
		id: NodeId;
	}
}

/**
 * Merge multiple projects into a single one by concatenating their files.
 * This will remove the `info` property of the resulting project.
 */
export function mergeProjects<Info = NoInfo>(
	projects: RProject<Info>[]
): RProject<Info> {
	return {
		type:  RType.Project,
		files: projects.flatMap(p => p.files)
	};
}

