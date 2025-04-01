import { guard } from '../../../../src/util/assert';
import { asFunction, defaultEnv, variable } from '../../_helper/dataflow/environment-builder';
import { decorateLabelContext, label } from '../../_helper/label';
import type { ResolveResult } from '../../../../src/dataflow/environments/resolve-by-name';
import { resolveByName, resolveToConstants, resolveValueOfVariable, resolvesToBuiltInConstant } from '../../../../src/dataflow/environments/resolve-by-name';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { Ternary } from '../../../../src/util/logic';
import { describe, assert, test, expect } from 'vitest';
import { valueFromTsValue } from '../../../../src/dataflow/eval/values/general';
import { setFrom } from '../../../../src/dataflow/eval/values/sets/set-constants';
import { Top } from '../../../../src/dataflow/eval/values/r-value';
import { withShell } from '../../_helper/shell';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';

describe.sequential('Resolve', withShell(shell => {
	function testResolve(
		name: string,
		identifier: string,
		code: string,
		expected: ResolveResult
	): void {
		const effectiveName = decorateLabelContext(label(name), ['resolve']);
		
		test(effectiveName, async() => {
			const dataflow = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				parser:  shell,
				request: requestFromInput(code.trim()),
			}).allRemainingSteps();

			const resolved = resolveValueOfVariable(identifier, dataflow.dataflow.environment, dataflow.normalize.idMap);
		
			assert.deepEqual(resolved, expected);
		});
	}

	describe('Negative Tests', () => {
		
	});

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
				assert.isUndefined(result, 'there should be no result');
			});
		});
		describe('Resolve Variable', () => {
			test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
				const xVar = asFunction('foo', '_1');
				const env = defaultEnv().defineInEnv(xVar);
				const result = resolveByName('foo', env, ReferenceType.Variable);
				assert.isUndefined(result, 'there should be no result');
			});
		});
	});
	describe('Builtin Constants', () => {
		// Always Resolve
		test.each([
			//Identifier  Wanted Value  
			['TRUE',  true],
			['TRUE',  true],
			['T',     true],
			['FALSE', false],
			['F',     false],
			['NULL',  null],
			['NA',    null],
		])("Identifier '%s' should always resolve to %s", (identifier, wantedValue) => {
			const result = resolvesToBuiltInConstant(identifier, defaultEnv(), wantedValue);
			assert.strictEqual(result, Ternary.Always, 'should be Ternary.Always');
		});

		// Maybe Resolve
		test.each([
			//Identifier  Wanted Value    Environment
			['TRUE',  true,  defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })],
			['FALSE', false, defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })]
		])("Identifier '%s' should maybe resolve to %s", (identifier, wantedValue, environment) => {
			const result = resolvesToBuiltInConstant(identifier, environment, wantedValue);
			assert.strictEqual(result, Ternary.Maybe, 'should be Ternary.Maybe');
		});

		// Never Resolve
		test.each([
			//Identifier  Wanted Value  Environment
			[undefined, undefined, defaultEnv()],
			['foo',     undefined, defaultEnv()],
			['42',      true,      defaultEnv()],
			['FALSE',   false,     defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }, { id: 42, when: false }] })]
		])("Identifier '%s' should never resolve to %s", (identifier, wantedValue, environment) => {
			const result = resolvesToBuiltInConstant(identifier, environment, wantedValue);
			assert.strictEqual(result, Ternary.Never, 'should be Ternary.Never');
		});

		describe('Builtin Constants New', () => {
			// Always Resolve
			test.each([
				//Identifier  Wanted Value  
				['TRUE',  true],
				['TRUE',  true],
				['T',     true],
				['FALSE', false],
				['F',     false],
				['NULL',  null],
				['NA',    null],
			])("Identifier '%s' should always resolve to %s", (identifier, wantedValue) => {
				const defs = resolveToConstants(identifier, defaultEnv());
				assert.deepEqual(defs, setFrom(valueFromTsValue(wantedValue)));
			});
	
			// Maybe Resolve
			test.each([
				//Identifier  Wanted Value                       Environment
				['TRUE',  setFrom(Top, valueFromTsValue(true)),  defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })],
				['FALSE', setFrom(Top, valueFromTsValue(false)), defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })]
			])("Identifier '%s' should maybe resolve to %s", (identifier, wantedValue, environment) => {
				const defs = resolveToConstants(identifier, environment);
				assert.deepEqual(defs, wantedValue);
			});
	
			// Never Resolve
			test.each([
				//Identifier  Wanted Value      Environment
				[undefined,   Top,              defaultEnv()],
				['foo',       Top,              defaultEnv()],
				['42',        Top,              defaultEnv()],
				['FALSE',     setFrom(Top),     defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }, { id: 42, when: false }] })]
			])("Identifier '%s' should never resolve to %s", (identifier, wantedValue, environment) => {
				const defs = resolveToConstants(identifier, environment);
				assert.deepEqual(defs, wantedValue);
			});
		});
	});
}));
