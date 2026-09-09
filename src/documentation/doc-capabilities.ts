import type { FlowrCapability } from '../r-bridge/data/types';
import { flowrCapabilities } from '../r-bridge/data/data';
import type { KnownParser } from '../r-bridge/parser';
import fs from 'fs';
import path from 'path';
import type { SerializedTestLabel, TestLabel } from '../../test/functionality/_helper/label';
import { FlowrGithubGroupName, flowrSourceFileUrl } from './doc-util/doc-files';
import { Playground } from '../util/text/playground-link';
import { OperatorDatabase } from '../r-bridge/lang-4.x/ast/model/operators';
import { highlightR, escapeHtml, type KnownNames } from '../util/text/r-highlight';
import { DefaultMap } from '../util/collections/defaultmap';

/* mutations suite writes its own file so the two test runs don't clobber each other */
const detailedInfoFiles = ['coverage/flowr-test-details.json', 'coverage/flowr-test-details-mutations.json'];
const testSourceFolders = ['test/functionality', 'test/mutations'];
/** how many tests we link as a demonstration of a single capability */
const maxSignatureTests = 3;

interface SignatureTest {
	readonly name:    string;
	readonly file:    string;
	readonly line:    number;
	/** how many capabilities the test claims, as one that claims few of them demonstrates each of them better */
	readonly claimed: number;
	/** true when the label array uses a spread we could not statically resolve */
	readonly opaque:  boolean;
}

/** the labeled tests of flowR, located in their sources so that we can link to the line they start at */
interface TestSourceIndex {
	readonly byCapability: DefaultMap<string, SignatureTest[]>;
	readonly byName:       DefaultMap<string, SignatureTest[]>;
}

interface CapabilityInformation {
	readonly parser:      KnownParser;
	readonly info:        DefaultMap<string, TestLabel[]> | undefined
	readonly tests:       TestSourceIndex
	/** known R names to link in the signature browser; omit or empty links none */
	readonly knownNames?: KnownNames
}

/**
 * matches `label('name', ['id', ...])`, the way a test claims the capabilities it demonstrates.
 * The array may contain a nested access like `OperatorDatabase['<-'].capabilities`, so we allow one level of brackets.
 */
const labelCallRegex = /\blabel\(\s*(['"`])((?:\\.|(?!\1)[^])*?)\1\s*,\s*\[((?:[^[\]]|\[[^[\]]*\])*)\]/g;
/** every quoted string in the label array */
const quotedStringRegex = /(['"])((?:\\.|(?!\1)[^])*?)\1/g;
/** matches `...OperatorDatabase['op'].capabilities` spreads in the array */
const operatorSpreadRegex = /\.{3}\s*OperatorDatabase\[\s*(['"])((?:\\.|(?!\1)[^])*?)\1\s*]\s*\.capabilities/g;

/** capability ids a label array claims, resolving any operator spreads */
function claimedCapabilities(array: string): { ids: string[], opaque: boolean } {
	const ids = [...array.matchAll(quotedStringRegex)].map(([,, id]) => id).filter(id => capabilityNames.has(id));
	for(const [, , operator] of array.matchAll(operatorSpreadRegex)) {
		ids.push(...OperatorDatabase[operator]?.capabilities ?? []);
	}
	return { ids: [...new Set(ids)], opaque: /\.{3}/.test(array.replace(operatorSpreadRegex, '')) };
}

function indexTestSources(): TestSourceIndex {
	const byCapability = new DefaultMap<string, SignatureTest[]>(() => []);
	const byName = new DefaultMap<string, SignatureTest[]>(() => []);
	for(const testSourceFolder of testSourceFolders) {
		if(!fs.existsSync(testSourceFolder)) {
			continue;
		}
		const files = fs.readdirSync(testSourceFolder, { recursive: true, encoding: 'utf-8' }).filter(f => f.endsWith('.ts')).sort();
		for(const file of files) {
			const content = fs.readFileSync(path.join(testSourceFolder, file), 'utf-8');
			for(const match of content.matchAll(labelCallRegex)) {
				const { ids, opaque } = claimedCapabilities(match[3]);
				const test: SignatureTest = {
					name:    match[2],
					file:    `${testSourceFolder}/${file.split(path.sep).join('/')}`,
					line:    content.slice(0, match.index).split('\n').length,
					claimed: ids.length,
					opaque
				};
				byName.get(test.name.toLowerCase()).push(test);
				for(const id of ids) {
					byCapability.get(id).push(test);
				}
			}
		}
	}
	return { byCapability, byName };
}

/** test name with template holes replaced by "..." since we can't run it */
function displayName(name: string): string {
	return name.replace(/\$\{[^}]*}/g, '...').trim();
}

/** the tests that claim the fewest capabilities, as those demonstrate the one at hand rather than a mix */
function pickSignatureTests(tests: readonly SignatureTest[]): SignatureTest[] {
	const unique = [...new Map(tests.map(t => [`${t.file}:${t.line}`, t])).values()];
	const literal = unique.filter(t => !t.name.includes('${'));
	/* skip names that are only a template hole, they identify nothing */
	const named = literal.length > 0 ? literal : unique.filter(t => /[A-Za-z0-9]/.test(displayName(t.name)));
	const picked = new Map<string, SignatureTest>();
	for(const test of named.sort((a, b) => a.claimed - b.claimed || a.name.length - b.name.length || a.file.localeCompare(b.file) || a.line - b.line)) {
		/* dedupe by display name, keep the first match */
		const key = displayName(test.name).toLowerCase();
		if(!picked.has(key)) {
			picked.set(key, test);
		}
	}
	return [...picked.values()].slice(0, maxSignatureTests);
}

/**
 * A capability may be claimed by a spread (e.g., `OperatorDatabase['<-'].capabilities`) which we can not
 * read from the sources, so we fall back to the recorded test runs and locate those tests by their name.
 */
function signatureTestsFor(info: CapabilityInformation, capability: FlowrCapability): SignatureTest[] {
	const direct = info.tests.byCapability.get(capability.id);
	if(direct.length > 0) {
		return pickSignatureTests(direct);
	}
	const byName: SignatureTest[] = [];
	for(const { name } of info.info?.get(capability.id) ?? []) {
		const locations = info.tests.byName.get(name);
		/* skip opaque tests, their name doesn't reliably match this capability */
		if(locations.length === 1 && !locations[0].opaque) {
			byName.push(locations[0]);
		}
	}
	return pickSignatureTests(byName);
}

function capabilitySearchUrl(id: string): string {
	return `https://github.com/search?q=${encodeURIComponent(`repo:${FlowrGithubGroupName}/flowr "'${id}'"`)}&type=code`;
}

/** capability id to name, for rendering links by name instead of raw id */
const capabilityNames: ReadonlyMap<string, string> = (() => {
	const names = new Map<string, string>();
	const walk = (capabilities: readonly FlowrCapability[]): void => {
		for(const capability of capabilities) {
			names.set(capability.id, capability.name);
			if(capability.capabilities) {
				walk(capability.capabilities);
			}
		}
	};
	walk(flowrCapabilities.capabilities);
	return names;
})();

/** renders a markdown link; a link to another capability shows its name, not its id */
function linkHtml(label: string, href: string): string {
	const name = href.startsWith('#') ? capabilityNames.get(href.slice(1)) : undefined;
	if(name === undefined) {
		return `<a href="${escapeHtml(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
	}
	const id = href.slice(1);
	/* label may include punctuation around the id, e.g. "function-definitions'" */
	const shown = label.includes(id) ? label.replace(id, escapeHtml(name)) : escapeHtml(name);
	return `<a class="capref" href="${escapeHtml(href)}" title="${id}">${shown}</a>`;
}

/**
 * The markdown a capability writes within a line, which is code spans, links and emphasis. A code span is put
 * aside while the rest is converted, as the `_` of a name like `new_environment` is no emphasis of its own.
 */
function inlineMarkdown(text: string): string {
	const spans: string[] = [];
	return escapeHtml(text)
		.replace(/(`+)([\s\S]+?)\1/g, (_, __: string, code: string) => `\0${spans.push(`<code>${code.replace(/^ (.*) $/s, '$1')}</code>`) - 1}\0`)
		.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_, label: string, href: string) => linkHtml(label, href))
		.replace(/(^|\s)_([^\n]+?)_(?=[\s.,;:)]|$)/g, (_, before: string, italic: string) => `${before}<em>${italic}</em>`)
		.replace(/\0(\d+)\0/g, (_, at: string) => spans[Number(at)]);
}

/** like {@link inlineMarkdown} but strips links, for text already inside a link */
function inlineText(text: string): string {
	return inlineMarkdown(text).replace(/<a\b[^>]*>|<\/a>/g, '');
}

/** references an icon symbol defined once in {@link iconDefs}; `.ico` gives it its size */
function icon(id: string): string {
	return `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
}

/** icon symbol defs, shared once instead of repeated per use */
const iconDefs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${
	Object.entries({
		'i-play':  '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
		'i-proof': '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
		'i-demo':  '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'
	}).map(([id, path]) => `<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</symbol>`).join('')
}</defs></svg>`;

/** renders a fenced block: mermaid diagram, highlighted+runnable R, or plain text */
function fencedHtml(language: string, code: string, knownNames?: KnownNames): string {
	if(language === 'mermaid') {
		return `<figure class="diagram"><pre class="mermaid">${escapeHtml(code)}</pre></figure>`;
	}
	if(language === 'r') {
		return `<figure class="code"><a class="try" href="${Playground.link({ code })}" target="_blank" rel="noopener"`
			+ `${iconLabel('open in the playground')}>${icon('i-play')}</a>`
			+ `<pre><code class="language-r">${highlightR(code, knownNames)}</code></pre></figure>`;
	}
	return `<figure class="code"><pre><code>${escapeHtml(code)}</code></pre></figure>`;
}

/** renders paragraphs, bullet lists, and raw html blocks (e.g. generated graphs) */
function textHtml(text: string): string {
	const out: string[] = [];
	for(const block of text.split(/\n[ \t]*\n/)) {
		const lines = block.split('\n').filter(l => l.trim().length > 0);
		if(lines.length === 0) {
			continue;
		}
		if(/^\s*</.test(lines[0])) {
			/* raw html block, e.g. a generated graph; pass through as-is */
			out.push(lines.join('\n'));
		} else if(/^\s*[-*]\s/.test(lines[0])) {
			const items: string[] = [];
			for(const line of lines) {
				if(/^\s*[-*]\s/.test(line)) {
					items.push(inlineMarkdown(line.replace(/^\s*[-*]\s/, '')));
				} else if(items.length > 0) {
					/* an indented line continues the bullet above it */
					items[items.length - 1] += ' ' + inlineMarkdown(line.trim());
				}
			}
			out.push(`<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`);
		} else {
			out.push(`<p>${lines.map(l => inlineMarkdown(l.trim())).join(' ')}</p>`);
		}
	}
	return out.join('\n');
}

/** renders an example's markdown: text, lists, highlighted R, and diagrams */
function exampleHtml(markdown: string, knownNames?: KnownNames): string {
	/* splitting on the fence alternates between the text around an example and the example itself */
	return markdown.split('```').map((block, at) => {
		const fenced = at % 2 === 1 ? /^(\w*)\n([\s\S]*?)\n?$/.exec(block) : null;
		return fenced === null ? textHtml(block) : fencedHtml(fenced[1], fenced[2], knownNames);
	}).filter(b => b.length > 0).join('\n');
}

function obtainDetailedInfos(): DefaultMap<string, TestLabel[]> | undefined {
	const out = new DefaultMap<string, TestLabel[]>(() => []);
	let foundAny = false;
	for(const file of detailedInfoFiles.filter(f => fs.existsSync(f))) {
		foundAny = true;
		const base = JSON.parse(fs.readFileSync(file).toString()) as [string, SerializedTestLabel[]][];
		for(const [key, values] of base) {
			out.get(key).push(...values.map(v => ({ ...v, capabilities: new Set(v.capabilities), context: new Set(v.context) } satisfies TestLabel)));
		}
	}
	return foundAny ? out : undefined;
}

/** contexts shown before the rest collapse into "and N more" */
const shownContextCount = 3;

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
	const contexts = [...grouped.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([context, count]) => `${count} ${context}`);
	const where = contexts.length === 0 ? 'every test that claims this id' : `where they run: ${contexts.join(', ')}`;
	const rest = contexts.length - shownContextCount;
	const shown = rest <= 0 ? contexts.join(', ') : `${contexts.slice(0, shownContextCount).join(', ')} and ${rest} more`;
	return `<a class="tests" href="${capabilitySearchUrl(capability.id)}" title="${escapeHtml(where)}">${unique.length} test${unique.length === 1 ? '' : 's'}</a>`
		+ (contexts.length === 0 ? '' : `<span class="ctx"${rest > 0 ? ` title="${escapeHtml(where)}"` : ''}>${escapeHtml(shown)}</span>`);
}

/** title + aria-label for an icon control, from one string */
function iconLabel(what: string): string {
	return ` title="${escapeHtml(what)}" aria-label="${escapeHtml(what)}"`;
}

/** collapsible wrapper so tests/example don't crowd the description */
function foldHtml(cssClass: string, icon: string, tooltip: string, label: string, content: string, open = false): string {
	return `<details class="${cssClass}"${open ? ' open' : ''}><summary title="${escapeHtml(tooltip)}">${icon}<span>${label}</span></summary>${content}</details>`;
}

function signatureTestsHtml(info: CapabilityInformation, capability: FlowrCapability): string {
	const tests = signatureTestsFor(info, capability);
	if(tests.length === 0) {
		return '';
	}
	const links = tests.map(t => {
		const name = displayName(t.name);
		return `<a href="${flowrSourceFileUrl(t.file)}#L${t.line}">${escapeHtml(name.length > 72 ? name.slice(0, 69) + '...' : name)}</a>`;
	});
	return foldHtml('proof', icon('i-proof'), 'the tests that demonstrate this capability', 'signature tests', `<p>${links.join(', ')}</p>`);
}

/** the three support states, in the order every meter, tally and count row lists them */
const supportStates = ['fully', 'partially', 'not'] as const;

type ChildrenSummary = Record<typeof supportStates[number], number>;

/** how many capabilities the summary covers */
function totalOf(summary: ChildrenSummary): number {
	return summary.fully + summary.partially + summary.not;
}

function summarizeChildren(capabilities: readonly FlowrCapability[]): ChildrenSummary {
	const summary: ChildrenSummary = { fully: 0, partially: 0, not: 0 };
	for(const capability of capabilities) {
		if(capability.capabilities) {
			const child = summarizeChildren(capability.capabilities);
			for(const key of supportStates) {
				summary[key] += child[key];
			}
		}
		if(capability.supported) {
			summary[capability.supported]++;
		}
	}
	return summary;
}

/** the summary of a capability's children, or of the capability itself when it has none */
function summaryOf(capability: FlowrCapability): ChildrenSummary {
	return summarizeChildren(capability.capabilities ?? [capability]);
}

/** minimum R version badge, for capabilities R gained later */
function versionHtml(capability: FlowrCapability): string {
	return capability.minRVersion === undefined ? ''
		: `<span class="since" title="R ${escapeHtml(capability.minRVersion)} or newer is needed for this">R ${escapeHtml(capability.minRVersion)}+</span>`;
}

/** classifies a reference url: language docs, book, source, or issue */
const referenceKinds: readonly { readonly match: RegExp, readonly kind: string }[] = [
	{ match: /adv-r\.hadley\.nz/, kind: 'advr' },
	{ match: /cran\.r-project\.org\/doc\/manuals/, kind: 'rlang' },
	/* flowr source links point at implementing code, not an issue */
	{ match: /github\.com\/[^/]+\/flowr\/(?:blob|tree)\//, kind: 'flowr' },
	{ match: /github\.com/, kind: 'issue' }
];

/** renders reference urls as pills labeled by source */
function referencesHtml(capability: FlowrCapability): string {
	if(capability.url === undefined || capability.url.length === 0) {
		return '';
	}
	const pills = capability.url.map(({ name, href }) => {
		const kind = referenceKinds.find(k => k.match.test(href))?.kind ?? 'link';
		const at = name.indexOf('/');
		const label = at === -1 ? escapeHtml(name)
			: `<span class="src">${escapeHtml(name.slice(0, at))}</span><span class="sec">${escapeHtml(name.slice(at + 1))}</span>`;
		return `<a class="ref ${kind}" href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>`;
	});
	return `<p class="refs">${pills.join('')}</p>`;
}

/** summary sentence used as tooltip by meterHtml and summaryPills */
function summarySentence(summary: ChildrenSummary): string {
	return supportStates.map(state => `${summary[state]} ${state}`).join(', ') + ' supported';
}

/** support bar for a group, readable without counting */
function meterHtml(summary: ChildrenSummary): string {
	const total = totalOf(summary);
	const share = (n: number) => total === 0 ? 0 : (n / total * 100).toFixed(1);
	return `<span class="meter" role="img" aria-label="${summarySentence(summary)}">`
		+ supportStates.map(state => `<span class="${state}" style="width:${share(summary[state])}%"></span>`).join('')
		+ '</span>';
}

/** support counts as pills; without room for labels (`tally-mini`) the sentence becomes the tooltip */
function summaryPills(summary: ChildrenSummary, variant: 'counts' | 'tally-mini'): string {
	const withLabel = variant === 'counts';
	return `<span class="${variant}"${withLabel ? '' : ` title="${summarySentence(summary)}"`}>`
		+ supportStates.map(state => `<span class="c ${state}">${summary[state]}${withLabel ? ' ' + state : ''}</span>`).join('')
		+ '</span>';
}

/** the example a capability carries, already rendered */
async function exampleOf(info: CapabilityInformation, capability: FlowrCapability): Promise<string> {
	if(!capability.example) {
		return '';
	}
	const example = typeof capability.example === 'string' ? capability.example : await capability.example(info.parser);
	return exampleHtml(example, info.knownNames);
}

/** references and example folded together on one line */
async function metaHtml(info: CapabilityInformation, capability: FlowrCapability): Promise<string> {
	const refs = referencesHtml(capability);
	const example = await exampleOf(info, capability);
	if(refs === '' && example === '') {
		return '';
	}
	const shown = `<div class="example">${example}</div>`;
	if(refs === '') {
		return shown;
	}
	const fold = example === '' ? '' : foldHtml('demo', icon('i-demo'), 'an example of this capability', 'example', shown, true);
	return `<div class="meta">${refs}${fold}</div>`;
}

/** lowercase name+id, used as the search-filter key */
function searchKey(capability: FlowrCapability): string {
	return escapeHtml((capability.name + ' ' + capability.id).toLowerCase());
}

async function capabilityHtml(info: CapabilityInformation, capability: FlowrCapability, extra = false, depth = 0): Promise<string> {
	const support = capability.supported;
	const parts = [
		`<div class="head"><a class="anchor" href="#${capability.id}"${iconLabel('link to this capability')}>#</a>`,
		support ? `<span class="badge ${support}" title="${support} supported"></span>` : '',
		`<span class="name" id="${capability.id}" title="${escapeHtml(capability.id)}">${escapeHtml(capability.name)}</span>`,
		versionHtml(capability),
		testDetails(info, capability),
		signatureTestsHtml(info, capability),
		'</div>',
		capability.description ? `<p class="desc">${inlineMarkdown(capability.description)}</p>` : '',
		await metaHtml(info, capability)
	];
	if(capability.capabilities) {
		const summary = summarizeChildren(capability.capabilities);
		const total = totalOf(summary);
		parts.push(`<details${depth < openDepth ? ' open' : ''}><summary>${total} child${total === 1 ? '' : 'ren'}${meterHtml(summary)}${summaryPills(summary, 'tally-mini')}</summary>`);
		parts.push(await capabilitiesHtml(info, capability.capabilities, true, depth + 1));
		parts.push('</details>');
	}
	return `<li class="cap${extra ? ' extra' : ''}" data-supported="${support ?? 'group'}" data-name="${searchKey(capability)}">`
		+ parts.filter(p => p.length > 0).join('\n') + '</li>';
}

/** children shown before collapsing behind "show more" */
const shownChildren = 8;

/** depth at which nested groups start collapsed */
const openDepth = 2;

async function capabilitiesHtml(info: CapabilityInformation, capabilities: readonly FlowrCapability[], collapse = true, depth = 0): Promise<string> {
	const items = [];
	for(const capability of capabilities) {
		items.push(await capabilityHtml(info, capability, collapse && items.length >= shownChildren, depth));
	}
	const hidden = collapse ? items.length - shownChildren : 0;
	return `<ul class="caps"${hidden > 0 ? ' data-collapsed="yes"' : ''}>${items.join('\n')}</ul>`
		+ (hidden > 0 ? `<button type="button" class="more">show ${hidden} more</button>` : '');
}

/** groups named on an overview card before the rest collapse */
const shownGroups = 7;

/** lists a category's subgroups on its overview card */
function groupsHtml(capability: FlowrCapability): string {
	const groups = (capability.capabilities ?? []).filter(c => c.capabilities !== undefined);
	if(groups.length === 0) {
		return '';
	}
	const shown = groups.slice(0, shownGroups)
		.map(g => `<a href="#${g.id}">${escapeHtml(g.name)}</a>`);
	const rest = groups.length - shown.length;
	return `<p class="subs">${shown.join('')}${rest > 0 ? `<span class="rest">and ${rest} more</span>` : ''}</p>`;
}

/** overview card for a category, linking into its full view */
function cardHtml(capability: FlowrCapability): string {
	const summary = summaryOf(capability);
	const total = totalOf(summary);
	const about = capability.description ? inlineText(capability.description) : '';
	return `<div class="card" data-name="${searchKey(capability)}">`
		+ `<span class="total" title="${total} capabilities in this category">${total}</span>`
		+ `<h3><a href="#${capability.id}">${escapeHtml(capability.name)}</a></h3>`
		+ (about === '' ? '' : `<p class="sum">${about}</p>`)
		+ groupsHtml(capability)
		+ `<span class="foot">${meterHtml(summary)}${summaryPills(summary, 'counts')}</span></div>`;
}

/** a category in full, shown once someone picks it on the overview */
async function categoryHtml(info: CapabilityInformation, capability: FlowrCapability): Promise<string> {
	const summary = summaryOf(capability);
	const parts = [
		'<p class="crumbs"><a href="#" class="back">All categories</a></p>',
		`<h2 id="${capability.id}" title="${escapeHtml(capability.id)}">${escapeHtml(capability.name)}`
			+ versionHtml(capability) + testDetails(info, capability) + '</h2>',
		`<p class="tally">${meterHtml(summary)}${summaryPills(summary, 'counts')}</p>`,
		capability.description ? `<p class="desc">${inlineMarkdown(capability.description)}</p>` : '',
		referencesHtml(capability),
		signatureTestsHtml(info, capability),
		await exampleOf(info, capability)
	];
	if(capability.capabilities) {
		parts.push(await capabilitiesHtml(info, capability.capabilities, false));
	}
	return `<section class="cat" data-id="${capability.id}" data-name="${searchKey(capability)}" hidden>`
		+ parts.filter(p => p.length > 0).join('\n') + '</section>';
}

/**
 * The content of the capabilities page, dropped into `scripts/landing-capabilities-template.html`.
 * Renders a card per category plus each category's full view, swapped in by id.
 */
export async function capabilitiesAsHtml(parser: KnownParser, knownNames?: KnownNames): Promise<{ body: string, summary: ChildrenSummary & { total: number } }> {
	if(!detailedInfoFiles.some(f => fs.existsSync(f))) {
		console.warn('\x1b[31mNo detailed test data available. Run the full tests (npm run test:full) to generate it.\x1b[m');
	}
	const info: CapabilityInformation = { parser, info: obtainDetailedInfos(), tests: indexTestSources(), knownNames };
	const categories: readonly FlowrCapability[] = flowrCapabilities.capabilities;
	const cards = categories.map(c => cardHtml(c));
	const sections = [];
	for(const category of categories) {
		sections.push(await categoryHtml(info, category));
	}
	const summary = summarizeChildren(categories);
	return {
		body:    `${iconDefs}<section id="overview"><div class="cards">${cards.join('')}</div></section>\n${sections.join('\n')}`,
		summary: { ...summary, total: totalOf(summary) }
	};
}
