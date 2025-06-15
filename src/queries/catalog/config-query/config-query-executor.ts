import { log } from '../../../util/log';
import type {
	ConfigQuery,
	ConfigQueryResult
} from './config-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { getConfig } from '../../../config';


export function executeConfigQuery(_: BasicQueryData, queries: readonly ConfigQuery[]): ConfigQueryResult {
	if(queries.length !== 1) {
		log.warn('Config query expects only up to one query, but got', queries.length);
	}

	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		config: getConfig()
	};
}
