import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { CloneIndex, type SerializedCloneIndex } from '../../../src/clones/clone-index';
import { ClonePerspective, CloneTokenization, cloneTree, tokenize } from '../../../src/clones/clone-ast';
import { greedyStringTiling, type GstMatch } from '../../../src/clones/algorithms/greedy-string-tiling';
import { fingerprints, kgramHashes, winnow } from '../../../src/clones/algorithms/winnowing';
import { baxterClones, treeSimilarity } from '../../../src/clones/algorithms/baxter-ast';
import { CloneAlgorithm, type CloneDetectionConfig, CloneScope, DefaultCloneDetectionConfig, detectClones } from '../../../src/clones/clone-detector';

const matchedTokens = (tiles: readonly GstMatch[]) => tiles.reduce((n, t) => n + t.length, 0);

async function indexOf(parser: KnownParser, code: string, perspective: ClonePerspective = ClonePerspective.Syntax) {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	analyzer.addRequest(requestFromInput(code));
	return CloneIndex.build(analyzer, { perspective });
}
async function treesOf(parser: KnownParser, code: string, perspective: ClonePerspective = ClonePerspective.Syntax) {
	const index = await indexOf(parser, code, perspective);
	return index.files.map(f => cloneTree(f, perspective));
}
async function exactTokens(parser: KnownParser, code: string, perspective: ClonePerspective) {
	return tokenize((await treesOf(parser, code, perspective))[0], CloneTokenization.Exact);
}

describe('Code clones', withTreeSitter(parser => {
	describe('Perspectives', () => {
		const same: [string, string, ClonePerspective][] = [
			['y <- f(x, 2)', 'x |> f(2) -> y', ClonePerspective.Canonical],
			['y <- f(x, 2)', 'y = x %>% f(2)', ClonePerspective.Canonical],
			['y <- f(2, x)', 'y <- x %>% f(2, .)', ClonePerspective.Canonical],
			['f <- function(x) x + 1', 'f <- \\(x) {(x + 1)}', ClonePerspective.Canonical],
			['g <- function(x) { x + 1 }', 'g <- function(x) { return(x + 1) }', ClonePerspective.Canonical],
			['a$b', 'a[["b"]]', ClonePerspective.Canonical],
			['TRUE', 'T', ClonePerspective.Canonical],
			['g(f(x))', 't <- f(x)\ng(t)', ClonePerspective.Dataflow]
		];
		for(const [a, b, perspective] of same) {
			test(`${a} ~ ${b} (${perspective})`, async() => {
				assert.deepStrictEqual(await exactTokens(parser, a, perspective), await exactTokens(parser, b, perspective));
			});
		}
		const different: [string, string][] = [
			// the inlined value would read the redefined x
			['t <- f(x)\nx <- 2\ng(t)', 'x <- 2\ng(f(x))'],
			// the inlined value would run three times or only conditionally
			['t <- f(x)\nfor(i in 1:3) g(t)', 'for(i in 1:3) g(f(x))'],
			['t <- f()\nif(a) g(t)', 'if(a) g(f())']
		];
		for(const [a, b] of different) {
			test(`dataflow keeps ${JSON.stringify(a)} apart from ${JSON.stringify(b)}`, async() => {
				assert.notDeepEqual(await exactTokens(parser, a, ClonePerspective.Dataflow), await exactTokens(parser, b, ClonePerspective.Dataflow));
			});
		}
		test('dataflow keeps temporaries read twice', async() => {
			const [kept, inlined] = [await exactTokens(parser, 't <- f(x)\ng(t, t)', ClonePerspective.Dataflow), await exactTokens(parser, 'g(f(x), f(x))', ClonePerspective.Dataflow)];
			assert.notDeepEqual(kept, inlined);
		});
		test('rewritten nodes keep their provenance', async() => {
			const [tree] = await treesOf(parser, 'x |> f()', ClonePerspective.Canonical);
			// the inserted argument stems from `x`, the call from `f()`
			assert.deepStrictEqual(tree.nodes.slice(1).map(n => n !== '<>' && n.lexeme), ['f', 'f', '', 'x']);
		});
	});

	describe('Greedy String Tiling', () => {
		test('identical sequences are fully tiled', () => {
			const t = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const m = greedyStringTiling(t, t, 3);
			assert.strictEqual(matchedTokens(m), 10);
		});
		test('a run of equal tokens matches', () => {
			const t = [64, 64, 64, 64, 64, 64, 64, 1];
			assert.strictEqual(matchedTokens(greedyStringTiling(t, t, 8)), 8);
		});
		test('moved blocks are found, short matches are not', () => {
			const a = [1, 2, 3, 4, 9, 5, 6, 7, 8];
			const b = [5, 6, 7, 8, 1, 2, 3, 4, 10, 11];
			const m = greedyStringTiling(a, b, 4);
			assert.deepStrictEqual(m.map(x => [x.left, x.right, x.length]).sort(), [[0, 4, 4], [5, 0, 4]]);
			assert.strictEqual(greedyStringTiling(a, b, 5).length, 0);
		});
	});

	describe('Winnowing', () => {
		test('robust winnowing keeps the previous selection on ties', () => {
			// Definition 3: of ten equal hashes and windows of four, only every fourth one is selected
			assert.deepStrictEqual(winnow(new Uint32Array(10).fill(5), 4).map(f => f.position), [3, 7]);
		});
		test('robust winnowing selects the rightmost minimum once per window', () => {
			// the example of the paper (Fig. 2): hashes and windows of size 4
			const hashes = Uint32Array.from([77, 74, 42, 17, 98, 50, 17, 98, 8, 88, 67, 39, 77, 74, 42, 17, 98]);
			assert.deepStrictEqual(winnow(hashes, 4).map(f => f.hash), [17, 17, 8, 39, 17]);
		});
		test('shared runs of t tokens share a fingerprint', () => {
			const run = [11, 12, 13, 14, 15, 16, 17, 18];
			const a = [1, 2, 3, ...run, 4];
			const b = [9, ...run, 8, 7, 6];
			const fa = new Set(fingerprints(a, 3, 8).map(f => f.hash));
			assert.isTrue(fingerprints(b, 3, 8).some(f => fa.has(f.hash)));
			assert.strictEqual(kgramHashes(a, 3).length, a.length - 2);
		});
	});

	describe('Baxter', () => {
		test('pairs within an accepted clone are dropped, also with a third occurrence', async() => {
			const body = 'y <- a + b * c - d / e';
			const trees = await treesOf(parser, `f <- function() {\n${body}\nz <- 1\n}\ng <- function() {\n${body}\nz <- 1\n}\n${body}`);
			const pairs = baxterClones(trees, { massThreshold: 5, similarityThreshold: 0.5 }).pairs;
			const ast = trees[0];
			const covered = (p: { node: number }) => pairs.some(q => [q.a, q.b].some(m => m.node < p.node && p.node < m.node + ast.size[m.node]));
			assert.isTrue(pairs.length > 0);
			assert.isFalse(pairs.some(p => covered(p.a) || covered(p.b)));
		});
		test('similarity counts shared nodes', async() => {
			const [ast] = await treesOf(parser, 'f(a + b)\nf(a + c)');
			const [s1, s2] = [1, 1 + ast.size[1]];
			// 2S / (2S + L + R) with 5 of 6 nodes shared
			assert.strictEqual(treeSimilarity(ast, s1, ast, s2), 5 / 6);
		});
	});

	describe('Detection', () => {
		const fileA = 'normalize <- function(v) {\n  m <- mean(v)\n  s <- sd(v)\n  out <- (v - m) / s\n  out[is.na(out)] <- 0\n  out\n}\n';
		const fileB = 'scale_it <- function(values) {\n  mu <- mean(values)\n  sigma <- sd(values)\n  res <- (values - mu) / sigma\n  res[is.na(res)] <- 0\n  res\n}\n';
		const fileC = 'other <- function(n) {\n  for(i in seq_len(n)) print(i)\n}\n';
		for(const algorithm of Object.values(CloneAlgorithm)) {
			test(`${algorithm} finds the renamed clone across files`, async() => {
				const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
				analyzer.addFile(new FlowrInlineTextFile('a.R', fileA), new FlowrInlineTextFile('b.R', fileB), new FlowrInlineTextFile('c.R', fileC));
				analyzer.addRequest({ request: 'file', content: 'a.R' }, { request: 'file', content: 'b.R' }, { request: 'file', content: 'c.R' });
				const index = await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical });
				const config: CloneDetectionConfig = { ...DefaultCloneDetectionConfig, algorithms: [algorithm], scope: CloneScope.CrossFile, baxter: { massThreshold: 10, similarityThreshold: 0.5 } };
				const result = detectClones(index, config);
				const files = result.pairs.map(p => [p.a.file, p.b.file].sort().join('|'));
				assert.include(files, 'a.R|b.R', JSON.stringify(result.pairs));
				assert.notInclude(files, 'a.R|c.R');
			});
		}
		test('a serialized index round-trips and can be searched against', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(requestFromInput(fileA));
			const corpus = CloneIndex.deserialize(JSON.parse(JSON.stringify(CloneIndex.serialize(await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical })))) as SerializedCloneIndex);
			const query = await indexOf(parser, fileB, ClonePerspective.Canonical);
			const result = detectClones(query, { ...DefaultCloneDetectionConfig, algorithms: [CloneAlgorithm.Gst, CloneAlgorithm.Winnowing] }, corpus);
			assert.lengthOf(result.pairs.filter(p => p.algorithm === CloneAlgorithm.Gst), 1);
			assert.lengthOf(result.pairs.filter(p => p.algorithm === CloneAlgorithm.Winnowing), 1);
			assert.isTrue(result.pairs.every(p => p.b.external));
		});
	});
}));
