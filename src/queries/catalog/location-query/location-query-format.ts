import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SourceRange } from '../../../util/range';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

export interface LocationQuery extends BaseQueryFormat {
	readonly type:   'location';
	readonly nodeId: NodeId;
}

export interface LocationQueryResult extends BaseQueryResult {
	readonly location: (SourceRange | undefined)[];
}
