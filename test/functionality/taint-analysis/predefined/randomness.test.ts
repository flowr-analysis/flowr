import { describe, test } from 'vitest';
import { testTaintAnalysis, type TaintAnalysisExpectation } from '../helper';
import { randomnessAnalysis, Random, Deterministic } from '../../../../src/taint-analysis/predefined/randomness-analysis';
import { Top, Bottom } from '../../../../src/abstract-interpretation/domains/lattice';
import { decorateLabelContext, label } from '../../_helper/label';
import { testLoopFixpoint } from '../loop-helper';

function testRandomness(name: string, code: string, expectation: TaintAnalysisExpectation): void {
	const effectiveName = decorateLabelContext(label(name), ['taint']);
	test(effectiveName, async() => {
		await testTaintAnalysis(code, randomnessAnalysis, expectation);
	});
}

describe('Taint Analysis Randomness', () => {
	describe('Deterministic sources', () => {
		testRandomness('numeric is Deterministic', 'x <- numeric(5)', { '1@x': Deterministic });
		testRandomness('vector() is Deterministic', 'x <- vector()', { '1@x': Deterministic });
		testRandomness('vector(mode, length) is Deterministic', 'x <- vector("numeric", 5)', { '1@x': Deterministic });
		testRandomness('seq_len is Deterministic', 'x <- seq_len(5)', { '1@x': Deterministic });
		testRandomness('seq is Deterministic', 'x <- seq(1, 10)', { '1@x': Deterministic });
		testRandomness('is.numeric type check is Deterministic', 'x <- is.numeric(y)', { '1@x': Deterministic });
		testRandomness('is.matrix type check is Deterministic', 'x <- is.matrix(y)', { '1@x': Deterministic });
	});

	describe('Random sources', () => {
		testRandomness('runif is Random', 'x <- runif(5)', { '1@x': Random });
		testRandomness('rnorm is Random', 'x <- rnorm(10)', { '1@x': Random });
		testRandomness('rbinom is Random', 'x <- rbinom(5, 10, 0.5)', { '1@x': Random });
		testRandomness('sample is Random', 'x <- sample(1:10, 2)', { '1@x': Random });
		testRandomness('sample.int  is Random', 'x <- sample.int(10)', { '1@x': Random });
		testRandomness('jitter is Random', 'x <- jitter(y)', { '1@x': Random });
		testRandomness('kmeans is Random', 'x <- kmeans(m, 3)', { '1@x': Random });
		testRandomness('arima.sim is Random', 'x <- arima.sim(model, 100)', { '1@x': Random });
		testRandomness('dplyr::slice_sample is Random', 'x <- dplyr::slice_sample(df)', { '1@x': Random });

		testRandomness('namespaced stats::runif is Random', 'x <- stats::runif(5)', { '1@x': Random });
		testRandomness('namespaced base::sample is Random', 'x <- base::sample(1:10)', { '1@x': Random });

		testRandomness('set.seed is not a Random source (is manually excluded)', 's <- set.seed(1)', { '1@s': Top });

		testRandomness('set.seed does not alter the classification of a subsequent random draw', `
				set.seed(1)
				x <- runif(5)`,
		{ '2@x': Random });
	});

	describe('Pure computers propagate taint', () => {
		testRandomness('sum over a random vector propagates Random', 'x <- sum(runif(5))', { '1@x': Random });
		testRandomness('mean over a random vector propagates Random', 'x <- mean(runif(5))', { '1@x': Random });
		testRandomness('abs over a random vector propagates Random', 'x <- abs(rnorm(5))', { '1@x': Random });
		testRandomness('max over a random vector propagates Random', 'x <- max(runif(5))', { '1@x': Random });
		testRandomness('prod over a random vector propagates Random', 'x <- prod(runif(3))', { '1@x': Random });

		testRandomness('sum over a Deterministic source stays Deterministic', 'x <- sum(numeric(5))', { '1@x': Deterministic });
		testRandomness('sum over a Deterministic sequence stays Deterministic', 'x <- sum(seq_len(5))', { '1@x': Deterministic });
		testRandomness('mean over a Deterministic source widens to Top (empty ... arg joins to Top)', 'x <- mean(numeric(5))', { '1@x': Top });

		testRandomness('c() over literals is Top (literals are untracked)', 'x <- c(1, 2, 3)', { '1@x': Top });
		testRandomness('sum over literals is Top', 'x <- sum(c(1, 2, 3))', { '1@x': Top });
	});

	describe('Transformers', () => {
		testRandomness('as.numeric passes through Random', 'x <- as.numeric(runif(5))', { '1@x': Random });
		testRandomness('as.character passes through Random', 'x <- as.character(runif(5))', { '1@x': Random });
		testRandomness('as.numeric passes through Deterministic', 'x <- as.numeric(seq_len(5))', { '1@x': Deterministic });
		testRandomness('as.integer passes through Deterministic', 'x <- as.integer(numeric(5))', { '1@x': Deterministic });
		testRandomness('rep passes through Random', 'x <- rep(runif(5), 2)', { '1@x': Random });
		testRandomness('rep.int passes through Random', 'x <- rep.int(rnorm(3), 2)', { '1@x': Random });
		testRandomness('which passes through Random', 'x <- which(runif(5))', { '1@x': Random });
		testRandomness('which passes through Deterministic', 'x <- which(numeric(5))', { '1@x': Deterministic });
	});

	describe('Untracked operations', () => {
		testRandomness('unrelated literal assignment is untracked', 'x <- 42', { '1@x': undefined });
		testRandomness('arithmetic on a random value is untracked (operators are not modelled calls)', 'x <- runif(5) + 1', { '1@x': undefined });
		testRandomness('subassignment into a random value breaks the chain (untracked)', `
				x <- runif(5)
				x[1] <- 0
				y <- x`,
		{ '3@y': undefined });
	});

	describe('Interprocedural & higher-order propagation', () => {
		testRandomness('passing a random value through a user-defined identity function keeps Random', `
				f <- function(v) { v }
				x <- runif(5)
				y <- f(x)`,
		{ '3@y': Random });
		testRandomness('randomness generated inside a sapply closure propagates to the result', 'y <- sapply(1:5, function(i) runif(1))', { '1@y': Random });
		testRandomness('randomness generated inside a lapply closure propagates to the result', 'y <- lapply(1:5, function(i) rnorm(1))', { '1@y': Random });
	});

	describe('Sinks (Writes/Graphics + Value data argument from default-builtin-config)', () => {
		testRandomness('random data written via write.csv is flagged (Bottom finding)', 'x <- write.csv(runif(5), "out.csv")', { '1@x': Bottom });
		testRandomness('random data passed to cat is flagged', 'x <- cat(runif(5))', { '1@x': Bottom });
		testRandomness('random data passed to saveRDS is flagged', 'x <- saveRDS(runif(5), "f.rds")', { '1@x': Bottom });
		testRandomness('random data reaching a writer through a variable is flagged', `
				d <- runif(5)
				x <- write.csv(d, "out.csv")`,
		{ '2@x': Bottom });

		testRandomness('Deterministic data written via write.csv is not flagged', 'x <- write.csv(numeric(5), "out.csv")', { '1@x': Deterministic });
		testRandomness('a random connection description is not a data-flow finding (resource-path argument is not a data sink)', 'x <- file(runif(1))', { '1@x': Top });
	});

	describe('Statistical & plotting sinks', () => {
		testRandomness('random data passed to summary is flagged', 'x <- summary(runif(5))', { '1@x': Bottom });
		testRandomness('random data reaching summary through a variable is flagged', `
				d <- runif(5)
				x <- summary(d)`, { '2@x': Bottom });
		testRandomness('Deterministic data passed to summary is not flagged', 'x <- summary(numeric(5))', { '1@x': Deterministic });

		testRandomness('random data in an lm formula argument is flagged', 'x <- lm(runif(5))', { '1@x': Bottom });
		testRandomness('random data in an lm data argument is flagged', 'x <- lm(model, runif(5))', { '1@x': Bottom });

		testRandomness('random data passed to ggplot is flagged', 'x <- ggplot(runif(5))', { '1@x': Bottom });
		testRandomness('namespaced ggplot2::ggplot of random data is flagged', 'x <- ggplot2::ggplot(runif(5))', { '1@x': Bottom });
		testRandomness('Deterministic data passed to ggplot is not flagged', 'x <- ggplot(numeric(5))', { '1@x': Deterministic });
	});

	describe('Loops preserve the taint (no unexpected widening)', () => {
		testLoopFixpoint(randomnessAnalysis, 'a random source re-drawn each iteration stays Random', 'x <- runif(5)', 'x <- runif(5)', Random);
		testLoopFixpoint(randomnessAnalysis, 'Random forwarded through the loop stays Random', 'x <- runif(5)', 'x <- x', Random);
		testLoopFixpoint(randomnessAnalysis, 'Deterministic forwarded through the loop stays Deterministic', 'x <- numeric(5)', 'x <- x', Deterministic);
	});
});
