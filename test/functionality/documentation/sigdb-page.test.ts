import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { assert, describe, test } from 'vitest';

const Root = path.join(__dirname, '..', '..', '..');

const Hooks = ['q', 'mode', 'sort', 'filters', 'scope', 'status', 'hits', 'data', 'kinds', 'stated', 'topics', 'formals', 'groups', 'generics', 'topics-complete'];

describe('Signature database page', () => {
	test('the template carries the bundle placeholder and every id the script binds to', () => {
		const template = fs.readFileSync(path.join(Root, 'scripts', 'landing-sigdb-template.html'), 'utf8');
		assert.include(template, '<!--MAIN-SCRIPT-->');
		for(const id of Hooks) {
			assert.include(template, `id="${id}"`);
		}
	});

	test('scripts/sigdb-page/main.ts bundles into a classic script that still reads every id', async() => {
		const bundled = await build({
			entryPoints: [path.join(Root, 'scripts', 'sigdb-page', 'main.ts')],
			bundle:      true,
			write:       false,
			minify:      true,
			format:      'iife',
			platform:    'browser',
			target:      'es2022',
			logLevel:    'error'
		});
		const text = bundled.outputFiles[0].text;
		assert.notInclude(text, 'export{');
		assert.notInclude(text, 'export {');
		for(const id of Hooks) {
			assert.match(text, new RegExp(`['"]${id}['"]`));
		}
	});
});
