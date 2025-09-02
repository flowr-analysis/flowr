import type { Package } from '../project/plugins/package-version-plugins/package';
import type { FlowrAnalysisInput } from '../project/flowr-analyzer';
import type { SemVer } from 'semver';

export interface BaseQueryFormat {
	/** used to select the query type :) */
	readonly type: string;
}

export interface BaseQueryMeta {
	/** Duration in milliseconds */
	readonly timing: number;
}
export interface BaseQueryResult {
	readonly '.meta': BaseQueryMeta;
}

export interface BasicQueryData {
	readonly lib?:       Record<string, SemVer>;
	readonly libraries?: Package[];
	readonly input:      FlowrAnalysisInput;
}
