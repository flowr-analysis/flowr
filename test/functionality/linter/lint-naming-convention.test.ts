import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { CasingConvention, detectCasing, tryFixCasing } from '../../../src/linter/rules/naming-convention';
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

		describe('detect casing (static string)', () => {
			test.each([
				{ name: 'fooBar',           convention: CasingConvention.CamelCase },
				{ name: 'FooBar',           convention: CasingConvention.PascalCase },
				{ name: 'are_we_in_c',      convention: CasingConvention.SnakeCase },
				{ name: 'THIS_IS_CONSTANT', convention: CasingConvention.ConstantCase },
				{ name: 'my_Cool_Var',      convention: CasingConvention.CamelSnakeCase },
				{ name: 'My_Cooler_Var',    convention: CasingConvention.PascalSnakeCase },
			])('detect casing $name as $convention', ({ name, convention }) => {
				const detected = detectCasing(name);
				assert.equal(detected, convention, `Expected to detect ${name} as ${convention}, but detected ${detected}`);
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
			const fixed = tryFixCasing(name, convention);
			assert.equal(fixed, expected, `Expected to convert '${name}' to '${expected}', but converted to '${fixed}'`);
		});	
	});


	describe('rule', () => { 
		assertLinter('simple', parser, 'testVar <- 5', 'naming-convention', [{
			name:           'testVar',
			detectedCasing: CasingConvention.CamelCase,
			suggestion:     'TestVar',
			range:          [1, 1, 1, 7],
			certainty:      LintingCertainty.Definitely,
		}], undefined, { caseing: CasingConvention.PascalCase });

		assertLinter('only detect definition', parser, 'testVar <- 5\nprint(testVar)\n', 'naming-convention', [{
			name:           'testVar',
			detectedCasing: CasingConvention.CamelCase,
			suggestion:     'TestVar',
			range:          [1, 1, 1, 7],
			certainty:      LintingCertainty.Definitely,
		}], undefined, { caseing: CasingConvention.PascalCase });

		assertLinter('detect casing', parser, 'testVar <- 5\ntestVarTwo <- 5\ntest_var <- 5\n', 'naming-convention', [{
			name:           'test_var',
			detectedCasing: CasingConvention.SnakeCase,
			suggestion:     'testVar',
			range:          [3,1,3,8,],
			certainty:      LintingCertainty.Definitely,
		}], undefined, { caseing: 'auto' });
	});
}));