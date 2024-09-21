export interface BaseQueryFormat {
	/** used to select the query type :) */
	readonly type: string;
}

export interface BaseQueryResult<Query extends BaseQueryFormat> {
	/** type of the query which produced this result */
	readonly type: Query['type'];
}
