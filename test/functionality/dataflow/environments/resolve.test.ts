import { guard } from '../../../../src/util/assert';
import { asFunction, defaultEnv, variable } from '../../_helper/dataflow/environment-builder';
import { label } from '../../_helper/label';
import { resolveByName, resolvesToBuiltInConstant } from '../../../../src/dataflow/environments/resolve-by-name';
import type { Identifier } from '../../../../src/dataflow/environments/identifier';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { Ternary } from '../../../../src/util/logic';
import type { REnvironmentInformation } from '../../../../src/dataflow/environments/environment';
import { describe, assert, test, expect } from 'vitest';

describe('Resolve', () => {
	describe('ByName', () => {
		test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			const xVar = variable('x', '_1');
			const env = defaultEnv().defineInEnv(xVar);
			const result = resolveByName('x', env, ReferenceType.Unknown);
			guard(result !== undefined, 'there should be a result');
			expect(result, 'there should be exactly one definition for x').to.have.length(1);
			expect(result[0], 'it should be x').to.deep.equal(xVar);
		});
		test(label('Locally with global distract', ['global-scope', 'lexicographic-scope'], ['other']), () => {
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
			test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
				const xVar = variable('foo', '_1');
				const env = defaultEnv().defineInEnv(xVar);
				const result = resolveByName('foo', env, ReferenceType.Function);
				expect(result, 'there should be no result').to.be.undefined;
			});
		});
		describe('Resolve Variable', () => {
			test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
				const xVar = asFunction('foo', '_1');
				const env = defaultEnv().defineInEnv(xVar);
				const result = resolveByName('foo', env, ReferenceType.Variable);
				expect(result, 'there should be no result').to.be.undefined;
			});
		});
	});
	describe('Builtin Constants', () => {
		const testResolve = (label: string, identifier: Identifier | undefined, wantedValue: unknown, expectedResult: Ternary, environment: REnvironmentInformation = defaultEnv()) => test(label, () => {
			const result = resolvesToBuiltInConstant(identifier, environment, wantedValue);
			assert.strictEqual(result, expectedResult, `should be Ternary[${expectedResult}]`);
		});

		//			Label				    Identifier	Wanted Value  Expected Return Value
		testResolve('Resolve TRUE',		    'TRUE', 	true,		  Ternary.Always);
		testResolve('Resolve TRUE',		    'TRUE', 	true,		  Ternary.Always);
		testResolve('Resolve T',		    'T', 		true,		  Ternary.Always);
		testResolve('Resolve FALSE',	    'FALSE',	false,		  Ternary.Always);
		testResolve('Resolve F',		    'F',		false,		  Ternary.Always);
		testResolve('Resolve NULL',		    'NULL', 	null,		  Ternary.Always);
		testResolve('Resolve NA',		    'NA', 		null,		  Ternary.Always);

		testResolve('Maybe Resolves TRUE',  'TRUE', 	true,		  Ternary.Maybe,
			defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })
		);
		testResolve('Maybe Resolves FALSE', 'FALSE', 	false,		  Ternary.Maybe,
			defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })
		);

		testResolve('Undefined Identifier',  undefined, undefined,	  Ternary.Never);
		testResolve('Unknown Identifier',   'foo', 		undefined,	  Ternary.Never);
		testResolve('Does not Resolve',     '42',		true,   	  Ternary.Never);
		testResolve('Does not Resolve', 	'FALSE', 	false,		  Ternary.Never,
			defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }, { id: 42, when: false }] })
		);
	});
});
