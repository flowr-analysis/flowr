import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * Calculates the lineage of the given criterion.
 */
export interface LineageQuery extends BaseQueryFormat {
	readonly type:      'lineage';
	readonly criterion: SingleSlicingCriterion;
}

export interface LineageQueryResult extends BaseQueryResult {
	/** Maps each criterion to the found lineage, duplicates are ignored. */
	readonly lineages: Record<SingleSlicingCriterion, Set<NodeId>>;
}
