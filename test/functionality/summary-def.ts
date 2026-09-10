import path from 'path';
import os from 'os';

export const GlobalSummaryFile = path.join(os.tmpdir(), `flowr-label-summary-${process.pid}.json`);

export const DetailedInfoFile = process.env.FLOWR_TEST_DETAILS_FILE ?? 'coverage/flowr-test-details.json';
