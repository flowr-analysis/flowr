import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { CasingConvention, detectCasing } from '../../../src/linter/rules/naming-convention';
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
		case CasingConvention.FlatCase: // flatcase
			return tokens.join('');
		case CasingConvention.Uppercase: // UPPERCASE
			return tokens.join('').toUpperCase();
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
				{ name: 'mycoolvar',        convention: CasingConvention.FlatCase },
				{ name: 'FOOBAR',           convention: CasingConvention.Uppercase },
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
	});
}));