import path from 'path';
import os from 'os';

export const GlobalSummaryFile = path.join(os.tmpdir(), `flowr-label-summary-${process.pid}.json`);

export const TestSuites = {
	functionality: { folder: 'test/functionality', details: 'coverage/flowr-test-details.json' },
	mutations:     { folder: 'test/mutations', details: 'coverage/flowr-test-details-mutations.json' }
} as const;

export const DetailedInfoFile = process.env.FLOWR_TEST_DETAILS_FILE ?? TestSuites.functionality.details;
