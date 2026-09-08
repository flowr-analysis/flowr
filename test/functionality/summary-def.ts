import path from 'path';
import os from 'os';

/* suffixed by pid so a concurrent functionality/mutations run never shares one file */
export const GlobalSummaryFile = path.join(os.tmpdir(), `flowr-label-summary-${process.pid}.json`);

/* the mutations suite points this at its own file, so its run does not overwrite the functionality one */
export const DetailedInfoFile = process.env.FLOWR_TEST_DETAILS_FILE ?? 'coverage/flowr-test-details.json';
