import { summarizeSlicerStats } from '../../../src/benchmark/summarizer/first-phase/process';
import { BenchmarkSlicer } from '../../../src/benchmark/slicer';
import { formatNanoseconds, stats2string } from '../../../src/benchmark/stats/print';
import type { CommonSlicerMeasurements } from '../../../src/benchmark/stats/stats';
import { PerSliceMeasurements, RequiredSlicerMeasurements } from '../../../src/benchmark/stats/stats';
import { amendConfig, defaultConfigOptions } from '../../../src/config';
import { assert, describe, test } from 'vitest';
import { DefaultAllVariablesFilter } from '../../../src/slicing/criterion/filters/all-variables';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { guard, isNotUndefined } from '../../../src/util/assert';
import { DataFrameOperationNames, type DataFrameOperationName } from '../../../src/abstract-interpretation/data-frame/semantics';

async function retrieveStatsSafe(slicer: BenchmarkSlicer, request: { request: string; content: string }) {
	const { stats: rawStats } = slicer.finish();
	const stats = await summarizeSlicerStats(rawStats);
	const statInfo = stats2string(stats);

	assert.strictEqual(stats.request, request, statInfo);
	assert.sameMembers([...stats.commonMeasurements.keys()], [...RequiredSlicerMeasurements], `Must have all keys in common measurements ${statInfo}`);
	assert.sameMembers([...stats.perSliceMeasurements.measurements.keys()], [...PerSliceMeasurements], `Must have all keys in per-slice measurements ${statInfo}`);
	return { stats, statInfo };
}

describe('Benchmark Slicer', () => {
	test('Print times', () => {
		assert.equal(formatNanoseconds(0).trim(), '0:000000ms');
		assert.equal(formatNanoseconds(1000000).trim(), '1:000000ms');
		assert.equal(formatNanoseconds(1e+9).trim(), '1.000 s');
		assert.equal(formatNanoseconds(1.25e+9).trim(), '1.250 s');
		assert.equal(formatNanoseconds(234892342839398).trim(), '234892.342:839398 s');
	});

	describe.sequential('Stats by parsing text-based inputs', function() {
		test('Simple slice for simple line', { timeout: 15 * 60 * 1000 }, async() => {
			const slicer = new BenchmarkSlicer('r-shell');
			const request = { request: 'text' as const, content: 'a <- b' };
			await slicer.init(request, defaultConfigOptions);
			await slicer.slice('1@a');
			const { stats, statInfo } = await retrieveStatsSafe(slicer, request);

			assert.deepStrictEqual(stats.input, {
				numberOfLines:                             1,
				numberOfNonEmptyLines:                     1,
				numberOfCharacters:                        6,
				numberOfCharactersNoComments:              6,
				numberOfNonWhitespaceCharacters:           4,
				numberOfNonWhitespaceCharactersNoComments: 4,
				numberOfRTokens:                           6,
				numberOfRTokensNoComments:                 6,
				numberOfNormalizedTokens:                  4,  // root expression list, assignment, lhs, rhs
				numberOfNormalizedTokensNoComments:        4
			}, statInfo);

			assert.deepStrictEqual(stats.dataflow, {
				numberOfNodes:               3,  // the defined variable, the reading ref, and the call
				numberOfEdges:               5,  // the defined-by edge and the arguments, the built-in edge
				numberOfCalls:               1,  // `<-`
				numberOfFunctionDefinitions: 0,   // no definitions
				sizeOfObject:                228,
				storedVertexIndices:         0,  // no indices
				storedEnvIndices:            0,  // no indices
				overwrittenIndices:          0,  // no indices
			}, statInfo);

			assert.strictEqual(stats.perSliceMeasurements.numberOfSlices, 1, `sliced only once ${statInfo}`);

			assert.deepStrictEqual(stats.perSliceMeasurements.sliceSize, {
				// only one entry
				normalizedTokens:                  { min: 4, max: 4, median: 4, mean: 4, std: 0, total: 4 },
				normalizedTokensNoComments:        { min: 4, max: 4, median: 4, mean: 4, std: 0, total: 4 },
				characters:                        { min: 6, max: 6, median: 6, mean: 6, std: 0, total: 6 },
				charactersNoComments:              { min: 6, max: 6, median: 6, mean: 6, std: 0, total: 6 },
				nonWhitespaceCharacters:           { min: 4, max: 4, median: 4, mean: 4, std: 0, total: 4 },
				nonWhitespaceCharactersNoComments: { min: 4, max: 4, median: 4, mean: 4, std: 0, total: 4 },
				dataflowNodes:                     { min: 3, max: 3, median: 3, mean: 3, std: 0, total: 3 },
				tokens:                            { min: 6, max: 6, median: 6, mean: 6, std: 0, total: 6 },
				tokensNoComments:                  { min: 6, max: 6, median: 6, mean: 6, std: 0, total: 6 },
				lines:                             { min: 1, max: 1, median: 1, mean: 1, std: 0, total: 1 },
				nonEmptyLines:                     { min: 1, max: 1, median: 1, mean: 1, std: 0, total: 1 },
				linesWithAutoSelected:             { min: 0, max: 0, median: 0, mean: 0, std: 0, total: 0 }
			}, `sliced only once ${statInfo}`);

			assert.deepStrictEqual(stats.perSliceMeasurements.sliceCriteriaSizes, {
				min:    1,
				max:    1,
				median: 1,
				mean:   1,
				std:    0,
				total:  1
			});

		});
		test('Slicing the same code three times', async() => {
			const slicer = new BenchmarkSlicer('r-shell');
			const request = {
				request: 'text' as const,
				content: `library(x)
a <- 3
b <- a + 4
c <- 5
d <- b + 5
cat(c, d)
cat(d)`
			};
			await slicer.init(request, defaultConfigOptions);
			await slicer.slice('2@a');
			await slicer.slice('2@a', '4@c');
			await slicer.slice('7@d');
			const { stats, statInfo } = await retrieveStatsSafe(slicer, request);

			assert.deepStrictEqual(stats.input, {
				numberOfLines:                             7,
				numberOfNonEmptyLines:                     7,
				numberOfCharacters:                        63,
				numberOfCharactersNoComments:              63,
				numberOfNonWhitespaceCharacters:           44,
				numberOfNonWhitespaceCharactersNoComments: 44,
				// checked manually
				numberOfRTokens:                           56,
				numberOfRTokensNoComments:                 56,
				numberOfNormalizedTokens:                  31,
				numberOfNormalizedTokensNoComments:        31
			}, statInfo);
			assert.deepStrictEqual(stats.dataflow, {
				numberOfNodes:               23,
				numberOfEdges:               38,
				numberOfCalls:               9,
				numberOfFunctionDefinitions: 0,
				sizeOfObject:                1922,
				storedVertexIndices:         0,
				storedEnvIndices:            0,
				overwrittenIndices:          0,
			}, statInfo);

			assert.strictEqual(stats.perSliceMeasurements.numberOfSlices, 3, `sliced three times ${statInfo}`);

			assert.deepStrictEqual(stats.perSliceMeasurements.sliceSize, {
				// only one entry
				lines:                             { min: 2,  max: 5,  median: 3,  mean: (2+3+5)/3,          std: 1.247219128924647,  total: 10 },
				nonEmptyLines:                     { min: 2,  max: 5,  median: 3,  mean: (2+3+5)/3,          std: 1.247219128924647,  total: 10 },
				characters:                        { min: 17, max: 41, median: 24, mean: 27.333333333333332, std: 10.077477638553981, total: 82 },
				charactersNoComments:              { min: 17, max: 41, median: 24, mean: 27.333333333333332, std: 10.077477638553981, total: 82 },
				nonWhitespaceCharacters:           { min: 14, max: 27, median: 18, mean: 19.666666666666668, std: 5.436502143433363,  total: 59 },
				nonWhitespaceCharactersNoComments: { min: 14, max: 27, median: 18, mean: 19.666666666666668, std: 5.436502143433363,  total: 59 },
				tokens:                            { min: 13, max: 35, median: 19, mean: 22.333333333333332, std: 9.285592184789413,  total: 67 },
				tokensNoComments:                  { min: 13, max: 35, median: 19, mean: 22.333333333333332, std: 9.285592184789413,  total: 67 },
				normalizedTokens:                  { min: 8,  max: 19, median: 11, mean: (8+11+19)/3,        std: 4.642796092394707,  total: 38 },
				normalizedTokensNoComments:        { min: 8,  max: 19, median: 11, mean: (8+11+19)/3,        std: 4.642796092394707,  total: 38 },
				dataflowNodes:                     { min: 5,  max: 16, median: 8,  mean: (5+8+16)/3,         std: 4.642796092394707,  total: 29 },
				linesWithAutoSelected:             { min: 0,  max: 0,  median: 0,  mean: 0,                  std: 0,                  total: 0  }
			}, statInfo);

			assert.deepStrictEqual(stats.perSliceMeasurements.sliceCriteriaSizes, {
				min:    1,
				max:    2,
				median: 1,
				mean:   (1+2+1)/3,
				std:    0.4714045207910317,
				total:  4
			}, statInfo);

		});

		describe('Slicing with pointer-tracking enabled', () => {
			test('When indices are stored, then correct values are counted', async() => {
				const slicer = new BenchmarkSlicer('r-shell');
				const request = {
					request: 'text' as const,
					content: `
person <- list(firstName = "John", lastName = "Doe", age = 32)

person$firstName <- "Jane"
person$lastName <- "eoD"
person$age <- 34
person$zipCode <- 67890
person$city <- "other example"

person$city <- list(name = "big-city", lat = 12.345, lon = 67.890, country = "foo")

person$age <- 42

print(person$age)`,
					pointerTracking: true
				};

				await slicer.init(request, amendConfig(defaultConfigOptions, c => {
					c.solver.pointerTracking = true;
					return c;
				}));
				await slicer.slice('14@print');

				const { stats, statInfo } = await retrieveStatsSafe(slicer, request);

				// 'storedEnvIndices' are less because indices are overwritten
				assert.deepStrictEqual(stats.dataflow, {
					...stats.dataflow,
					storedVertexIndices: 14,
					storedEnvIndices:    13,
					overwrittenIndices:  1,
				}, statInfo);
			});
		});

		describe('Slicing with sampling enabled', () => {
			test('When equidistant sampling is enabled, then correct values are counted', async() => {
				const slicer = new BenchmarkSlicer('r-shell');
				const request = {
					request: 'text' as const,
					content: `
a <- 1
b <- 2
c <- 3
d <- 4
e <- 5`,
				};

				await slicer.init(request, defaultConfigOptions);
				const slicedCount = await slicer.sliceForAll(DefaultAllVariablesFilter, (_1, _2, criteria) => {
					assert.deepStrictEqual(criteria, [['$0'], ['$6'], ['$12']], 'Correct criteria');
				}, { sampleCount: 3, sampleStrategy: 'equidistant' });
				slicer.finish();

				const { stats } = await retrieveStatsSafe(slicer, request);

				assert.equal(slicedCount, 3, 'Sliced three times');
				assert.equal(stats.perSliceMeasurements.numberOfSlices, 3, 'Sliced three times');
				assert.deepStrictEqual(stats.perSliceMeasurements.sliceCriteriaSizes,
					{
						min:    1,
						max:    1,
						median: 1,
						mean:   1,
						std:    0,
						total:  3
					},
					'Correct slice sizes'
				);
			});

			test('When random sampling is enabled, then correct values are counted', async() => {
				const slicer = new BenchmarkSlicer('r-shell');
				const request = {
					request: 'text' as const,
					content: `
a <- 1
b <- 2
c <- 3
d <- 4
e <- 5`,
				};

				await slicer.init(request, defaultConfigOptions);
				const slicedCount = await slicer.sliceForAll(DefaultAllVariablesFilter, (_1, _2, criteria) => {
					assert.equal(criteria.length, 3, '3 criteria are sliced');
				}, { sampleCount: 3, sampleStrategy: 'random' });
				slicer.finish();

				const { stats } = await retrieveStatsSafe(slicer, request);

				assert.equal(slicedCount, 3, 'Sliced three times');
				assert.equal(stats.perSliceMeasurements.numberOfSlices, 3, 'Sliced three times');
				assert.deepStrictEqual(stats.perSliceMeasurements.sliceCriteriaSizes,
					{
						min:    1,
						max:    1,
						median: 1,
						mean:   1,
						std:    0,
						total:  3
					},
					'Correct slice sizes'
				);
			});
		});
		describe('Control flow graph and data frame shape inference', () => {
			test('Data frame shape inference', async() => {
				const slicer = new BenchmarkSlicer('tree-sitter');
				const request = requestFromInput('df <- data.frame(id = 1:3, age = c(25, 30, 40))');
				await slicer.init(request, defaultConfigOptions);
				slicer.extractCFG();
				slicer.inferDataFrameShapes();

				const { stats: rawStats } = slicer.finish();
				const stats = await summarizeSlicerStats(rawStats);
				const statInfo = stats2string(stats);
				guard(isNotUndefined(stats.dataFrameShape), 'Abstact interpretation stats cannot be undefined');

				const measurements: CommonSlicerMeasurements[] = [...RequiredSlicerMeasurements, 'extract control flow graph', 'infer data frame shapes'];
				assert.strictEqual(stats.request, request, statInfo);
				assert.sameMembers([...stats.commonMeasurements.keys()], measurements, `Must have all keys in common measurements ${statInfo}`);

				const { numberOfEmptyNodes: _numberOfEmptyNodes, sizeOfInfo: _sizeOfInfo, ...dataFrameShapeStats } = stats.dataFrameShape;
				assert.deepStrictEqual(dataFrameShapeStats, {
					// checked manually
					numberOfDataFrameFiles:    1,
					numberOfNonDataFrameFiles: 0,
					numberOfResultConstraints: 2,
					numberOfResultingValues:   2,
					numberOfResultingTop:      0,
					numberOfResultingBottom:   0,
					numberOfOperationNodes:    1,
					numberOfValueNodes:        2,
					numberOfEntriesPerNode:    { min: 1, max: 2, median: 2, mean: 1.5, std: 0.5, total: 3 },
					numberOfOperations:        1,
					numberOfTotalValues:       1,
					numberOfTotalTop:          0,
					numberOfTotalBottom:       0,
					inferredColNames:          { min: 2, max: 2, median: 2, mean: 2, std: 0, total: 2 },
					numberOfColNamesValues:    1,
					numberOfColNamesTop:       0,
					numberOfColNamesBottom:    0,
					inferredColCount:          { min: 2, max: 2, median: 2, mean: 2, std: 0, total: 2 },
					numberOfColCountExact:     1,
					numberOfColCountValues:    1,
					numberOfColCountTop:       0,
					numberOfColCountInfinite:  0,
					numberOfColCountBottom:    0,
					approxRangeColCount:       { min: 0, max: 0, median: 0, mean: 0, std: 0, total: 0 },
					inferredRowCount:          { min: 3, max: 3, median: 3, mean: 3, std: 0, total: 3 },
					numberOfRowCountExact:     1,
					numberOfRowCountValues:    1,
					numberOfRowCountTop:       0,
					numberOfRowCountInfinite:  0,
					numberOfRowCountBottom:    0,
					approxRangeRowCount:       { min: 0, max: 0, median: 0, mean: 0, std: 0, total: 0 },
					perOperationNumber:        new Map([...DataFrameOperationNames.map<[DataFrameOperationName, number]>(name => [name, 0]), ['create', 1]])
				}, statInfo);
			});
		});
	});
});
