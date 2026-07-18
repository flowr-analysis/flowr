import { log } from '../../../util/log';
import type { ConfigQuery, ConfigQueryResult } from './config-query-format';
import { validateConfigUpdate } from './config-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { isNotUndefined } from '../../../util/assert';

/**
 * Executes the given configuration queries using the provided analyzer.
 */
export function executeConfigQuery({ analyzer }: BasicQueryData, queries: readonly ConfigQuery[]): Promise<ConfigQueryResult> {
	if(queries.length !== 1) {
		log.warn('Config query usually expects only up to one query, but got', queries.length);
	}
	const updates = queries.map(q => q.update).filter(isNotUndefined);

	// validate here too (not only in the repl parser), so a programmatic / JSON-API update cannot merge an unknown
	// key or a wrong-typed value; the update then lands via `updateConfig`, which invalidates the analysis cache
	for(const update of updates) {
		const err = validateConfigUpdate(update);
		if(err !== undefined) {
			log.warn(`ignoring invalid config update: ${err}`);
			continue;
		}
		analyzer.updateConfig(update);
	}

	const specialization = analyzer.inspectContext().configSpecialization();
	return Promise.resolve({
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		config: analyzer.flowrConfig,
		...(specialization ? { specialization } : {})
	});
}
