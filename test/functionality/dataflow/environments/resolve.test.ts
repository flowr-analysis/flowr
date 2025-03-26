// import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
// import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
// import { RShell } from '../../../../src/r-bridge/shell';
// import { requestFromInput } from '../../../../src/r-bridge/retriever';

// async function get(code: string) {
// 	const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
// 		parser:  new RShell(),
// 		request: requestFromInput(code.trim())
// 	}).allRemainingSteps();
// 	return result;
// }

// describe('Resolve', () => {
// 	describe('ByName', () => {

// 		// test('Resolve Vector', async() => {
// 		// 	const { dataflow } = await get('x <- c("a", "b", "c")');
// 		// 	const result = resolveValueOfVariable('x', dataflow.environment, dataflow.graph.idMap);
// 		// 	assert.equal(result, ['a', 'b', 'c']);
// 		// });

// 		test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope'], ['other']), () => {
// 			const xVar = variable('x', '_1');
// 			const env = defaultEnv().defineInEnv(xVar);
// 			const result = resolveByName('x', env, ReferenceType.Unknown);
// 			guard(result !== undefined, 'there should be a result');
// 			expect(result, 'there should be exactly one definition for x').to.have.length(1);
// 			expect(result[0], 'it should be x').to.deep.equal(xVar);
// 		});
// 		test(label('Locally with global distract', ['global-scope', 'lexicographic-scope'], ['other']), () => {
// 			let env = defaultEnv()
// 				.defineVariable('x', '_2', '_1');
// 			const xVar = variable('x', '_1');
// 			env = env.defineInEnv(xVar);
// 			const result = resolveByName('x', env, ReferenceType.Unknown);
// 			guard(result !== undefined, 'there should be a result');
// 			expect(result, 'there should be exactly one definition for x').to.have.length(1);
// 			expect(result[0], 'it should be x').to.be.deep.equal(xVar);
// 		});
// 		describe('Resolve Function', () => {
// 			test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
// 				const xVar = variable('foo', '_1');
// 				const env = defaultEnv().defineInEnv(xVar);
// 				const result = resolveByName('foo', env, ReferenceType.Function);
// 				assert.isUndefined(result, 'there should be no result');
// 			});
// 		});
// 		describe('Resolve Variable', () => {
// 			test(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope', 'search-type'], ['other']), () => {
// 				const xVar = asFunction('foo', '_1');
// 				const env = defaultEnv().defineInEnv(xVar);
// 				const result = resolveByName('foo', env, ReferenceType.Variable);
// 				assert.isUndefined(result, 'there should be no result');
// 			});
// 		});
// 	});
// 	describe('Builtin Constants', () => {
// 		// Always Resolve
// 		test.each([
// 			//Identifier  Wanted Value  
// 			['TRUE',  true],
// 			['TRUE',  true],
// 			['T',     true],
// 			['FALSE', false],
// 			['F',     false],
// 			['NULL',  null],
// 			['NA',    null],
// 		])("Identifier '%s' should always resolve to %s", (identifier, wantedValue) => {
// 			const result = resolvesToBuiltInConstant(identifier, defaultEnv(), wantedValue);
// 			assert.strictEqual(result, Ternary.Always, 'should be Ternary.Always');
// 		});

// 		// Maybe Resolve
// 		test.each([
// 			//Identifier  Wanted Value    Environment
// 			['TRUE',  true,  defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })],
// 			['FALSE', false, defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })]
// 		])("Identifier '%s' should maybe resolve to %s", (identifier, wantedValue, environment) => {
// 			const result = resolvesToBuiltInConstant(identifier, environment, wantedValue);
// 			assert.strictEqual(result, Ternary.Maybe, 'should be Ternary.Maybe');
// 		});

// 		// Never Resolve
// 		test.each([
// 			//Identifier  Wanted Value  Environment
// 			[undefined, undefined, defaultEnv()],
// 			['foo',     undefined, defaultEnv()],
// 			['42',      true,      defaultEnv()],
// 			['FALSE',   false,     defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }, { id: 42, when: false }] })]
// 		])("Identifier '%s' should never resolve to %s", (identifier, wantedValue, environment) => {
// 			const result = resolvesToBuiltInConstant(identifier, environment, wantedValue);
// 			assert.strictEqual(result, Ternary.Never, 'should be Ternary.Never');
// 		});

// 		describe('Builtin Constants New', () => {
// 			// Always Resolve
// 			test.each([
// 				//Identifier  Wanted Value  
// 				['TRUE',  true],
// 				['TRUE',  true],
// 				['T',     true],
// 				['FALSE', false],
// 				['F',     false],
// 				['NULL',  null],
// 				['NA',    null],
// 			])("Identifier '%s' should always resolve to %s", (identifier, wantedValue) => {
// 				const defs = resolveToConstants(identifier, defaultEnv());
// 				const all = defs?.every(d => d === wantedValue) ?? false;
// 				assert.isTrue(all, 'should be true');
// 			});
	
// 			// Maybe Resolve
// 			test.each([
// 				//Identifier  Wanted Value    Environment
// 				['TRUE',  true,  defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })],
// 				['FALSE', false, defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }] })]
// 			])("Identifier '%s' should maybe resolve to %s", (identifier, wantedValue, environment) => {
// 				const defs = resolveToConstants(identifier, environment);
// 				const some = defs?.some(d => d === wantedValue) ?? false;
// 				const all = defs?.every(d => d === wantedValue) ?? false;
// 				assert.isTrue(some, 'some should be True');
// 				assert.isFalse(all, 'all should be False');
// 			});
	
// 			// Never Resolve
// 			test.each([
// 				//Identifier  Wanted Value  Environment
// 				[undefined,   undefined, defaultEnv()],
// 				['foo',       undefined, defaultEnv()],
// 				['42',        true,      defaultEnv()],
// 				['FALSE',     false,     defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, controlDependencies: [{ id: 42, when: true }, { id: 42, when: false }] })]
// 			])("Identifier '%s' should never resolve to %s", (identifier, wantedValue, environment) => {
// 				const defs = resolveToConstants(identifier, environment);
// 				const result = defs?.every(p => p === wantedValue) ?? false;
// 				assert.isFalse(result, 'result should be False');
// 			});
// 		});
// 	});
// });
