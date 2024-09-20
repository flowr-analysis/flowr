export interface BaseQueryFormat {
	/** used to select the query type :) */
	readonly type: string;
}

export interface BaseQueryResult<Query extends BaseQueryFormat> {
	readonly queryType: Query['type'];
}
