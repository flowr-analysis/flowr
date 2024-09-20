export interface BaseQueryFormat {
	/** used to select the query type :) */
	readonly type: string;
}

/* TODO: type result? */
export interface BaseQueryResult<Query extends BaseQueryFormat> {
	readonly queryType: Query['type'];
}
