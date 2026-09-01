import { assert, describe, test } from 'vitest';
import { label } from '../_helper/label';
import { rankName } from '../../../src/util/text/name-rank';

/** The order the signature browser lists its hits in and the playground offers its completions in. */
describe('Name ranking', () => {
	const beats = (name: string, better: Parameters<typeof rankName>[0], worse: Parameters<typeof rankName>[0]): void => {
		test(label(name, ['name-normal'], ['other']), () => {
			assert.isAbove(rankName(better), rankName(worse), `${better.name} should be offered before ${worse.name}`);
		});
	};

	beats('a plain name before the S3 method of it',
		{ name: 'print', needle: 'pri', known: true }, { name: 'print.foo', needle: 'pri', s3: true });
	beats('what was typed, exactly, before anything else',
		{ name: 'filter', needle: 'filter' }, { name: 'filter_at', needle: 'filter', known: true });
	beats('the exact spelling before the same name in another case, whatever else it has going for it',
		{ name: 'Sin', needle: 'Sin', rank: 0 },
		{ name: 'sin', needle: 'Sin', rank: 1, baseR: true, base: true, known: true, downloads: 5_000_000 });
	beats('a name flowR knows before a spelling it does not',
		{ name: 'ggplot', needle: 'plot', rank: 1, known: true }, { name: 'plotH', needle: 'plot' });
	beats('a function before its replacement form',
		{ name: 'names', needle: 'names' }, { name: 'names<-', needle: 'names' });
	beats('a name before the dotted one nobody asks for first',
		{ name: 'filter', needle: 'fil' }, { name: '.filter', needle: 'fil' });
	beats('a function before an operator',
		{ name: 'union', needle: '' }, { name: '%in%', needle: '' });
	beats('base R before what CRAN adds',
		{ name: 'merge', needle: 'mer', baseR: true, base: true }, { name: 'merge', needle: 'mer' });
	beats('a function before a lone value',
		{ name: 'count', needle: 'cou' }, { name: 'count', needle: 'cou', variable: true });
	beats('the closer fuzzy match first',
		{ name: 'select', needle: 'slt', rank: 0 }, { name: 'select', needle: 'slt', rank: 3 });

	test(label('popularity only settles what is otherwise equal', ['name-normal'], ['other']), () => {
		const common = rankName({ name: 'filter', needle: 'fil', downloads: 5_000_000 });
		const rare = rankName({ name: 'filter', needle: 'fil', downloads: 10 });
		assert.isAbove(common, rare);
		/* and never enough to outweigh a name flowR knows */
		assert.isAbove(rankName({ name: 'filter', needle: 'fil', known: true }), common);
	});
});
