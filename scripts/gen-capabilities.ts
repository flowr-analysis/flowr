/**
 * Generates the capabilities page at `wiki/capabilities/index.html`, which is what flowR's documentation
 * points at whenever it says what flowR can and cannot do with R.
 *
 * The page is plain static HTML like the landing page. It carries every capability, the tests that demonstrate
 * it, and its example, which opens in the playground rather than running here.
 */
import fs from 'fs';
import path from 'path';
import { template, writePage, committedNote } from './html-page';
import { TreeSitterExecutor } from '../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { capabilitiesAsHtml } from '../src/documentation/doc-capabilities';
import type { KnownNames } from '../src/util/text/r-highlight';
import { FlowrAnalyzerBuilder } from '../src/project/flowr-analyzer-builder';

const Target = path.join('wiki', 'capabilities', 'index.html');

async function knownNames(): Promise<KnownNames> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
	return {
		get: name => {
			const info = analyzer.functionInfo(name);
			return info === undefined ? undefined : info.package === undefined ? name : `${info.package}::${name}`;
		}
	};
}

async function main(): Promise<void> {
	await TreeSitterExecutor.initTreeSitter();
	const { body, summary } = await capabilitiesAsHtml(new TreeSitterExecutor(), await knownNames());
	const page = template('landing-capabilities-template.html')
		.replaceAll('<!--SUMMARY-->', `${summary.fully} of ${summary.total} features fully, ${summary.partially} partially and ${summary.not} not supported.`)
		/* the body is spliced through a function, as a `$&` within it would otherwise expand to the placeholder */
		.replace('<!--CAPABILITIES-->', () => body);
	if(fs.existsSync(Target) && fs.readFileSync(Target, 'utf-8').includes('class="tests"') && !page.includes('class="tests"')) {
		console.warn(`\x1b[31mKeeping ${Target}, as the new page has no test summaries (run npm run test:full first).\x1b[m`);
		return;
	}
	console.log(`  wrote ${Target} (${(writePage(Target, page) / 1024).toFixed(1)} kB${committedNote(Target)})`);
}

void main();
