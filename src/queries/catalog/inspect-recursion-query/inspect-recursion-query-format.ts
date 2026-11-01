import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeRecursionQuery } from './inspect-recursion-query-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { SupportedQuery } from '../../query';
import { functionPropertyQuery } from '../../query-function-property';

/**
 * Either returns all function definitions alongside whether they are recursive,
 * or just those matching the filters.
 */
export interface InspectRecursionQuery extends BaseQueryFormat {
	readonly type:    'inspect-recursion';
	readonly filter?: readonly SlicingCriterion[]
}

export interface InspectRecursionQueryResult extends BaseQueryResult {
	readonly recursive: Record<NodeId, boolean>;
}

export const InspectRecursionQueryDefinition = functionPropertyQuery({
	type:      'inspect-recursion',
	title:     'Inspect Recursive Functions Query',
	noun:      'recursive',
	resultKey: 'recursive',
	phrase:    'recursive',
	compute:   executeRecursionQuery
}) satisfies SupportedQuery<'inspect-recursion'>;
