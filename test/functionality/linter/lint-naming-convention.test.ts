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
			return tokens.map(firstUp).join();
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

		describe('simple test', () => {
			assertLinter('simple', parser, 'testVar <- 5', 'naming-convention', [{
				name:           'testVar',
				detectedCasing: CasingConvention.CamelCase,
				suggestion:     'testVar',
				range:          [1, 1, 1, 7],
				certainty:      LintingCertainty.Definitely,
			}]);
		});
	});
}));