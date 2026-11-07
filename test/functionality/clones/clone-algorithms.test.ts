import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { CloneIndex, type SerializedCloneIndex } from '../../../src/clones/clone-index';
import { ClonePerspective, CloneNodeKind } from '../../../src/clones/clone-ast';
import { CloneTokenization, JPlagRToken, tokenize } from '../../../src/clones/clone-tokens';
import { PdgColor, similarCompare } from '../../../src/clones/algorithms/similar';
import { greedyStringTiling, gstSequence, gstSimilarity, matchedTokens } from '../../../src/clones/algorithms/greedy-string-tiling';
import { fingerprints, kgramHashes, winnow } from '../../../src/clones/algorithms/winnowing';
import { baxterClones, treeSimilarity } from '../../../src/clones/algorithms/baxter-ast';
import { CloneAlgorithm, type CloneDetectionConfig, CloneScope, DefaultCloneDetectionConfig, detectClones } from '../../../src/clones/clone-detector';

async function indexOf(parser: KnownParser, code: string, perspective: ClonePerspective = ClonePerspective.Syntax, pdgs = false) {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	analyzer.addRequest(requestFromInput(code));
	return CloneIndex.build(analyzer, { perspective, pdgs });
}

describe('Code clones', withTreeSitter(parser => {
	describe('JPlag R tokens', () => {
		const cases: [string, readonly number[]][] = [
			['x <- 1', [JPlagRToken.Assign, JPlagRToken.Number]],
			['x = "a"', [JPlagRToken.AssignFunc, JPlagRToken.String]],
			['f()', [JPlagRToken.FunctionCall, JPlagRToken.AssignList]],
			['pkg::f(a, b = TRUE)', [JPlagRToken.FunctionCall, JPlagRToken.Package, JPlagRToken.AssignList, JPlagRToken.AssignList, JPlagRToken.AssignFunc, JPlagRToken.Bool]],
			/* the expected token strings below were produced by JPlag's own R.g4 and RListener (ANTLR 4.13.2) */
			['f(a = 1)', [JPlagRToken.FunctionCall, JPlagRToken.AssignList, JPlagRToken.AssignFunc, JPlagRToken.Number]],
			['x <- f(1)', [JPlagRToken.FunctionCall, JPlagRToken.Assign, JPlagRToken.AssignList, JPlagRToken.Number]],
			['y = g(x)', [JPlagRToken.FunctionCall, JPlagRToken.AssignFunc, JPlagRToken.AssignList]],
			['base::x[1]', [JPlagRToken.Package, JPlagRToken.Index, JPlagRToken.AssignList, JPlagRToken.Number]],
			['`a b` <- 1', [JPlagRToken.Assign, JPlagRToken.String, JPlagRToken.Number]],
			['x[1, ]', [JPlagRToken.Index, JPlagRToken.AssignList, JPlagRToken.Number, JPlagRToken.AssignList]],
			['x[[i]]$a', [JPlagRToken.Index, JPlagRToken.AssignList]],
			['if(x) { y } else NULL', [JPlagRToken.IfBegin, JPlagRToken.CompoundBegin, JPlagRToken.CompoundEnd, JPlagRToken.IfEnd]],
			['for(i in 1:10) next', [JPlagRToken.ForBegin, JPlagRToken.Number, JPlagRToken.Number, JPlagRToken.Next, JPlagRToken.ForEnd]],
			['while(TRUE) break', [JPlagRToken.WhileBegin, JPlagRToken.Bool, JPlagRToken.Break, JPlagRToken.WhileEnd]],
			['repeat { }', [JPlagRToken.RepeatBegin, JPlagRToken.CompoundBegin, JPlagRToken.CompoundEnd, JPlagRToken.RepeatEnd]],
			['function(a = 1) a', [JPlagRToken.BeginFunction, JPlagRToken.Number, JPlagRToken.EndFunction]],
			['?mean', [JPlagRToken.Help]],
			['c(Inf, NaN, NA, NULL, T, 2L)', [JPlagRToken.FunctionCall, JPlagRToken.AssignList, JPlagRToken.AssignList, JPlagRToken.AssignList, JPlagRToken.AssignList, JPlagRToken.AssignList, JPlagRToken.AssignList, JPlagRToken.Number]]
		];
		for(const [code, expected] of cases) {
			test(code, async() => {
				const index = await indexOf(parser, code);
				assert.deepStrictEqual([...tokenize(index.files[0], CloneTokenization.Jplag).values], [...expected]);
			});
		}
	});

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
				const [ia, ib] = [await indexOf(parser, a, perspective), await indexOf(parser, b, perspective)];
				const ta = tokenize(ia.files[0], CloneTokenization.Exact), tb = tokenize(ib.files[0], CloneTokenization.Exact);
				assert.deepStrictEqual([...ta.values], [...tb.values]);
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
				const [ia, ib] = [await indexOf(parser, a, ClonePerspective.Dataflow), await indexOf(parser, b, ClonePerspective.Dataflow)];
				assert.notDeepEqual([...tokenize(ia.files[0], CloneTokenization.Exact).values], [...tokenize(ib.files[0], CloneTokenization.Exact).values]);
			});
		}
		test('canonical does not depend on whether a dataflow graph is built', async() => {
			const [without, withPdgs] = [await indexOf(parser, 'x %>% f(y, .)', ClonePerspective.Canonical, false), await indexOf(parser, 'x %>% f(y, .)', ClonePerspective.Canonical, true)];
			assert.deepStrictEqual([...tokenize(without.files[0], CloneTokenization.Exact).values], [...tokenize(withPdgs.files[0], CloneTokenization.Exact).values]);
		});
		test('dataflow keeps temporaries read twice', async() => {
			const index = await indexOf(parser, 't <- f(x)\ng(t, t)', ClonePerspective.Dataflow);
			assert.isTrue(index.files[0].kind.includes(CloneNodeKind.BinaryOp));
		});
		test('rewritten nodes keep their provenance', async() => {
			const index = await indexOf(parser, 'x |> f()', ClonePerspective.Canonical);
			const ast = index.files[0];
			// the inserted argument stems from `x`, the call from `f()`
			assert.strictEqual(ast.span[4 * 1], 1);
			assert.strictEqual(ast.text[ast.kind.indexOf(CloneNodeKind.Symbol, 3)], 'x');
		});
	});

	describe('SimilaR (paper example, Bartoszuk and Gagolewski 2020)', () => {
		const clamp1 = 'clamp1 <- function(x)\n{\n  if (max(x)-min(x) < 1e-5)\n    NULL\n  else\n    (x - min(x))/(max(x)-min(x))\n}';
		const standardise = 'standardise <- function(x)\n{\n  if (sd(x) < 1e-5)\n    NULL\n  else\n    (x - mean(x))/sd(x)\n}';
		test('PDGs of Figures 3 and 4', async() => {
			const index = await indexOf(parser, clamp1 + '\n' + standardise, ClonePerspective.Syntax, true);
			const [f, g] = index.pdgs?.[0] ?? [];
			const colors = (p: { color: Uint8Array }) => [...p.color].sort((a, b) => a - b);
			assert.deepStrictEqual(colors(f), [PdgColor.Entry, PdgColor.If, PdgColor.IfPart, PdgColor.Parameter, PdgColor.FunOneArgument, PdgColor.FunOneArgument,
				PdgColor.ArithmeticOperator, PdgColor.ArithmeticOperator, PdgColor.ArithmeticOperator, PdgColor.ComparisonOperator, PdgColor.Constant].sort((a, b) => a - b));
			assert.strictEqual(g.color.length, 10);
		});
		test('Table 8: similarity per iteration and in total', async() => {
			const index = await indexOf(parser, clamp1 + '\n' + standardise, ClonePerspective.Syntax, true);
			const [f, g] = index.pdgs?.[0] ?? [];
			const r = similarCompare(f, g, 3);
			const round = (x: number) => Math.round(x * 100) / 100;
			assert.deepStrictEqual(r.iterations.map(round), [0.95, 0.86, 0.57]);
			assert.strictEqual(round(r.symmetric), 0.79);
			assert.strictEqual(round(r.fInG), 0.76);
			assert.strictEqual(round(r.gInF), 0.83);
		});
		test('clamp2 obfuscation is identical to clamp1 (with magrittr attached, as in the paper)', async() => {
			const clamp2 = 'clamp2 <- function(y)\n{\n  longName <- y\n  longName2 <- min\n  z <- { sum(longName**2) }\n  min_y <- longName %>% longName2\n  max_y <- y %>% max\n  max_y_min_y <- max_y-min_y\n  if(!(max_y_min_y >= 1e-5))\n  {\n    return(NULL)\n  }\n  ((y - min_y)/max_y_min_y)\n}';
			const index = await indexOf(parser, 'library(magrittr)\n' + clamp1 + '\n' + clamp2, ClonePerspective.Syntax, true);
			const [f, g] = index.pdgs?.[0] ?? [];
			const r = similarCompare(f, g, 3);
			assert.strictEqual(r.symmetric, 1);
		});
	});

	describe('Greedy String Tiling', () => {
		test('identical sequences are fully tiled', () => {
			const t = Int32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			const m = greedyStringTiling(gstSequence(t, 0), gstSequence(t, 0), 3);
			assert.strictEqual(matchedTokens(m), 10);
			assert.strictEqual(gstSimilarity(matchedTokens(m), 10, 10), 1);
		});
		test('a window hashing to -1 still matches', () => {
			// JPlag reserves -1 as "no hash"; our token values are non-negative, as JPlag's are
			const t = Int32Array.from([64, 64, 64, 64, 64, 64, 64, 1]);
			assert.strictEqual(matchedTokens(greedyStringTiling(gstSequence(t, 0), gstSequence(t, 0), 8)), 8);
		});
		test('moved blocks are found, short matches are not', () => {
			const a = Int32Array.from([1, 2, 3, 4, 9, 5, 6, 7, 8]);
			const b = Int32Array.from([5, 6, 7, 8, 1, 2, 3, 4, 10, 11]);
			const m = greedyStringTiling(gstSequence(a, 0), gstSequence(b, 0), 4);
			assert.deepStrictEqual(m.map(x => [x.left, x.right, x.length]).sort(), [[0, 4, 4], [5, 0, 4]]);
			assert.strictEqual(greedyStringTiling(gstSequence(a, 0), gstSequence(b, 0), 5).length, 0);
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
			const a = Int32Array.from([1, 2, 3, ...run, 4]);
			const b = Int32Array.from([9, ...run, 8, 7, 6]);
			const fa = new Set(fingerprints(a, 3, 8).map(f => f.hash));
			assert.isTrue(fingerprints(b, 3, 8).some(f => fa.has(f.hash)));
			assert.strictEqual(kgramHashes(a, 3).length, a.length - 2);
		});
	});

	describe('Baxter', () => {
		test('pairs within an accepted clone are dropped, also with a third occurrence', async() => {
			const body = 'y <- a + b * c - d / e';
			const index = await indexOf(parser, `f <- function() {\n${body}\nz <- 1\n}\ng <- function() {\n${body}\nz <- 1\n}\n${body}`);
			const pairs = baxterClones(index.files, { massThreshold: 5, similarityThreshold: 0.5 }).pairs;
			const ast = index.files[0];
			const covered = (p: { node: number }) => pairs.some(q => [q.a, q.b].some(m => m.node < p.node && p.node < m.node + ast.size[m.node]));
			assert.isTrue(pairs.length > 0);
			assert.isFalse(pairs.some(p => covered(p.a) || covered(p.b)));
		});
		test('similarity counts shared nodes', async() => {
			const index = await indexOf(parser, 'f(a + b)\nf(a + c)');
			const ast = index.files[0];
			const [s1, s2] = [...ast.kind.keys()].filter(i => ast.parent[i] === 0);
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
				const index = await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical, pdgs: algorithm === CloneAlgorithm.Similar });
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
			const corpus = CloneIndex.deserialize(JSON.parse(JSON.stringify(CloneIndex.serialize(await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical, pdgs: true })))) as SerializedCloneIndex);
			const query = await indexOf(parser, fileB, ClonePerspective.Canonical, true);
			const result = detectClones(query, { ...DefaultCloneDetectionConfig, algorithms: [CloneAlgorithm.Gst, CloneAlgorithm.Similar] }, corpus);
			assert.lengthOf(result.pairs.filter(p => p.algorithm === CloneAlgorithm.Gst), 1);
			assert.lengthOf(result.pairs.filter(p => p.algorithm === CloneAlgorithm.Similar), 1);
		});
	});
}));
