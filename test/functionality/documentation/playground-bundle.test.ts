import { beforeAll, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { bundlePlayground, playgroundPage } from '../../../scripts/gen-playground';
import { DefaultBuiltinConfig } from '../../../src/dataflow/environments/default-builtin-config';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { Playground, type PlaygroundLinkParts } from '../../../src/util/text/playground-link';

function builtinExports(): string {
	const out: Record<string, string[]> = {};
	for(const id of DefaultBuiltinConfig.flatMap(d => d.names)) {
		const pkg = Identifier.getNamespace(id);
		if(pkg !== undefined) {
			(out[String(pkg)] ??= ['1.0.0', '2025-01-01']).push(String(Identifier.getName(id)));
		}
	}
	return JSON.stringify(out);
}

/** the playground as a browser shows it, opened on what a link says, with every error the page runs into */
interface Page {
	readonly document: Document
	readonly errors:   string[]
	/** waits until the page shows what `check` asks for */
	until(check: () => void): Promise<void>
	/** the text of the editor, line by line */
	code(): string
	close(): void
}

describe('playground', { concurrent: false }, () => {
	let code: string | undefined;
	beforeAll(async() => {
		code = (await bundlePlayground()).outputFiles?.find(f => f.path.endsWith('.js'))?.text;
	}, 5 * 60 * 1000);

	async function open(link: PlaygroundLinkParts | string = {}): Promise<Page> {
		const errors: string[] = [];
		const virtualConsole = new VirtualConsole();
		virtualConsole.on('jsdomError', e => errors.push(e.cause instanceof Error ? String(e.cause) : e.message));
		virtualConsole.on('error', (...args: unknown[]) => errors.push(args.map(String).join(' ')));
		const { window } = new JSDOM(playgroundPage('', builtinExports(), 0).replace('<script src="bundle.js"></script>', ''), {
			url:               typeof link === 'string' ? link : Object.keys(link).length === 0 ? Playground.BaseRef : Playground.link(link),
			runScripts:        'dangerously',
			pretendToBeVisual: true,
			virtualConsole,
			beforeParse(window) {
				window.matchMedia = (media: string) => ({ media, matches: false, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false });
				Object.assign(window, { fetch, Request, Response, Headers, structuredClone, ResizeObserver: class {
					observe() { /* empty */ }
					unobserve() { /* empty */ }
					disconnect() { /* empty */ }
				} });
				window.Element.prototype.scrollIntoView = () => undefined;
				window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
				window.Range.prototype.getBoundingClientRect = () => window.document.body.getBoundingClientRect();
				/* what a click asks of the page beyond it is answered, and so is every question it asks before going on */
				Object.assign(window, { confirm: () => true });
			}
		});
		window.addEventListener('error', e => errors.push(String(e.error ?? e.message)));
		window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
		const document = window.document;
		const until = (check: () => void) => vi.waitFor(check, { timeout: 60_000, interval: 100 });
		expect(code).toBeDefined();
		window.eval(code as string);
		await until(() => expect(document.getElementById('took')?.textContent ?? '').toMatch(/^analyzed in/));
		return {
			document, errors, until,
			code:  () => [...document.querySelectorAll('#editor .cm-line')].map(line => line.textContent).join('\n'),
			close: () => window.close()
		};
	}

	/** what the slice box of the panel shows */
	const sliced = (page: Page) => page.document.querySelector('#panel .slines')?.textContent ?? '';

	/*
	 * Links people put into papers and mails have to open as they did for as long as the page exists, so these are
	 * frozen as written, not built by the code that writes them now: a change to the format has to read them all still.
	 */
	describe('links of every version so far still open as they were sent', () => {
		test('a script, its cursor, a mark, a folded box, the view, and a changed configuration', async() => {
			const page = await open('https://flowr-analysis.github.io/flowr/wiki/playground/#c=teCA8LSAxCnkgPC0geCArIDEKcHJpbnQoeSk&k=tc29sdmVyLnNsaWNpbmcudGhyZXNob2xkPTEw&h=2@x&f=lints&v=,,%3Eda&p=3:1');
			expect(page.code()).toBe('x <- 1\ny <- x + 1\nprint(y)');
			expect(page.document.querySelector('#editor .cm-activeLine')?.textContent).toBe('print(y)');
			expect(page.document.querySelector('#editor .cm-shown')?.textContent).toBe('x');
			expect(page.document.querySelector('#panel h3[data-fold="lints"]')?.classList.contains('folded')).toBe(true);
			expect(page.document.querySelector('#panel .ways .way[aria-pressed="true"]')?.textContent).toBe('impact');
			expect(page.document.querySelector<HTMLInputElement>('#panel .switch input')?.checked).toBe(true);
			/* the configuration differs from the defaults, which is when the page offers to go back to them */
			expect(page.document.getElementById('configreset')?.hidden).toBe(false);
			page.close();
			expect(page.errors).toEqual([]);
		}, 5 * 60 * 1000);
		test('a project of several files', async() => {
			const page = await open('https://flowr-analysis.github.io/flowr/wiki/playground/#c=tc291cmNlKCJoZWxwZXJzLlIiKQpwcmludCh0d2ljZSgyKSk&o=tW1siaGVscGVycy5SIiwidHdpY2UgPC0gZnVuY3Rpb24oeCkgeCAqIDIiXV0&p=2:1');
			expect(page.code()).toBe('source("helpers.R")\nprint(twice(2))');
			expect([...page.document.querySelectorAll('#files .tab')].map(t => t.textContent?.replace(/[\u270E x]+$/u, ''))).toEqual(['main.R']);
			page.document.getElementById('treetoggle')?.click();
			expect([...page.document.querySelectorAll('#tree .file:not(.settings):not(.example) .tname')].map(t => t.textContent)).toEqual(['helpers.R', 'main.R']);
			page.close();
			expect(page.errors).toEqual([]);
		}, 5 * 60 * 1000);
		test('a script too long to send uncompressed, and the sizes of the panes spelled out with their units', async() => {
			const page = await open('https://flowr-analysis.github.io/flowr/wiki/playground/#c=zG4BgBAPAtG4NSwFDAIyRmhLkCZ1jwR2QGZ8yETkAWfWha5AVnxYSeQDZ9uFPkA7PiEIByABz5JCccgCc+BQjnIU4aGDVgsIVWg0pMm7KjwHCm4qjIGKmqqloH6mxqhYG2mjqm4HemvyoQgYimmKokgbSmrKoCgZKmirAOOowadoEuqn6GUY4JjhmGRbFuDYZdjgOOE4ZLnW4HhleOD44fhkBnbghGWE4EThRGTEjuAkZSTgqAA4ATgCWAHYALgAUqXIAlEA&v=40%25,200px');
			expect(page.code()).toBe(`${Array.from({ length: 30 }, (_, i) => `v${i} <- ${i} + ${i}`).join('\n')}\nprint(v29)`);
			expect(page.document.documentElement.style.getPropertyValue('--split')).toBe('40%');
			page.close();
			expect(page.errors).toEqual([]);
		}, 5 * 60 * 1000);
	});

	test('loads and analyzes the sample without errors', async() => {
		const page = await open();
		page.close();
		expect(page.errors).toEqual([]);
	}, 5 * 60 * 1000);

	test('a finding says what its rule looks for and shows its fix as a diff before carrying it out', async() => {
		const page = await open();
		const row = page.document.querySelector<HTMLElement>('#panel .lint');
		expect(row?.querySelector('.rule')?.textContent).toContain('unused-definitions');
		row?.click();
		const details = page.document.querySelector('#panel .lintmore');
		expect(details?.textContent).toContain('Finds definitions that are never used');
		expect(details?.querySelector('.del')?.textContent).toMatch(/^- unused_total/);
		details?.querySelector<HTMLElement>('.fix')?.click();
		await page.until(() => expect(page.code()).not.toContain('unused_total'));
		page.close();
		expect(page.errors).toEqual([]);
	}, 5 * 60 * 1000);

	test('a project opens its files from the tree, and its slice keeps them apart or splices them in under banners', async() => {
		const page = await open({
			files: [{ name: 'helpers.R', code: 'twice <- function(x) x * 2' }],
			code:  'source("helpers.R")\nprint(twice(2))',
			at:    '2@print'
		});
		await page.until(() => expect([...page.document.querySelectorAll('#panel .slines .scell')].map(h => h.textContent)).toEqual(['helpers.R', 'main.R']));
		expect(sliced(page)).toContain('source(');
		[...page.document.querySelectorAll<HTMLElement>('#panel .way')].find(b => b.textContent === 'inline source()')?.click();
		await page.until(() => expect(sliced(page)).toContain('# ---- helpers.R ----'));
		expect(sliced(page)).toContain('twice <- function(x) x * 2');
		expect(sliced(page)).not.toContain('source(');
		page.document.getElementById('treetoggle')?.click();
		const row = [...page.document.querySelectorAll<HTMLElement>('#tree .file')].find(r => r.textContent?.startsWith('helpers.R'));
		row?.click();
		await page.until(() => expect(page.code()).toBe('twice <- function(x) x * 2'));
		expect([...page.document.querySelectorAll('#files .tab')].map(t => t.textContent?.replace(/[✎ x]+$/u, ''))).toEqual(['main.R', 'helpers.R']);
		page.close();
		expect(page.errors).toEqual([]);
	}, 5 * 60 * 1000);

	test('a document becomes its slice with its front matter, prose, and cell options kept', async() => {
		const document = fs.readFileSync('scripts/playground/examples/analysis.qmd', 'utf8');
		const page = await open({ name: 'analysis.qmd', code: document, at: '24@abline' });
		await page.until(() => expect(page.document.querySelector('#panel .scell')?.textContent).toBe('cell 1 · fit'));
		page.document.querySelector<HTMLElement>('#panel .sadopt')?.click();
		await page.until(() => expect(page.code()).not.toContain('summary(fit)'));
		const left = page.code();
		for(const kept of ['title: "Cars"', '## Stopping distance', '#| label: fit', 'fit <- lm(dist ~ speed, data = cars)', '#| label: plot', 'abline(fit)']) {
			expect(left).toContain(kept);
		}
		expect(left).not.toContain('#| eval: false');
		page.close();
		expect(page.errors).toEqual([]);
	}, 5 * 60 * 1000);
});
