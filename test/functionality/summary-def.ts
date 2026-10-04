import path from 'path';
import os from 'os';
import Suites from './test-suites.json';

export const GlobalSummaryFile = path.join(os.tmpdir(), `flowr-label-summary-${process.pid}.json`);

/* kept as JSON, so the vitest configurations can read it without loading TypeScript */
export const TestSuites = Suites;

export const DetailedInfoFile = process.env.FLOWR_TEST_DETAILS_FILE ?? TestSuites.functionality.details;
