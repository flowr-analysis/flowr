import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { assert, describe, test } from 'vitest';
import { contractFormals, spokenOf } from '../../../scripts/sigdb-page/contract-formals';
import { answersAll, contractTokens, takeContractSpecs } from '../../../scripts/sigdb-page/contract-search';
import { guardsForPage } from '../../../scripts/sigdb-index';

const Root = path.join(__dirname, '..', '..', '..');

const Hooks = ['q', 'mode', 'sort', 'filters', 'scope', 'status', 'hits', 'data', 'kinds', 'stated', 'topics', 'formals', 'groups', 'generics', 'topics-complete', 'ambient-words', 'raw', 'helpcontracts', 'helpkinds'];

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

	test('a query asks about contracts with key:value parts, the rest searching names as before', () => {
		const { rest, specs } = takeContractSpecs('read* param:file:enum requires:base::is.numeric length:x==1');
		assert.strictEqual(rest, 'read*');
		assert.deepStrictEqual(specs, [{ key: 'param', value: 'file:enum' }, { key: 'requires', value: 'base::is.numeric' }, { key: 'length', value: 'x==1' }]);
		const tokens = contractTokens({
			inferred:  true,
			formals:   ['x', 'type'],
			required:  ['x'],
			relations: [['x', 'type']],
			claims:    { x: { types: ['double'], bounds: { length: [1, 1], value: [0, null] }, notNA: true }, type: { types: ['character'], values: ['a', 'b'] } },
			calls:     [['is.numeric', 'base::is.numeric'], ['file_ext', 'tools::file_ext']]
		});
		const answers = (query: string) => answersAll(tokens, takeContractSpecs(query).specs);
		for(const query of ['contract:x', 'requires:is.numeric', 'requires:base::is.numeric', 'requires:tools::file_ext', 'type:x=double', 'type:character', 'length:x==1', 'length:x>=1', 'length:<=1', 'bound:x>=0', 'bound:x>-1',
			'param:enum', 'param:type:enum', 'param:x:scalar', 'param:x:nonneg', 'param:x:numeric', 'param:x:required', 'param:x:notNA', 'relation:', 'relation:type', 'origin:inferred']) {
			assert.isTrue(answers(query), query);
		}
		for(const query of ['contract:y', 'requires:stats::is.numeric', 'type:x=integer', 'length:x>=2', 'bound:x>=1', 'bound:x<=5', 'param:x:enum', 'param:callable', 'returns:', 'origin:stated', 'nchar:x']) {
			assert.isFalse(answers(query), query);
		}
	});

	test('the contracts of the page know the package of each function their conditions call', () => {
		const trunc = guardsForPage()['base::trunc'];
		assert.deepStrictEqual(trunc?.[10], [['is.numeric', 'base::is.numeric'], ['is.logical', 'base::is.logical'], ['is.object', 'base::is.object']]);
		assert.includeMembers([...trunc?.[11] ?? []], ['origin:stated', 'requires:base::is.numeric', 'requires:is.numeric', 'contract:x']);
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
