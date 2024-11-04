import { expect } from 'chai';
import { guard } from '../../../../src/util/assert';
import { asFunction, defaultEnv, variable } from '../../_helper/dataflow/environment-builder';
import { label } from '../../_helper/label';
import { resolveByName, resolvesToBuiltInConstant } from '../../../../src/dataflow/environments/resolve-by-name';
import type { Identifier } from '../../../../src/dataflow/environments/identifier';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { Ternary } from '../../../../src/util/logic';

describe('Resolve', () => {
	describe('ByName', () => {
		it(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			const xVar = variable('x', '_1');
			const env = defaultEnv().defineInEnv(xVar);
			const result = resolveByName('x', env, ReferenceType.Unknown);
			guard(result !== undefined, 'there should be a result');
			expect(result, 'there should be exactly one definition for x').to.have.length(1);
			expect(result[0], 'it should be x').to.deep.equal(xVar);
		});
		it(label('Locally with global distract', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			let env = defaultEnv()
				.defineVariable('x', '_2', '_1');
			const xVar = variable('x', '_1');
			env = env.defineInEnv(xVar);
			const result = resolveByName('x', env, ReferenceType.Unknown);
			guard(result !== undefined, 'there should be a result');
			expect(result, 'there should be exactly one definition for x').to.have.length(1);
			expect(result[0], 'it should be x').to.be.deep.equal(xVar);
		});
		describe('Resolve Function', () => {
			it(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
				const xVar = variable('foo', '_1');
				const env = defaultEnv().defineInEnv(xVar);
				const result = resolveByName('foo', env, ReferenceType.Function);
				expect(result, 'there should be no result').to.be.undefined;
			});
		});
		describe('Resolve Variable', () => {
			it(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
				const xVar = asFunction('foo', '_1');
				const env = defaultEnv().defineInEnv(xVar);
				const result = resolveByName('foo', env, ReferenceType.Variable);
				expect(result, 'there should be no result').to.be.undefined;
			});
		});
	});
	describe('Builtin Constants', () => {
		it('Unknown Identifier', () => {
			const env = defaultEnv();
			const result = resolvesToBuiltInConstant(undefined, env, undefined);
			expect(result, 'should be Ternary.Never').to.be.equal(Ternary.Never);
		});
		it('Undefined Identifier', () => {
			const env = defaultEnv();
			const result = resolvesToBuiltInConstant('foo', env, undefined);
			expect(result, 'should be Ternary.Never').to.be.equal(Ternary.Never);
		});

		const testSingle = (identifier: Identifier, expected: unknown) => function() {
			const env = defaultEnv();
			const result = resolvesToBuiltInConstant(identifier, env, expected);
			expect(result, 'should be Ternary.Always').to.be.equal(Ternary.Always);
		};
		it('Resolve TRUE',	testSingle('TRUE', true));
		it('Resolve T',		testSingle('T', true));
		it('Resolve FALSE',	testSingle('FALSE', false));
		it('Resolve F',		testSingle('F', false));
		it('Resolve NULL',	testSingle('NULL', null));
		it('Resolve NA',	testSingle('NA', null));
	});
});
