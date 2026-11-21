import { describe } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertCriteriaReplParser } from '../../../_helper/repl';

describe('Resolve Value Query REPL Parser', () => {
	assertCriteriaReplParser(SupportedQueries['resolve-value'].fromLine, criteria => [{ type: 'resolve-value', criteria: [...criteria] }]);
});
