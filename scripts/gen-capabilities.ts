/**
 * Generates the capabilities page at `wiki/capabilities/index.html`, which is what flowR's documentation
 * points at whenever it says what flowR can and cannot do with R.
 *
 * The page is plain static HTML like the landing page. It carries every capability, the tests that demonstrate
 * it, and its example, which opens in the playground rather than running here.
 */
import path from 'path';
import { template, writePage } from './html-page';
import { TreeSitterExecutor } from '../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { capabilitiesAsHtml } from '../src/documentation/doc-capabilities';
import type { KnownNames } from '../src/util/text/r-highlight';
import { openDatabase } from './sigdb-index';

const Target = path.join('wiki', 'capabilities', 'index.html');

/** base-R calls the page links to, mapped to their package; empty if the sigdb is not present locally */
async function knownBaseRNames(): Promise<KnownNames> {
	const db = await openDatabase();
	const names = new Map<string, string>();
	if(!db) {
		return names;
	}
	for(const pkg of db.packageNames().filter(name => db.isBaseR(name))) {
		for(const name of db.lookup(pkg)?.exported ?? []) {
			/* a name several base packages export is attributed to the first, as the search shows the rest */
			if(!names.has(name)) {
				names.set(name, `${pkg}::${name}`);
			}
		}
	}
	db.close();
	return names;
}

async function main(): Promise<void> {
	await TreeSitterExecutor.initTreeSitter();
	const { body, summary } = await capabilitiesAsHtml(new TreeSitterExecutor(), await knownBaseRNames());
	const page = template('landing-capabilities-template.html')
		.replaceAll('<!--SUMMARY-->', `${summary.fully} of ${summary.total} features fully, ${summary.partially} partially and ${summary.not} not supported.`)
		/* the body is spliced through a function, as a `$&` within it would otherwise expand to the placeholder */
		.replace('<!--CAPABILITIES-->', () => body);
	console.log(`  wrote ${Target} (${(writePage(Target, page) / 1024).toFixed(1)} kB)`);
}

void main();
