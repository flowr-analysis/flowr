import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { summarizeIdsIfTooLong, queryHeader } from '../../query-print';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';

/**
 * Executes the given ID map queries using the provided analyzer.
 */
export async function executeIdMapQuery({ analyzer }: BasicQueryData, queries: readonly IdMapQuery[]): Promise<IdMapQueryResult> {
	if(queries.length !== 1) {
		log.warn('Id-Map query expects only up to one query, but got', queries.length);
	}

	const startTime = Date.now();
	const idMap = (await analyzer.normalize()).idMap;
	return {
		...metaSince(startTime),
		idMap
	};
}

export interface IdMapQuery extends BaseQueryFormat {
	readonly type: 'id-map';
}

export interface IdMapQueryResult extends BaseQueryResult {
	readonly idMap: AstIdMap;
}

export const IdMapQueryDefinition = {
	title:           'Id-Map Query',
	executor:        executeIdMapQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'id-map'>['id-map'];
		result.push(queryHeader('id-map', formatter, out['.meta'].timing));
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong(formatter, Array.from(out.idMap.keys()))}}`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('id-map').required().description('The type of the query.'),
	}).description('The id map query retrieves the id map from the normalized AST.')
} as const satisfies SupportedQuery<'id-map'>;
