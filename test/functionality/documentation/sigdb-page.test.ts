import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { assert, describe, test } from 'vitest';
import { contractFormals, spokenOf } from '../../../scripts/sigdb-page/contract-formals';
import { answersAll, contractTokens, takeContractSpecs } from '../../../scripts/sigdb-page/contract-search';
import { builtInKinds, guardsForPage } from '../../../scripts/sigdb-index';
import { hasEscapes, linkedGroups, mergedRelations, sharedEscapes, withoutEscapes, withUnless } from '../../../src/dataflow/fn/guards/condition-grouping';
import { guardsTuple } from '../../../scripts/sigdb-page/contract-tuple';

const Root = path.join(__dirname, '..', '..', '..');

const Hooks = ['q', 'mode', 'sort', 'filters', 'scope', 'status', 'hits', 'data', 'kinds', 'stated', 'topics', 'formals', 'groups', 'generics', 'topics-complete', 'ambient-words', 'docs', 'raw', 'helpcontracts', 'helpkinds'];

describe('Signature database page', () => {
	test('the template carries the bundle placeholder and every id the script binds to', () => {
		const template = fs.readFileSync(path.join(Root, 'scripts', 'landing-sigdb-template.html'), 'utf8');
		assert.include(template, '<!--MAIN-SCRIPT-->');
		for(const id of Hooks) {
			assert.include(template, `id="${id}"`);
		}
	});

	test('a kind of one package\'s definition names that package', () => {
		/* `maps::map` draws, `purrr::map` does not */
		const map = builtInKinds().get('map') ?? [];
		assert.include(map, 'visualize@maps');
		assert.notInclude(map, 'visualize');
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
		assert.includeDeepMembers([...trunc?.[10] ?? []], [['is.numeric', 'base::is.numeric'], ['is.logical', 'base::is.logical'], ['is.object', 'base::is.object'], ['oldClass', 'base::oldClass']]);
		assert.includeMembers([...trunc?.[11] ?? []], ['origin:stated', 'requires:base::is.numeric', 'requires:is.numeric', 'contract:x']);
	});

	test('a contract shows a comparison once, also when stated with its sides swapped or with other ways through', () => {
		assert.deepStrictEqual(mergedRelations([
			{ holds: 'length(a) == length(b)', unless: 'c || is.null(dim(a)) || is.null(dim(b))' },
			{ holds: 'length(b) == length(a)', unless: '(c || is.null(dim(b)) || is.null(dim(a)))' },
			{ holds: 'x > n', unless: 'c || p' },
			{ holds: 'n < x', unless: 'c || q && r' },
			{ holds: 'y >= 1', unless: 'k' },
			{ holds: 'y >= 1' }
		]), [
			{ holds: 'length(a) == length(b)', unless: 'c || is.null(dim(a)) || is.null(dim(b))' },
			{ holds: 'x > n', unless: 'c || (p && q && r)' },
			{ holds: 'y >= 1', unless: undefined }
		]);
	});

	test('a claim with a way through of its own and another one reads with one unless', () => {
		assert.strictEqual(withUnless('typeof(d) not in {function, environment} unless is.object(d)', '(big.mark != "" || !is.character(x))'),
			'typeof(d) not in {function, environment} unless (is.object(d) || big.mark != "" || !is.character(x))');
		assert.strictEqual(withUnless('is.numeric(x) && length(x) == 1', 'is.null(y)'), '(is.numeric(x) && length(x) == 1) unless is.null(y)');
	});

	test('what lets most rows of a contract through is said once, each row keeping its own ways through', () => {
		/* the shape of `prettyNum`: two formals and a relation share `big.mark != "" || small.mark != ""` */
		const rows = [
			['!missing(x)', 'typeof(x) not in character unless (big.mark != "" || small.mark != "" || is.object(x))'],
			['typeof(d) not in {function, environment} unless (is.object(d) || big.mark != "" || small.mark != "" || !is.character(x))'],
			['typeof(i) not in {function, environment} unless (is.object(i) || big.mark != "" || small.mark != "")'],
			['length(d) == length(i) unless big.mark != "" || small.mark != "" || is.null(dim(d))'],
			['typeof(big.mark) not in {function, environment} unless is.object(big.mark)']
		];
		const shared = sharedEscapes(rows);
		assert.deepStrictEqual(shared, ['big.mark != ""', 'small.mark != ""']);
		/* `!missing(x)` holds whatever the marks are, so `x` keeps its row as it is */
		assert.deepStrictEqual(rows.map(r => hasEscapes(r, shared)), [false, true, true, true, false]);
		assert.strictEqual(withoutEscapes(rows[1][0], shared), 'typeof(d) not in {function, environment} unless (is.object(d) || !is.character(x))');
		assert.strictEqual(withoutEscapes(rows[3][0], shared), 'length(d) == length(i) unless is.null(dim(d))');
		assert.strictEqual(withoutEscapes('a == b unless big.mark != "" || small.mark != ""', shared), 'a == b');
		/* a way through only one row has is said where it is */
		assert.deepStrictEqual(sharedEscapes([['a unless p'], ['b unless q'], ['c']]), []);
	});

	test('the same claim with several ways through is said once, holding unless all of them do', () => {
		const tuple = guardsTuple({
			requires:    'x',
			conditional: [
				{ formal: 'x', claim: { types: ['character'] }, unless: 'big.mark != "" || is.null(dim(d))' },
				{ formal: 'x', claim: { types: ['character'] }, unless: 'big.mark != "" || length(d) <= 1' },
				{ formal: 'y', claim: { notNA: true }, unless: 'is.null(z)' }
			]
		});
		assert.deepStrictEqual(tuple?.[1], [['x', ['typeof(x) in character unless (big.mark != "" || (is.null(dim(d)) && length(d) <= 1))']], ['y', ['!anyNA(y) unless is.null(z)']]]);
	});

	test('the formals a contract relates read together, in the order of the signature', () => {
		assert.deepStrictEqual(linkedGroups(['x', 'm', 'FUN', 'a', 'b'], [['b', 'x'], ['m', 'a'], ['a', 'x']]), [['x', 'm', 'a', 'b'], ['FUN']]);
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
