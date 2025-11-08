import { type TestLabel , printMissingLabelSummary } from './_helper/label';
import fs from 'fs';
import { DefaultMap } from '../../src/util/collections/defaultmap';
import { GlobalSummaryFile } from './summary-def';
import { jsonReplacer } from '../../src/util/json';


/**
 *
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

	// ensure we have a folder 'coverage/'
	fs.mkdirSync('coverage', { recursive: true });
	fs.writeFileSync('coverage/flowr-test-details.json', JSON.stringify([...labelMap.entries()], jsonReplacer));
}
