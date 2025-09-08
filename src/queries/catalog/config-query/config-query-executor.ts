import { log } from '../../../util/log';
import type { ConfigQuery, ConfigQueryResult } from './config-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { isNotUndefined } from '../../../util/assert';
import { deepMergeObject } from '../../../util/objects';
import { cloneConfig } from '../../../config';

export function executeConfigQuery({ input }: BasicQueryData, queries: readonly ConfigQuery[]): Promise<ConfigQueryResult> {
	if(queries.length !== 1) {
		log.warn('Config query usually expects only up to one query, but got', queries.length);
	}
	const updates = queries.map(q => q.update).filter(isNotUndefined);
	const config = cloneConfig(input.flowrConfig);

	for(const update of updates) {
		deepMergeObject(config, update);
	}

	return new Promise<ConfigQueryResult>((resolve) => {
		resolve({
			'.meta': {
				/* there is no sense in measuring a get */
				timing: 0
			},
			config: config
		});
	});
}
