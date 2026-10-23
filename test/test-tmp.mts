import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/* every temporary file of a run, including those of the R shells, lands in one folder the global teardown removes */
process.env.FLOWR_TEST_TMP ??= mkdtempSync(join(tmpdir(), 'flowr-test-'));
process.env.TMPDIR = process.env.TEMP = process.env.TMP = process.env.FLOWR_TEST_TMP;
