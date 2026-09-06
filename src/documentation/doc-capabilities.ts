import type { FlowrCapability } from '../r-bridge/data/types';
import { flowrCapabilities } from '../r-bridge/data/data';
import type { KnownParser } from '../r-bridge/parser';
import fs from 'fs';
import path from 'path';
import type { SerializedTestLabel, TestLabel } from '../../test/functionality/_helper/label';
import { FlowrGithubGroupName, flowrSourceFileUrl } from './doc-util/doc-files';
import { Playground } from '../util/text/playground-link';

const detailedInfoFile = 'coverage/flowr-test-details.json';
const testSourceFolder = 'test/functionality';
/** how many tests we link as a demonstration of a single capability */
const maxSignatureTests = 3;

interface SignatureTest {
	readonly name:    string;
	readonly file:    string;
	readonly line:    number;
	/** how many capabilities the test claims, as one that claims few of them demonstrates each of them better */
	readonly claimed: number;
}

/** the labeled tests of flowR, located in their sources so that we can link to the line they start at */
interface TestSourceIndex {
	readonly byCapability: Map<string, SignatureTest[]>;
	readonly byName:       Map<string, SignatureTest[]>;
}

interface CapabilityInformation {
	readonly parser: KnownParser;
	readonly info:   Map<string, TestLabel[]> | undefined
	readonly tests:  TestSourceIndex
}

/**
 * matches `label('name', ['id', ...])`, the way a test claims the capabilities it demonstrates.
 * The array may contain a nested access like `OperatorDatabase['<-'].capabilities`, so we allow one level of brackets.
 */
const labelCallRegex = /\blabel\(\s*(['"`])((?:\\.|(?!\1)[^])*?)\1\s*,\s*\[((?:[^[\]]|\[[^[\]]*\])*)\]/g;
const capabilityIdRegex = /(['"])([A-Za-z0-9:_-]+)\1/g;

function pushTest(map: Map<string, SignatureTest[]>, key: string, test: SignatureTest): void {
	const existing = map.get(key) ?? [];
	existing.push(test);
	map.set(key, existing);
}

function indexTestSources(): TestSourceIndex {
	const byCapability = new Map<string, SignatureTest[]>();
	const byName = new Map<string, SignatureTest[]>();
	if(!fs.existsSync(testSourceFolder)) {
		return { byCapability, byName };
	}
	const files = fs.readdirSync(testSourceFolder, { recursive: true, encoding: 'utf-8' }).filter(f => f.endsWith('.ts')).sort();
	for(const file of files) {
		const content = fs.readFileSync(path.join(testSourceFolder, file), 'utf-8');
		for(const match of content.matchAll(labelCallRegex)) {
			const ids = [...match[3].matchAll(capabilityIdRegex)].map(([,, id]) => id);
			const test: SignatureTest = {
				name:    match[2],
				file:    `${testSourceFolder}/${file.split(path.sep).join('/')}`,
				line:    content.slice(0, match.index).split('\n').length,
				claimed: ids.length
			};
			pushTest(byName, test.name.toLowerCase(), test);
			for(const id of ids) {
				pushTest(byCapability, id, test);
			}
		}
	}
	return { byCapability, byName };
}

/** the tests that claim the fewest capabilities, as those demonstrate the one at hand rather than a mix */
function pickSignatureTests(tests: readonly SignatureTest[]): SignatureTest[] {
	const unique = [...new Map(tests.map(t => [`${t.file}:${t.line}`, t])).values()];
	const literal = unique.filter(t => !t.name.includes('${'));
	return (literal.length > 0 ? literal : unique)
		.sort((a, b) => a.claimed - b.claimed || a.name.length - b.name.length || a.file.localeCompare(b.file) || a.line - b.line)
		.slice(0, maxSignatureTests);
}

/**
 * A capability may be claimed by a spread (e.g., `OperatorDatabase['<-'].capabilities`) which we can not
 * read from the sources, so we fall back to the recorded test runs and locate those tests by their name.
 */
function signatureTestsFor(info: CapabilityInformation, capability: FlowrCapability): SignatureTest[] {
	const direct = info.tests.byCapability.get(capability.id);
	if(direct) {
		return pickSignatureTests(direct);
	}
	const byName: SignatureTest[] = [];
	for(const { name } of info.info?.get(capability.id) ?? []) {
		const locations = info.tests.byName.get(name);
		if(locations && locations.length === 1) {
			byName.push(locations[0]);
		}
	}
	return pickSignatureTests(byName);
}

function capabilitySearchUrl(id: string): string {
	return `https://github.com/search?q=${encodeURIComponent(`repo:${FlowrGithubGroupName}/flowr "'${id}'"`)}&type=code`;
}

const supportedLabel = {
	not:       'not supported',
	partially: 'partially supported',
	fully:     'fully supported'
} as const;

function escapeHtml(text: string): string {
	return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/**
 * The markdown a capability writes within a line, which is code spans, links and emphasis. A code span is put
 * aside while the rest is converted, as the `_` of a name like `new_environment` is no emphasis of its own.
 */
function inlineMarkdown(text: string): string {
	const spans: string[] = [];
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, (_, code: string) => `\0${spans.push(`<code>${code}</code>`) - 1}\0`)
		.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_, label: string, href: string) => `<a href="${href}">${label}</a>`)
		.replace(/(^|\s)_([^_\n]+)_/g, (_, before: string, italic: string) => `${before}<em>${italic}</em>`)
		.replace(/\0(\d+)\0/g, (_, at: string) => spans[Number(at)]);
}

/** an R example is shown as it is written and opens in the playground, everything around it stays text */
function exampleHtml(markdown: string): string {
	/* splitting on the fence alternates between the text around an example and the example itself */
	return markdown.split('```').map((block, at) => {
		const fenced = at % 2 === 1 ? /^(\w*)\n([\s\S]*?)\n?$/.exec(block) : null;
		if(fenced !== null) {
			const run = fenced[1] === 'r' ? `<a class="try" href="${Playground.link({ code: fenced[2] })}">explore in the playground</a>` : '';
			return `<pre><code>${escapeHtml(fenced[2])}</code></pre>${run}`;
		}
		return block.split('\n').filter(l => l.trim().length > 0)
			.map(line => /^\s*[-*]\s/.test(line) ? `<li>${inlineMarkdown(line.replace(/^\s*[-*]\s/, ''))}</li>` : `<p>${inlineMarkdown(line)}</p>`)
			.join('\n').replace(/(<li>[\s\S]*<\/li>)/, '<ul>$1</ul>');
	}).join('\n');
}

function obtainDetailedInfos(): Map<string, TestLabel[]> | undefined {
	if(!fs.existsSync(detailedInfoFile)) {
		return undefined;
	}
	const content = fs.readFileSync(detailedInfoFile).toString();
	const base = JSON.parse(content) as [string, SerializedTestLabel[]][];
	const out = new Map<string, TestLabel[]>();
	for(const [key, values] of base) {
		out.set(key, values.map(v => ({
			id:           v.id,
			name:         v.name,
			capabilities: new Set(v.capabilities),
			context:      new Set(v.context)
		} satisfies TestLabel)));
	}
	return out;
}

/** how many tests claim the capability, linking to all of them, and in which contexts they check it */
function testDetails(info: CapabilityInformation, capability: FlowrCapability): string {
	const unique = info.info?.get(capability.id)?.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
	if(unique === undefined || unique.length === 0) {
		return '';
	}
	const grouped = new Map<string, number>();
	for(const { context } of unique) {
		for(const c of context) {
			grouped.set(c, (grouped.get(c) ?? 0) + 1);
		}
	}
	/* both desugar contexts check the same thing on the two engines, so they are one number */
	if(grouped.get('desugar-tree-sitter') !== undefined && grouped.get('desugar-tree-sitter') === grouped.get('desugar-shell')) {
		grouped.set('desugar', grouped.get('desugar-tree-sitter') ?? 0);
		grouped.delete('desugar-shell');
		grouped.delete('desugar-tree-sitter');
	}
	grouped.delete('other');
	const contexts = [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([context, count]) => `${context}: ${count}`);
	return `<a class="tests" href="${capabilitySearchUrl(capability.id)}" title="${escapeHtml(contexts.join(', '))}">${unique.length} test${unique.length === 1 ? '' : 's'}</a>`;
}

function signatureTestsHtml(info: CapabilityInformation, capability: FlowrCapability): string {
	const tests = signatureTestsFor(info, capability);
	return tests.length === 0 ? ''
		: `<p class="proof">Signature tests: ${tests.map(t => `<a href="${flowrSourceFileUrl(t.file)}#L${t.line}">${escapeHtml(t.name.length > 72 ? t.name.slice(0, 69) + '...' : t.name)}</a>`).join(', ')}</p>`;
}

interface ChildrenSummary {
	total:     number;
	fully:     number;
	partially: number;
	not:       number;
}

function summarizeChildren(capabilities: readonly FlowrCapability[]): ChildrenSummary {
	const summary: ChildrenSummary = { total: 0, fully: 0, partially: 0, not: 0 };
	for(const capability of capabilities) {
		if(capability.capabilities) {
			const child = summarizeChildren(capability.capabilities);
			summary.fully += child.fully;
			summary.partially += child.partially;
			summary.not += child.not;
			summary.total += child.total;
		}
		if(capability.supported) {
			summary[capability.supported]++;
			summary.total++;
		}
	}
	return summary;
}

async function capabilityHtml(info: CapabilityInformation, capability: FlowrCapability): Promise<string> {
	const support = capability.supported;
	const parts = [
		`<div class="head"><span class="name" id="${capability.id}">${escapeHtml(capability.name)}</span>`,
		`<a class="anchor" href="#${capability.id}" title="link to this capability">#</a>`,
		`<code class="cid" title="the id a labeled test uses">${escapeHtml(capability.id)}</code>`,
		testDetails(info, capability),
		'</div>'
	];
	if(capability.description) {
		parts.push(`<p class="desc">${inlineMarkdown(capability.description)}</p>`);
	}
	if(capability.url) {
		parts.push(`<p class="see">See ${capability.url.map(({ name, href }) => `<a href="${href}">${escapeHtml(name)}</a>`).join(', ')} for more info.</p>`);
	}
	parts.push(signatureTestsHtml(info, capability));
	if(capability.example) {
		parts.push(`<div class="example">${exampleHtml(typeof capability.example === 'string' ? capability.example : await capability.example(info.parser))}</div>`);
	}
	if(capability.capabilities) {
		const summary = summarizeChildren(capability.capabilities);
		parts.push(`<details open><summary>${summary.total} child${summary.total === 1 ? '' : 'ren'}: ${summary.fully} fully, ${summary.partially} partially, ${summary.not} not supported</summary>`);
		parts.push(await capabilitiesHtml(info, capability.capabilities));
		parts.push('</details>');
	}
	return `<li class="cap" data-supported="${support ?? 'group'}" data-name="${escapeHtml((capability.name + ' ' + capability.id).toLowerCase())}">`
		+ (support ? `<span class="badge ${support}" title="${supportedLabel[support]}"></span>` : '')
		+ parts.filter(p => p.length > 0).join('\n') + '</li>';
}

async function capabilitiesHtml(info: CapabilityInformation, capabilities: readonly FlowrCapability[]): Promise<string> {
	const items = [];
	for(const capability of capabilities) {
		items.push(await capabilityHtml(info, capability));
	}
	return `<ul class="caps">${items.join('\n')}</ul>`;
}

/**
 * The content of the capabilities page, ready to be dropped into `scripts/landing-capabilities-template.html`.
 * Every capability comes with what flowR states about it, the tests that demonstrate it, and its example.
 */
export async function capabilitiesAsHtml(parser: KnownParser): Promise<{ body: string, summary: ChildrenSummary }> {
	if(!fs.existsSync(detailedInfoFile)) {
		console.warn('\x1b[31mNo detailed test data available. Run the full tests (npm run test:full) to generate it.\x1b[m');
	}
	const info = { parser, info: obtainDetailedInfos(), tests: indexTestSources() };
	return {
		body:    await capabilitiesHtml(info, flowrCapabilities.capabilities),
		summary: summarizeChildren(flowrCapabilities.capabilities)
	};
}
