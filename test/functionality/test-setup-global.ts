import { type TestLabel, printMissingLabelSummary } from './_helper/label';
import fs from 'fs';
import path from 'path';
import { DefaultMap } from '../../src/util/collections/defaultmap';
import { DetailedInfoFile, GlobalSummaryFile, TestSuites } from './summary-def';
import { jsonReplacer } from '../../src/util/json';
import { ensureTestTmp, pruneStaleTestTmp } from '../test-tmp.mjs';
import type { TestProject } from 'vitest/node';
import { checkNetworkConnection } from './_helper/network';
import { RShell } from '../../src/r-bridge/shell';

declare module 'vitest' {
	export interface ProvidedContext {
		/** whether the machine running the tests resolves names on the network */
		hasNetwork: boolean
		/** the version of the R the tests run with, `undefined` if R is not available */
		rVersion:   string | undefined
	}
}


/**
 * Runs once before the whole suite: prepares what every test file assumes to be there.
 */
export async function setup(project: TestProject) {
	ensureTestTmp();
	pruneStaleTestTmp();
	try {
		fs.unlinkSync(GlobalSummaryFile);
	} catch{
		/* if it does not work it is not a big deal, this is just for summary reasons */
	}
	/* asked once here rather than in every test file, which would start an R process per file */
	project.provide('hasNetwork', await checkNetworkConnection());
	let shell: RShell | undefined;
	try {
		shell = new RShell();
		shell.tryToInjectHomeLibPath();
		project.provide('rVersion', (await shell.usedRVersion())?.raw);
	} catch(e) {
		console.error(e);
		project.provide('rVersion', undefined);
	} finally {
		shell?.close();
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
		function writable(d: string): void {
			fs.chmodSync(d, 0o700);
			for(const e of fs.readdirSync(d, { withFileTypes: true })) {
				if(e.isDirectory() && !e.isSymbolicLink()) {
					writable(path.join(d, e.name));
				}
			}
		}
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
		if(DetailedInfoFile === TestSuites.functionality.details) {
			printMissingLabelSummary(labelMap);
		}
	} catch{
		/* if we do not find the summary, then this is not a big problem */
	}

	fs.mkdirSync(path.dirname(DetailedInfoFile), { recursive: true });
	fs.writeFileSync(DetailedInfoFile, JSON.stringify([...labelMap.entries()], jsonReplacer));
}
