import { describe } from 'vitest';
import fs from 'fs';
import path from 'path';
import { IncrementalUpdateType } from '../../../../src/project/plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-update-type-plugin';
import { assertIncrementalSequence, singleFileSteps } from '../../util/incremental/dataflow-graph/incremental-assert';
import { fuzzedSequence, StatementPool, typingSequence } from '../../util/incremental/dataflow-graph/incremental-mutations';

const base = 'x <- 1\ny <- 2\nprint(x + y)';

describe('incremental dataflow', () => {
	describe('classifies and reuses', () => {
		assertIncrementalSequence('append a statement', singleFileSteps(base, { code: `${base}\nz <- x`, type: IncrementalUpdateType.AddedAtEnd, applied: true }));
		assertIncrementalSequence('remove the last statement', singleFileSteps(base, { code: 'x <- 1\ny <- 2', type: IncrementalUpdateType.RemovedAtEnd, applied: true }));
		assertIncrementalSequence('replace the last statement', singleFileSteps(base, { code: 'x <- 1\ny <- 2\nprint(y)', type: IncrementalUpdateType.ChangedAtEnd, applied: true }));
		assertIncrementalSequence('change the first statement', singleFileSteps(base, { code: 'x <- 3\ny <- 2\nprint(x + y)', type: IncrementalUpdateType.ChangedAtEnd, applied: false }));
		assertIncrementalSequence('change nothing', singleFileSteps(base, { code: base, type: IncrementalUpdateType.Nothing, applied: true }));
		assertIncrementalSequence('add a trailing comment', singleFileSteps(base, { code: `${base} # hey`, type: IncrementalUpdateType.Comment, applied: true }));
		assertIncrementalSequence('change a comment', singleFileSteps(`x <- 1 # a\n${base}`, { code: `x <- 1 # b\n${base}`, type: IncrementalUpdateType.Comment, applied: true }));
		assertIncrementalSequence('add trailing blank lines', singleFileSteps(base, { code: `${base}\n\n\n`, type: IncrementalUpdateType.Nothing, applied: true }));
		assertIncrementalSequence('move everything down', singleFileSteps(base, { code: `\n${base}`, type: IncrementalUpdateType.Location, applied: false }));
		assertIncrementalSequence('move the last statement down', singleFileSteps(base, { code: 'x <- 1\ny <- 2\n\nprint(x + y)', type: IncrementalUpdateType.Location, applied: true }));
		assertIncrementalSequence('move everything down and append', singleFileSteps(base, { code: `\n${base}\nz <- x`, type: IncrementalUpdateType.ChangedAtEnd, applied: false }));
		assertIncrementalSequence('move the last statement down and append', singleFileSteps(base, { code: 'x <- 1\ny <- 2\n\nprint(x + y)\nz <- x', type: IncrementalUpdateType.ChangedAtEnd, applied: true }));
		assertIncrementalSequence('append without checkpoints', singleFileSteps(base, { code: `${base}\nz <- x`, type: IncrementalUpdateType.AddedAtEnd, applied: false }), { checkpoints: 0 });
		assertIncrementalSequence('remove two statements with two checkpoints', singleFileSteps(base, { code: 'x <- 1', type: IncrementalUpdateType.RemovedAtEnd, applied: false }));
		assertIncrementalSequence('remove two statements with three checkpoints', singleFileSteps(base, { code: 'x <- 1', type: IncrementalUpdateType.RemovedAtEnd, applied: true }), { checkpoints: 3 });
		assertIncrementalSequence('append twice', singleFileSteps(base, { code: `${base}\nz <- x`, applied: true }, { code: `${base}\nz <- x\nw <- z`, applied: true }, { code: `${base}\nz <- x`, applied: true }));
		assertIncrementalSequence('append after an exit', singleFileSteps('x <- 1\nstop("no")', { code: 'x <- 1\nstop("no")\ny <- x', applied: true }, { code: 'x <- 1\nstop("no")\ny <- x\nprint(y)', applied: true }));
		assertIncrementalSequence('append after a conditional exit', singleFileSteps('x <- 1\nif(x) stop("no")', { code: 'x <- 1\nif(x) stop("no")\ny <- x', applied: true }));
		assertIncrementalSequence('append after a removal', singleFileSteps('x <- 1\nrm(x)', { code: 'x <- 1\nrm(x)\nx <- 2', applied: true }, { code: 'x <- 1\nrm(x)\nx <- 2\nprint(x)', applied: true }));
		assertIncrementalSequence('append a read of a super assignment', singleFileSteps('f <- function() x <<- 2\nf()', { code: 'f <- function() x <<- 2\nf()\nprint(x)', applied: true }));
		assertIncrementalSequence('append a call of an earlier closure', singleFileSteps('x <- 1\nf <- function() x', { code: 'x <- 1\nf <- function() x\nx <- 2\nf()', applied: true }));
		assertIncrementalSequence('append to an empty file', singleFileSteps('', { code: 'x <- 1', applied: false }, { code: 'x <- 1\ny <- x', applied: true }));
	});

	describe('sourced files', () => {
		const main = 'x <- 1\nsource("helper.R")\ny <- helper_value';
		/* the first source call lets the analyzer learn that the project has a second file, which classifies it anew and changes the configuration */
		assertIncrementalSequence('append after sourcing', [
			{ files: { 'main.R': main, 'helper.R': 'helper_value <- x' } },
			{ files: { 'main.R': `${main}\nprint(y)`, 'helper.R': 'helper_value <- x' }, applied: false },
			{ files: { 'main.R': `${main}\nprint(y)\nz <- y`, 'helper.R': 'helper_value <- x' }, applied: true }
		]);
		assertIncrementalSequence('change the sourced file only', [
			{ files: { 'main.R': main, 'helper.R': 'helper_value <- x' } },
			{ files: { 'main.R': main, 'helper.R': 'helper_value <- 2' }, applied: false }
		]);
		assertIncrementalSequence('change the sourced file and append', [
			{ files: { 'main.R': main, 'helper.R': 'helper_value <- x' } },
			{ files: { 'main.R': `${main}\nprint(y)`, 'helper.R': 'helper_value <- 2' }, applied: false }
		]);
		assertIncrementalSequence('add a source call', [
			{ files: { 'main.R': 'x <- 1', 'helper.R': 'helper_value <- x' } },
			{ files: { 'main.R': 'x <- 1\nsource("helper.R")', 'helper.R': 'helper_value <- x' }, type: IncrementalUpdateType.AddedAtEnd, applied: true },
			{ files: { 'main.R': 'x <- 1\nsource("helper.R")\nprint(helper_value)', 'helper.R': 'helper_value <- x' }, applied: false },
			{ files: { 'main.R': 'x <- 1\nsource("helper.R")\nprint(helper_value)\ny <- 2', 'helper.R': 'helper_value <- x' }, applied: true },
			{ files: { 'main.R': 'x <- 1', 'helper.R': 'helper_value <- x' } }
		]);
	});

	describe('multiple requested files', () => {
		assertIncrementalSequence('add a file at the end', [
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x' } },
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x', 'c.R': 'print(y)' }, type: IncrementalUpdateType.NewFileAtEnd, applied: true },
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x', 'c.R': 'print(y)' }, type: IncrementalUpdateType.Nothing, applied: true },
			{ files: { 'a.R': 'x <- 2', 'b.R': 'y <- x', 'c.R': 'print(y)' }, applied: false }
		], { allRequested: true });
		assertIncrementalSequence('change the last file', [
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x' } },
			{ files: { 'a.R': 'x <- 1', 'b.R': 'y <- x + 1' }, applied: false }
		], { allRequested: true });
	});

	describe('typing', () => {
		const programs: Record<string, readonly string[]> = {
			closures:  ['x <- 1', 'f <- function() x <<- x + 1', 'f()', 'print(x)', 'g <- function(y) y + x', 'g(2)'],
			removal:   ['x <- 1', 'y <- x', 'rm(x)', 'x <- y', 'print(x)'],
			ambient:   ['options(digits = 2)', 'par(mfrow = c(1, 1))', 'plot(1)', 'getOption("digits")', 'set.seed(1)', 'runif(1)'],
			exits:     ['x <- 1', 'if(x > 0) stop("no")', 'y <- 2', 'stop("now")', 'print(y)'],
			libraries: ['library(dplyr)', 'df <- data.frame(a = 1:3)', 'df |> filter(a > 1)', 'mutate(df, b = a)'],
			envs:      ['e <- new.env()', 'assign("w", 1, envir = e)', 'get("w", envir = e)', 'local({ w <- 2 })', 'eval(quote(w <- 3))', 'w'],
			lazy:      ['delayedAssign("v", x + 1)', 'x <- 2', 'v', 'makeActiveBinding("a", function() x, environment())', 'a'],
			dispatch:  ['print.foo <- function(x, ...) cat("foo")', 'o <- structure(1, class = "foo")', 'print(o)', 'o'],
			files:     ['writeLines("a", "f.txt")', 'readLines("f.txt")', 'sink("out.txt")', 'cat("x")', 'sink()']
		};
		for(const [name, statements] of Object.entries(programs)) {
			assertIncrementalSequence(name, typingSequence(statements));
		}
		for(const file of ['example.R', 'example-cfg.R', 'linter.R', 'taint.R', 'df-shape.R']) {
			const statements = fs.readFileSync(path.join(__dirname, '../../../testfiles', file), 'utf8').split('\n');
			assertIncrementalSequence(`lines of ${file}`, typingSequence(statements));
		}
	});

	describe('each incrementality on its own', () => {
		assertIncrementalSequence('reuse an unchanged analysis', singleFileSteps(base, { code: base, type: IncrementalUpdateType.Nothing, applied: true }, { code: `${base} # c`, applied: true }), { mode: 'reuse' });
		assertIncrementalSequence('reuse does not resume', singleFileSteps(base, { code: `${base}\nz <- x`, type: IncrementalUpdateType.AddedAtEnd, applied: false }), { mode: 'reuse' });
		assertIncrementalSequence('resume an unchanged analysis from its last checkpoint', singleFileSteps(base, { code: base, type: IncrementalUpdateType.Nothing, applied: true }), { mode: 'resume' });
		assertIncrementalSequence('resume after an append', singleFileSteps(base, { code: `${base}\nz <- x`, applied: true }, { code: `${base}\nz <- x # c`, applied: true }), { mode: 'resume' });
		const seeds = Number(process.env.FLOWR_INCREMENTAL_FUZZ_SEEDS ?? 40);
		for(const mode of ['reuse', 'resume'] as const) {
			for(let seed = 0; seed < Math.ceil(seeds / 4); seed++) {
				assertIncrementalSequence(`${mode}: seed ${seed}`, fuzzedSequence(`incremental-${mode}-${seed}`, 6, 14), { mode, checkpoints: 1 + seed % 3 });
			}
		}
	});

	describe('fuzzed edits', () => {
		const seeds = Number(process.env.FLOWR_INCREMENTAL_FUZZ_SEEDS ?? 40);
		const length = Number(process.env.FLOWR_INCREMENTAL_FUZZ_LENGTH ?? 14);
		for(let seed = 0; seed < seeds; seed++) {
			assertIncrementalSequence(`seed ${seed}`, fuzzedSequence(`incremental-${seed}`, 6, length), { checkpoints: 1 + seed % 4 });
		}
		for(let seed = 0; seed < 5; seed++) {
			assertIncrementalSequence(`seed ${seed} with queries`, fuzzedSequence(`incremental-query-${seed}`, 8, 6), { oracles: [':dataflow', 'query:dependencies', 'query:linter'] });
		}
		assertIncrementalSequence('every statement appended', [
			{ files: { 'script.R': '' } },
			...StatementPool.map((_, i) => ({ files: { 'script.R': StatementPool.slice(0, i + 1).join('\n'), 'helper.R': 'helper_value <- 1' } }))
		]);
	});
});
