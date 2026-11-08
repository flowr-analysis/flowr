import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertCriteriaReplParser } from '../../../_helper/repl';

describe('Origin Query REPL Parser', () => {
	assertCriteriaReplParser(SupportedQueries['origin'].fromLine, ([criterion]) => ({ type: 'origin', criterion }), { multiple: false });
});
