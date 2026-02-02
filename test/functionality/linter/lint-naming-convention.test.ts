import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { CasingConvention, detectCasing, detectPotentialCasings, fixCasing } from '../../../src/linter/rules/naming-convention';
import { assertUnreachable } from '../../../src/util/assert';

function genName(convention: CasingConvention): string {
	const randToken = () => {
		const chars = 'abcdefghijklmnopqrstuvwxyz';
		let out = '';
		for(let i = 0; i < 5; i++) {
			out += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return out;
	};

	const firstUp = (s: string) => `${s[0].toUpperCase()}${s.substring(1)}`;

	const tokens = [randToken(), randToken(), randToken()];

	switch(convention) {
		case CasingConvention.CamelCase: // camelCase
			return `${tokens[0]}${tokens.slice(1).map(firstUp).join('')}`;
		case CasingConvention.PascalCase: // PascalCase
			return tokens.map(firstUp).join('');
		case CasingConvention.SnakeCase: // snake_case
			return tokens.join('_');
		case CasingConvention.ConstantCase: // CONSTANT_CASE
			return tokens.map(s => s.toUpperCase()).join('_');
		case CasingConvention.CamelSnakeCase: // camel_Snake_Case
			return `${tokens[0]}_${tokens.slice(1).map(firstUp).join('_')}`;
		case CasingConvention.PascalSnakeCase: // Pascal_Snake_Case
			return tokens.map(firstUp).join('_');
		case CasingConvention.Unknown:
			return '';
		default:
			assertUnreachable(convention);
	}
}


describe('flowR linter', withTreeSitter(parser => {
	describe('naming convention', () => {
		describe('detect casing (random string)', () => {
			test.each(Object.values(CasingConvention))('detect casing %s', (convention) => {
				const name = genName(convention);
				const detected = detectCasing(name);
				assert.equal(detected, convention, `Expected to detect ${name} as ${convention}, but detected ${detected}`);
			});
		});

		const casings = [
			{ name: 'fooBar',           conventions: [CasingConvention.CamelCase] },
			{ name: 'FooBar',           conventions: [CasingConvention.PascalCase] },
			{ name: 'are_we_in_c',      conventions: [CasingConvention.SnakeCase] },
			{ name: 'THIS_IS_CONSTANT', conventions: [CasingConvention.ConstantCase] },
			{ name: 'my_Cool_Var',      conventions: [CasingConvention.CamelSnakeCase] },
			{ name: 'My_Cooler_Var',    conventions: [CasingConvention.PascalSnakeCase] },
			{ name: 'justfoo',          conventions: [CasingConvention.CamelCase, CasingConvention.SnakeCase, CasingConvention.CamelSnakeCase] },
			{ name: 'foo_',             conventions: [CasingConvention.SnakeCase, CasingConvention.CamelSnakeCase] },
			{ name: '_foo',             conventions: [CasingConvention.SnakeCase] },
			{ name: '__foo',            conventions: [CasingConvention.SnakeCase] },
			{ name: 'JUSTFOO',          conventions: [CasingConvention.ConstantCase] },
			{ name: 'JUSTFOO_',         conventions: [CasingConvention.ConstantCase] },
			{ name: 'Foo',              conventions: [CasingConvention.PascalCase, CasingConvention.PascalSnakeCase] },
		];

		describe('detect casing (static string)', () => {
			test.each(casings.map(c => ({ name: c.name, convention: c.conventions[0] })))('detect casing $name as $convention', ({ name, convention }) => {
				const detected = detectCasing(name);
				assert.equal(detected, convention, `Expected to detect ${name} as ${convention}, but detected ${detected}`);
			});
		});

		describe('detect casing (multiple options)', () => {
			test.each(casings)('detect casing $name as $conventions', ({ name, conventions }) => {
				const detected = detectPotentialCasings(name);
				assert.deepEqual(detected, conventions, `Expected to detect ${name} as ${JSON.stringify(conventions)}, but detected ${JSON.stringify(detected)}`);
			});
		});

		test.each([
			{ name: 'foo_bar',          expected: 'fooBar',      convention: CasingConvention.CamelCase },
			{ name: 'FooBar',           expected: 'fooBar',      convention: CasingConvention.CamelCase },
			{ name: 'foo_bar',          expected: 'FooBar',      convention: CasingConvention.PascalCase },
			{ name: 'fooBar',           expected: 'FooBar',      convention: CasingConvention.PascalCase },
			{ name: 'FooBarBaz',        expected: 'foo_bar_baz', convention: CasingConvention.SnakeCase },
			{ name: 'Foo_Bar_Baz',      expected: 'foo_bar_baz', convention: CasingConvention.SnakeCase },
			{ name: 'testVar',          expected: 'TEST_VAR',    convention: CasingConvention.ConstantCase },
			{ name: 'test_Var',         expected: 'TEST_VAR',    convention: CasingConvention.ConstantCase },
			{ name: 'fooBar',           expected: 'foo_Bar',     convention: CasingConvention.CamelSnakeCase },
			{ name: 'foo_Bar',          expected: 'foo_Bar',     convention: CasingConvention.CamelSnakeCase },
			{ name: 'fooBar',           expected: 'Foo_Bar',     convention: CasingConvention.PascalSnakeCase },
			{ name: 'foo_Bar',          expected: 'Foo_Bar',     convention: CasingConvention.PascalSnakeCase },
		])('fix casing $convention', ({ name, convention, expected }) => {
			const fixed = fixCasing(name, convention);
			assert.equal(fixed, expected, `Expected to convert '${name}' to '${expected}', but converted to '${fixed}'`);
		});
	});

	describe('rule', () => {
		/** Given a symbol definition `testVar <- 5` the linter checks if it matches the configured casing rule (here we check for PascalCase) and provides a quick fix `TestVar <- 5` */
		assertLinter('simple', parser, 'testVar <- 5', 'naming-convention', [{
			name:           'testVar',
			detectedCasing: CasingConvention.CamelCase,
			quickFix:       [{ type: 'replace', replacement: 'TestVar', range: [1, 1, 1, 7], description: 'Rename to match naming convention PascalCase' } as const],
			range:          [1, 1, 1, 7],
			certainty:      LintingResultCertainty.Certain,
		}], undefined, { caseing: CasingConvention.PascalCase });

		/** The casing of the definition is checked, and quick fixes for all usages (and the definition) are provided */
		assertLinter('only detect definition', parser, 'testVar <- 5\nprint(testVar)\n', 'naming-convention', [{
			name:           'testVar',
			detectedCasing: CasingConvention.CamelCase,
			quickFix:       [
				{ type: 'replace', replacement: 'TestVar', range: [2, 7, 2, 13], description: 'Rename to match naming convention PascalCase' } as const,
				{ type: 'replace', replacement: 'TestVar', range: [1, 1, 1, 7],   description: 'Rename to match naming convention PascalCase' } as const
			],
			range:     [1, 1, 1, 7],
			certainty: LintingResultCertainty.Certain,
		}], undefined, { caseing: CasingConvention.PascalCase });

		/** Arguments will be checked for correct casing convention as well */
		assertLinter('function and call', parser, 'foo_Bar <- function(arg) arg\nfoo_Bar()', 'naming-convention', [
			{
				name:           'foo_Bar',
				detectedCasing: CasingConvention.CamelSnakeCase,
				quickFix:       [
					{ type: 'replace', replacement: 'FooBar', range: [2, 1, 2, 7], description: 'Rename to match naming convention PascalCase' } as const,
					{ type: 'replace', replacement: 'FooBar', range: [1, 1, 1, 7],   description: 'Rename to match naming convention PascalCase' } as const
				],
				range:     [1, 1, 1, 7],
				certainty: LintingResultCertainty.Certain,
			},
			{
				name:           'arg',
				detectedCasing: CasingConvention.CamelCase,
				quickFix:       [
					{ type: 'replace', replacement: 'Arg', range: [1, 26, 1, 28], description: 'Rename to match naming convention PascalCase' } as const,
					{ type: 'replace', replacement: 'Arg', range: [1, 21, 1, 23],   description: 'Rename to match naming convention PascalCase' } as const
				],
				range:     [1, 21, 1, 23],
				certainty: LintingResultCertainty.Certain,
			},
		], undefined, { caseing: CasingConvention.PascalCase });

		/** The rule can be configured to automaticaly detect the most used casing style. The file will be linted according to the detected style */
		assertLinter('detect casing', parser, 'testVar <- 5\ntestVarTwo <- 5\ntest_var <- 5\n', 'naming-convention', [{
			name:           'test_var',
			detectedCasing: CasingConvention.SnakeCase,
			quickFix:       [{ type: 'replace', replacement: 'testVar', range: [3, 1, 3, 8], description: 'Rename to match naming convention camelCase' } as const],
			range:          [3, 1, 3, 8],
			certainty:      LintingResultCertainty.Certain,
		}], undefined, { caseing: 'auto' });

		/** The rule can be configured to ignore identifier that do not contain any alphabetic characters */
		assertLinter('non alpha identifier (ignore)', parser, '._ <- 4', 'naming-convention', [], undefined, {
			caseing:        'auto',
			ignoreNonAlpha: true
		});

		/** Otherwise the linter will always detect non alpha identifiers as following the wrong convention */
		assertLinter('non alpha identifier (do not ignore)', parser, '._ <- 4', 'naming-convention', [{
			certainty:      LintingResultCertainty.Certain,
			detectedCasing: CasingConvention.Unknown,
			name:           '._',
			range:          [ 1, 1, 1, 2],
			quickFix:       undefined
		}], undefined, {
			caseing:        CasingConvention.SnakeCase,
			ignoreNonAlpha: false
		});

		assertLinter('empty string', parser, '', 'naming-convention', [], undefined, { caseing: CasingConvention.SnakeCase });
		assertLinter('empty string (auto detect)', parser, '', 'naming-convention', [], undefined, { caseing: 'auto' });
	});
}));
