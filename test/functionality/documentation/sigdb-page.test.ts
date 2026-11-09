import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { assert, describe, test } from 'vitest';
import { contractFormals, spokenOf } from '../../../scripts/sigdb-page/contract-formals';

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

	test('a contract keeps every formal it speaks of, even one the stated signature misses', () => {
		/* flowR states `commandArgs(...)` while R has `commandArgs(trailingOnly = FALSE)` */
		const guards = ['is.logical(trailingOnly)', [['trailingOnly', ['typeof(trailingOnly) in logical']]], [], '4.5.0', [], [], [], ['trailingOnly', 'other']] as const;
		const formals = contractFormals(['...'], ['trailingOnly'], guards);
		assert.deepStrictEqual(formals, ['...', 'trailingOnly', 'other']);
		assert.deepStrictEqual(spokenOf(guards, formals), ['trailingOnly', 'other']);
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
