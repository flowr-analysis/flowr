import { flowrScriptGetStats } from '../../../src/cli/script-core/statistics-core';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { flowrScriptSummarizer } from '../../../src/cli/script-core/summarizer-core';
import { SummarizerType } from '../../../src/util/summarizer';
import { getPlatform } from '../../../src/util/os';
import { describe, test } from 'vitest';


describe('Post-Processing', () => {
	/* if we are on windows, skip, as there are maybe cleanup problems */
	test.skipIf(getPlatform() === 'windows' || getPlatform() === 'unknown')('Full Extraction on Sample Folder (Shellesc)', async() => {
		const tempfolder = fs.mkdtempSync(path.resolve(os.tmpdir(), 'flowr-test-temp-'));
		// run the basic statistics script
		await flowrScriptGetStats({
			verbose:      false,
			help:         false,
			input:        ['test/testfiles/statistics'],
			'output-dir': tempfolder,
			/* -1 to trigger test setup */
			parallel:     -1,
			'dump-json':  false,
			features:     ['all'],
			limit:        undefined,
			'no-ansi':    false
		});
		/* now run the summarizer :D */
		await flowrScriptSummarizer({
			verbose:         false,
			help:            false,
			'ultimate-only': false,
			input:           tempfolder,
			'project-skip':  1,
			categorize:      true,
			type:            SummarizerType.Statistics,
		});
		/* remove the temp folder, as well as *-final and *-intermediate */
		process.on('exit', () => {
			try {
				fs.rmSync(tempfolder, { recursive: true, force: true });
				fs.rmSync(tempfolder + '-final', { recursive: true, force: true });
				fs.rmSync(tempfolder + '-intermediate', { recursive: true, force: true });
			} catch(e) {
				console.error('Error during cleanup:', e);
			}
		});
	});
});
