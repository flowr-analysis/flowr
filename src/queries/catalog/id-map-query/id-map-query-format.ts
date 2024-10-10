import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';

export interface IdMapQuery extends BaseQueryFormat {
	readonly type: 'id-map';
}

export interface IdMapQueryResult extends BaseQueryResult {
	readonly idMap: AstIdMap;
}
