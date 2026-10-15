import { log } from '../../../util/log';
import type { ConfigQuery, ConfigQueryResult } from './config-query-format';
import { validateConfigUpdate } from './config-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { isNotUndefined } from '../../../util/assert';
import { FlowrConfig } from '../../../config';

/**
 * Executes the given configuration queries using the provided analyzer.
 */
export function executeConfigQuery({ analyzer }: BasicQueryData, queries: readonly ConfigQuery[]): Promise<ConfigQueryResult> {
	if(queries.some(q => q.reset)) {
		analyzer.resetConfig();
	}

	const updates = queries.map(q => q.update).filter(isNotUndefined);
	if(updates.length > 1) {
		log.warn('Config query usually expects only up to one update, but got', updates.length);
	}

	// validate here too (not only in the repl parser), so a programmatic / JSON-API update cannot merge an unknown
	// key or a wrong-typed value; the update then lands via `updateConfig`, which invalidates the analysis cache
	for(const given of updates) {
		const err = validateConfigUpdate(given);
		if(err !== undefined) {
			log.warn(`ignoring invalid config update: ${err}`);
			continue;
		}
		// queries may come from clients of the server, so they must not choose what flowR executes, loads, or downloads
		const update = structuredClone(given);
		const dropped = FlowrConfig.dropSecuritySensitive(update);
		if(dropped.length > 0) {
			log.warn(`ignoring security-sensitive options in config update: ${dropped.join(', ')}`);
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
