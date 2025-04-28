import { guard } from '../../../../src/util/assert';
import { asFunction, defaultEnv, variable } from '../../_helper/dataflow/environment-builder';
import { decorateLabelContext, label } from '../../_helper/label';
import { resolveByName, resolveIdToValue, resolveToConstants, resolveValueOfVariable, resolvesToBuiltInConstant } from '../../../../src/dataflow/environments/resolve-by-name';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { Ternary } from '../../../../src/util/logic';
import { describe, assert, test, expect } from 'vitest';
import { valueFromTsValue } from '../../../../src/dataflow/eval/values/general';
import { setFrom } from '../../../../src/dataflow/eval/values/sets/set-constants';
import type { Lift, Value } from '../../../../src/dataflow/eval/values/r-value';
import { Bottom, isBottom, isTop, Top } from '../../../../src/dataflow/eval/values/r-value';
import { withShell } from '../../_helper/shell';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { slicingCriterionToId, type SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { intervalFromValues } from '../../../../src/dataflow/eval/values/intervals/interval-constants';
import { getScalarFromInteger } from '../../../../src/dataflow/eval/values/scalar/scalar-consatnts';

enum Allow {
	None = 0,
	Top = 1,
	Bottom = 2
};

describe.sequential('Resolve', withShell(shell => {
	function set(values: unknown[]) {
		return setFrom(...values.map(v => valueFromTsValue(v)));
	}

	function interval(start: Lift<number>, end: Lift<number> = start, startInclusive = true, endInclusive = true) {
		return intervalFromValues(
			typeof start === 'number' ? getScalarFromInteger(start) : start,
			typeof end === 'number' ? getScalarFromInteger(end) : end,
			startInclusive,
			endInclusive
		);
	}

	function testResolve(
		name: string,
		identifier: string | SingleSlicingCriterion,
		code: string,
		expectedValues: Value,
		allow: Allow = Allow.None 
	): void {
		const effectiveName = decorateLabelContext(label(name), ['resolve']);
		const isSlicingCriterion = identifier.includes('@') || identifier.includes('$');

		test(effectiveName, async() => {
			const dataflow = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				parser:  shell,
				request: requestFromInput(code.trim()),
			}).allRemainingSteps();

			let resolved = undefined;
			if(isSlicingCriterion) {
				resolved = resolveIdToValue(slicingCriterionToId(identifier as SingleSlicingCriterion, dataflow.normalize.idMap), dataflow.dataflow);
			} else {
				resolved = resolveValueOfVariable(identifier, dataflow.dataflow.environment, dataflow.normalize.idMap);
			}
			
			if((allow & Allow.Top) == Allow.Top && isTop(resolved)) {
				return;
			}

			if((allow & Allow.Bottom) == Allow.Bottom && isBottom(resolved)) {
				return;
			}

			assert.deepEqual(resolved, expectedValues, `Resolved Value does not match expected Value. Code was: ${code}`);
		});
	}

	function testMutate(name: string, identifier: string, code: string, expected: Value, allow: Allow = Allow.None) {
		const distractors: string[] = [
			`while(FALSE) { ${identifier} <- 0 }`,
			`if(FALSE) { ${identifier} <- 0 }`, 
			'u <- u + 1',
			`if(FALSE) { rm(${identifier})}`
		];

		describe(name, () => {
			for(const distractor of distractors) {
				const mutatedCode = code.split('\n').map(line => `${distractor}\n${line}`).join('\n');
				testResolve(distractor, identifier, mutatedCode, expected, allow);
			}
		});
	}

	describe('Negative Tests', () => { 	
		testResolve('Unknown if', 'x', 'if(u) { x <- 2 } else { x <- foo() } \n x', Top);
	
		testResolve('Unknown Fn', 'x', 'x <- foo(1) \n x', Top);
		testResolve('Unknown Fn 2', 'f', 'f <- function(x = 3) { foo(x) } \n f()', Top);
		testResolve('Recursion', 'f', 'f <- function(x = 3) { f(x) } \n f()', Top);
		testResolve('Get Unknown', 'x', 'y <- 5 \n x <- get(u) \n x', Top);
		
		testResolve('rm()', 'x', 'x <- 1 \n rm(x) \n x', Bottom);
	
		testResolve('Eval before Variable (slice)', '3@x', 'x <- 1 \n eval(u) \n x', Top);
		testResolve('Eval before Variable',           'x', 'x <- 1 \n eval(u) \n x', Top);
	});
	
	describe('Resolve Value', () => {	
		testResolve('Constant Value', 'x', 'x <- 5', set([5]));
		testResolve('Constant Value Str', 'x', 'x <- "foo"', set(['foo']));
		testResolve('Alias Constant Value', 'x', 'y <- 5 \n x <- y \n x', set([5]));

		testResolve('rm() with alias', 'x', 'y <- 2 \n x <- y \n rm(y) \n x', set([2]));

		// Not yet supported
		testResolve('Fn Default Arg', 'f', 'f <- function(x = 3) { x } \n f()', set([3]), Allow.Top);
		testResolve('Get', 'x', 'y <- 5 \n x <- get("y") \n x', set([5]), Allow.Top);
		testResolve('Super Assign', 'x', 'x <- 1 \n f <- function() { x <<- 2} \n f() \n x', set([2]), Allow.Top);
		testResolve('Plus One', 'x', 'x <- 1 \n x <- x+1 \n x', interval(1, Top), Allow.Top);
				
		testResolve('Random Loop', 'x', 'x <- 1 \n while(TRUE) { x <- x + 1 \n if(runif(1) > 0.5) { break } } \n x', Top);
		testResolve('Loop plus one', 'i', 'for(i in 1:10) { i \n i <- i + 1 \n i} \n i', interval(2, 11), Allow.Top);
		testResolve('Loop plus x', 'x', 'x <- 2 \n for(i in 1:10) { x \n x <- i + x \n i} \n x', interval(2, 57), Allow.Top);
			
		testResolve('Superassign Arith', 'x', 'y <- 4 \n x <- 1 \n f <- function() { x <<- 2 * y } \n f() \n x', interval(8), Allow.Top);
	});

	describe('Resolve Value (distractors)', () => {
		testMutate('Constant Value', 'x', 'x <- 5', set([5]));
		testMutate('Constant Value branch', 'x', 'if(u) { \n x <- 5} else { \n x <- 6 }', set([5, 6]));
		testMutate('Alias Constant Value', 'x', 'y <- 5 \n x <- y \n x', set([5]));
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
