import { describe, test } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { FlowrConfig } from '../../../../../src/config';
import { discardingReplOutput } from '../../../_helper/repl';

/* `:query @type` with nothing after it must answer with a usage message, never crash */
describe('Query line parsers without arguments', () => {
	for(const [type, definition] of Object.entries(SupportedQueries)) {
		if('fromLine' in definition && definition.fromLine) {
			test(type, () => {
				definition.fromLine(discardingReplOutput, [], FlowrConfig.default());
			});
		}
	}
});
