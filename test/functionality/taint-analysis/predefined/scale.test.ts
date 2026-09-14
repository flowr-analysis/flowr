import { test, describe } from 'vitest';
import type { TaintAnalysisExpectation } from '../helper';
import { testPredefinedTaintAnalysis } from '../helper';
import { scaleAnalysis, ZScore, ZeroCentered, MinMax, Unscaled } from '../../../../src/taint-analysis/predefined/scale-analysis';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { decorateLabelContext, label } from '../../_helper/label';
import { testLoopFixpoint } from '../loop-helper';

function testScale(name: string, code: string, expectation: TaintAnalysisExpectation): void {
	const effectiveName = decorateLabelContext(label(name), ['taint']);
	test(effectiveName, async() => {
		await testPredefinedTaintAnalysis(code, 'scale', expectation);
	});
}

describe('Taint Analysis Scale', () => {
	testScale('unrelated assignment', 'x <- 42', { '1@x': undefined });
	testScale('tainting of z-score scaled value', 'x <- scale(x)', { '1@x': ZScore });
	testScale('center only (no scaling)', 'x <- scale(x, scale = FALSE)', { '1@x': ZeroCentered });
	testScale('scale only (calculates root mean square)', ' x <- scale(x, center = FALSE)', { '1@x': Top });
	testScale('no centering and no scaling (identity)', ' x <- scale(x, center = FALSE, scale = FALSE)', { '1@x': Top });
	testScale('mean after zero-centered scaling -> Bottom', `
			x <- scale(x, scale = FALSE)
			x <- mean(x)`,
	{
		'2@x': Bottom,
	});
	testScale('mean after z-score scaling -> Bottom', `
			x <- scale(x)
			x <- mean(x)`,
	{
		'2@x': Bottom,
	});
	testScale('call to rescale after scales package import -> MinMax', `
			library(scales)
			x <- rescale(x)`,
	{
		'2@x': MinMax,
	});
	testScale('call to rescale from scales package -> MinMax', 'x <- scales::rescale(x)', { '1@x': MinMax });
	testScale('interprocedural tracking: passing a scaled value into a user-defined function and returning it keeps the taint', `
			f <- function(v) { v }
			x <- scale(vector())
			y <- f(x)`,
	{
		'2@x': ZScore,
		'3@y': ZScore,
	});
	testScale('interprocedural tracking: scaling in a user-defined function adds the taint', `
			f <- function(v) { scale(v) }
			x <- vector()
			y <- f(x)`,
	{
		'2@x': Top,
		'3@y': ZScore,
	});
	testScale('interprocedural tracking: transformer in a user-defined function changes the taint', `
			f <- function(v) { round(v) }
			x <- scale(vector())
			y <- f(x)`,
	{
		'2@x': ZScore,
		'3@y': Unscaled,
	});
	testScale('interprocedural tracking: sources, sinks, and transformer update the taint', `
			g <- function(v) { head(v) }
			h <- function(v) { mean(scale(v)) }
			x <- scale(vector())
			y <- x |> g()
			z <- y |> h()
			`,
	{
		'3@x': ZScore,
		'4@y': Top,
		'5@z': Bottom,
	});

	describe('Shape functions widen to Top', () => {
		testScale('length of a scaled value is Top', 'x <- length(scale(vector()))', { '1@x': Top });
		testScale('nrow of a scaled value is Top', 'x <- nrow(scale(vector()))', { '1@x': Top });
		testScale('dim of a scaled value is Top', 'x <- dim(scale(vector()))', { '1@x': Top });
	});

	describe('Reshaping transformers widen scaled data to Top but preserve Unscaled', () => {
		testScale('filter widens a z-scored value to Top', 'x <- filter(scale(vector()))', { '1@x': Top });
		testScale('filter preserves an already Unscaled value', 'x <- filter(abs(vector()))', { '1@x': Unscaled });
		testScale('rep widens a z-scored value to Top', 'x <- rep(scale(vector()), 2)', { '1@x': Top });
		testScale('rep preserves an already Unscaled value', 'x <- rep(abs(vector()), 2)', { '1@x': Unscaled });
		testScale('which widens a z-scored value to Top', 'x <- which(scale(vector()))', { '1@x': Top });
		testScale('head preserves an already Unscaled value', 'x <- head(abs(vector()))', { '1@x': Unscaled });
	});

	describe('Untracked Operations Mapped to Top', () => {
		testScale('arithmetic on a scaled value breaks the chain (untracked, not Top)', `
				x <- scale(x)
				y <- x + 1`,
		{
			'1@x': ZScore,
			'2@y': undefined,
		});

		testScale('indexing a scaled value breaks the chain (untracked, not Top)', `
				x <- scale(df$col)
				y <- x[1]`,
		{
			'1@x': ZScore,
			'2@y': undefined,
		});

		testScale('subassignment into a scaled value breaks the chain (untracked, not Top)', `
				x <- scale(x)
				x[1] <- 0
				y <- x`,
		{
			'1@x': ZScore,
			'3@y': undefined,
		});

		testScale('do.call does not forward the scale() mapping', 'x <- do.call(scale, list(x))', { '1@x': Top });

		testScale('sapply over a scaled vector does not forward the mapping into its result', `
				x <- scale(x)
				y <- sapply(x, abs)`,
		{
			'1@x': ZScore,
			'2@y': Top,
		});
	});

	describe('Loops preserve the taint (no unexpected widening)', () => {
		testLoopFixpoint(scaleAnalysis, 're-scaling each iteration stays ZScore', 'x <- scale(vector())', 'x <- scale(x)', ZScore);
		testLoopFixpoint(scaleAnalysis, 'ZScore forwarded through the loop stays ZScore', 'x <- scale(vector())', 'x <- x', ZScore);
		testLoopFixpoint(scaleAnalysis, 'a reshaping transformer preserves Unscaled', 'x <- abs(vector())', 'x <- head(x)', Unscaled);
		testLoopFixpoint(scaleAnalysis, 'a transformer changing the pre-loop taint widens to Top', 'x <- scale(vector())', 'x <- head(x)', Top);
	});
});
