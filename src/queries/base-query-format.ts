import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { FlowrConfigOptions } from '../config';
import type { LibraryInfo } from './catalog/dependencies-query/dependencies-query-format';
import type { FlowrProject } from '../project/flowr-project';

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
	project?:          FlowrProject;
	readonly library?: LibraryInfo;
	readonly ast:      NormalizedAst;
	readonly dataflow: DataflowInformation;
	readonly config:   FlowrConfigOptions;
}
