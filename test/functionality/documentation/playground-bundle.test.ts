import { describe, expect, test, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { bundlePlayground, playgroundPage } from '../../../scripts/gen-playground';
import { DefaultBuiltinConfig } from '../../../src/dataflow/environments/default-builtin-config';
import { Identifier } from '../../../src/dataflow/environments/identifier';

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

describe('playground bundle', () => {
	test('loads and analyzes the sample in a browser without errors', async() => {
		const { outputFiles } = await bundlePlayground();
		const code = outputFiles?.find(f => f.path.endsWith('.js'))?.text;
		expect(code).toBeDefined();
		const errors: string[] = [];
		const virtualConsole = new VirtualConsole();
		virtualConsole.on('jsdomError', e => errors.push(e.cause instanceof Error ? String(e.cause) : e.message));
		virtualConsole.on('error', (...args: unknown[]) => errors.push(args.map(String).join(' ')));
		const { window } = new JSDOM(playgroundPage('', builtinExports(), 0).replace('<script src="bundle.js"></script>', ''), {
			url:               'https://flowr-analysis.github.io/flowr/wiki/playground/',
			runScripts:        'dangerously',
			pretendToBeVisual: true,
			virtualConsole,
			beforeParse(window) {
				window.matchMedia = (media: string) => ({ media, matches: false, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false });
				Object.assign(window, { fetch, Request, Response, Headers, ResizeObserver: class {
					observe() { /* empty */ }
					unobserve() { /* empty */ }
					disconnect() { /* empty */ }
				} });
				window.Element.prototype.scrollIntoView = () => undefined;
				window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
				window.Range.prototype.getBoundingClientRect = () => window.document.body.getBoundingClientRect();
			}
		});
		window.addEventListener('error', e => errors.push(String(e.error ?? e.message)));
		window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
		const took = () => window.document.getElementById('took')?.textContent ?? '';
		let status = '';
		try {
			window.eval(code as string);
			await vi.waitFor(() => expect(took()).not.toMatch(/^analyzing|^$/), { timeout: 60_000, interval: 100 });
			status = took();
		} catch(e) {
			errors.push(String(e));
		} finally {
			window.close();
		}
		expect(errors).toEqual([]);
		expect(status).toMatch(/^analyzed in/);
	}, 5 * 60 * 1000);
});
