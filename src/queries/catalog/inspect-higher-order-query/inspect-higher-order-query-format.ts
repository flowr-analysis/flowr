import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeHigherOrderQuery } from './inspect-higher-order-query-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { SupportedQuery } from '../../query';
import { functionPropertyQuery } from '../../query-function-property';

/**
 * Either returns all function definitions alongside whether they are higher-order functions,
 * or just those matching the filters.
 */
export interface InspectHigherOrderQuery extends BaseQueryFormat {
	readonly type:    'inspect-higher-order';
	readonly filter?: readonly SlicingCriterion[]
}

export interface InspectHigherOrderQueryResult extends BaseQueryResult {
	readonly higherOrder: Record<NodeId, boolean>;
}

export const InspectHigherOrderQueryDefinition = functionPropertyQuery({
	type:      'inspect-higher-order',
	title:     'Inspect Higher-Order Functions Query',
	noun:      'higher-order functions',
	resultKey: 'higherOrder',
	phrase:    'a higher-order function',
	compute:   executeHigherOrderQuery
}) satisfies SupportedQuery<'inspect-higher-order'>;
