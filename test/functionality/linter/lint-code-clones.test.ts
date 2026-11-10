import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { CloneAlgorithm } from '../../../src/clones/clone-detector';
import { withTreeSitter } from '../_helper/shell';
import { assertLintedLines } from '../_helper/linter';

describe('flowR linter', withTreeSitter(parser => {
	describe('Code Clones', () => {
		const clone = `normalize <- function(v) {
	m <- mean(v)
	s <- sd(v)
	out <- (v - m) / s
	out[is.na(out)] <- 0
	out
}
scale_it <- function(values) {
	mu <- mean(values)
	sigma <- sd(values)
	res <- (values - mu) / sigma
	res[is.na(res)] <- 0
	res
}`;
		assertLintedLines('renamed copy of a function', parser, clone, 'code-clones', [1]);
		test('configured algorithms replace the default one', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(requestFromInput(clone));
			const linted = await analyzer.query({ type: 'linter', rules: [{ name: 'code-clones', config: { algorithms: [CloneAlgorithm.Winnowing] } } as never] });
			const results = (linted.results['code-clones'] as { results: { algorithm: CloneAlgorithm }[] }).results;
			assert.isNotEmpty(results);
			assert.isTrue(results.every(r => r.algorithm === CloneAlgorithm.Winnowing));
		});
		assertLintedLines('a single function has no clone', parser, 'f <- function(x) {\n  y <- x + 1\n  z <- y * 2\n  print(z)\n}', 'code-clones', []);
		assertLintedLines('different functions are no clones', parser, 'f <- function(x) { for(i in seq_len(x)) print(i) }\ng <- function(path) { d <- read.csv(path); summary(d); plot(d) }', 'code-clones', []);
	});
}));
