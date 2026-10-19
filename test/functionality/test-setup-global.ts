import { type TestLabel, printMissingLabelSummary } from './_helper/label';
import fs from 'fs';
import path from 'path';
import { DefaultMap } from '../../src/util/collections/defaultmap';
import { DetailedInfoFile, GlobalSummaryFile } from './summary-def';
import { jsonReplacer } from '../../src/util/json';


/**
 * Runs once before the whole suite: prepares what every test file assumes to be there.
 */
export function setup() {
	try {
		fs.unlinkSync(GlobalSummaryFile);
	} catch{
		/* if it does not work it is not a big deal, this is just for summary reasons */
	}
}


/** called by vitest */
export function teardown() {
	try {
		makeSummary();
	} finally {
		if(process.env.FLOWR_TEST_TMP) {
			removeAll(process.env.FLOWR_TEST_TMP);
		}
	}
}

/** removes `dir`, also when a test left a folder in it without write permission */
function removeAll(dir: string) {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch{
		const writable = (d: string): void => {
			fs.chmodSync(d, 0o700);
			for(const e of fs.readdirSync(d, { withFileTypes: true })) {
				if(e.isDirectory() && !e.isSymbolicLink()) {
					writable(path.join(d, e.name));
				}
			}
		};
		writable(dir);
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function makeSummary() {
	if(!process.argv.includes('--make-summary')) {
		return;
	}
	const labelMap: DefaultMap<string, TestLabel[]> = new DefaultMap(() => []);
	try {
		const content = fs.readFileSync(GlobalSummaryFile);
		// parse line by line, accumulate the map
		const lines = content.toString().split('\n');
		for(const line of lines) {
			if(line.trim().length === 0) {
				continue;
			}
			try {
				const obj = new Map<string, TestLabel[]>((JSON.parse(line) as { internal: [string, TestLabel[]][] }).internal);
				for(const [key, value] of obj.entries()) {
					/** offset all ids by currentMax to ensure unique */
					labelMap.get(key).push(...value);
				}
			} catch{
				/* skip line */
			}
		}
		printMissingLabelSummary(labelMap);
	} catch{
		/* if we do not find the summary, then this is not a big problem */
	}

	fs.mkdirSync(path.dirname(DetailedInfoFile), { recursive: true });
	fs.writeFileSync(DetailedInfoFile, JSON.stringify([...labelMap.entries()], jsonReplacer));
}
