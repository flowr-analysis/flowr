import { log } from '../../../util/log';
import type { ConfigQuery, ConfigQueryResult } from './config-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { isNotUndefined } from '../../../util/assert';
import { deepMergeObjectInPlace } from '../../../util/objects';


/**
 *
 */
export function executeConfigQuery({ analyzer }: BasicQueryData, queries: readonly ConfigQuery[]): Promise<ConfigQueryResult> {
	if(queries.length !== 1) {
		log.warn('Config query usually expects only up to one query, but got', queries.length);
	}
	const updates = queries.map(q => q.update).filter(isNotUndefined);

	for(const update of updates) {
		deepMergeObjectInPlace(analyzer.flowrConfig, update);
	}

	return Promise.resolve({
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		config: analyzer.flowrConfig
	});
}
