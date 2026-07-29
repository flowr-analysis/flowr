import { guard } from '../../../../src/util/assert';
import { asFunction, defaultEnv, variable } from '../../_helper/dataflow/environment-builder';
import { decorateLabelContext, label } from '../../_helper/label';
import { resolveByName, resolvesToBuiltInConstant } from '../../../../src/dataflow/environments/resolve-by-name';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { Ternary } from '../../../../src/util/logic';
import { assert, describe, expect, test } from 'vitest';
import { valueFromTsValue } from '../../../../src/dataflow/eval/values/general';
import { setFrom } from '../../../../src/dataflow/eval/values/sets/set-constants';
import { Bottom, isBottom, isTop, type Lift, Top, type Value } from '../../../../src/dataflow/eval/values/r-value';
import { withShell } from '../../_helper/shell';
import { PipelineExecutor } from '../../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { intervalFromValues } from '../../../../src/dataflow/eval/values/intervals/interval-constants';
import { getScalarFromInteger } from '../../../../src/dataflow/eval/values/scalar/scalar-constants';
import { vectorFrom } from '../../../../src/dataflow/eval/values/vectors/vector-constants';
import { resolveIdToValue, resolveToConstants } from '../../../../src/dataflow/eval/resolve/alias-tracking';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../../src/config';

/** Controls which extra results are accepted in addition to an exact match */
enum Allow {
	/** Only the exact expected value is accepted */
	ExactOnly = 0,
	/** Also accept top (unknown); use when the analysis may give up */
	Top       = 1,
	/** Also accept bottom (unreachable); use when the result may be unreachable */
	Bottom    = 2
}

/** Controls how {@link resolveIdToValue} is invoked during tests */
enum With {
	/** Pass only the dataflow graph, no environment is given to the resolver */
	GraphOnly,
	/** Pass the full program environment, the normal fully-informed path */
	Environment
}

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

	function vector(values: unknown[]) {
		return setFrom(vectorFrom(values.map(v => valueFromTsValue(v))));
	}

	function testWithGraphAndEnvironment(name: string, tests: (withWhat: With) => void) {
		describe(`${name} (Graph only)`, () => {
			tests(With.GraphOnly);
		});

		describe(`${name} (Environment)`, () => {
			tests(With.Environment);
		});
	}

	function testResolve(
		name: string,
		identifier: SlicingCriterion,
		code: string,
		expectedValues: Value,
		allow: Allow = Allow.ExactOnly,
		withEnv: With = With.Environment
	): void {
		const effectiveName = decorateLabelContext(label(name), ['resolve']);

		test(effectiveName, async() => {
			const context = contextFromInput(code.trim());
			const dataflow = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				parser: shell,
				context
			}).allRemainingSteps();

			const resolved = resolveIdToValue(SlicingCriterion.parse(identifier, dataflow.normalize.idMap), {
				environment: withEnv === With.GraphOnly ? undefined : dataflow.dataflow.environment,
				graph:       dataflow.dataflow.graph,
				idMap:       dataflow.normalize.idMap,
				full:        true,
				resolve:     FlowrConfig.default().solver.variables,
				ctx:         context
			});

			if((allow & Allow.Top) === Allow.Top && isTop(resolved)) {
				return;
			}

			if((allow & Allow.Bottom) === Allow.Bottom && isBottom(resolved)) {
				return;
			}

			assert.deepEqual(resolved, expectedValues, `Resolved Value does not match expected Value. Code was: ${code}`);
		});
	}

	function testMutate(name: string, line: number, identifier: string, code: string, expected: Value, allow: Allow = Allow.ExactOnly) {
		const distractors: string[] = [
			`while(FALSE) { ${identifier} <- 0 }`,
			`if(FALSE) { ${identifier} <- 0 }`,
			'u <- u + 1',
			`if(FALSE) { rm(${identifier})}`
		];

		describe(name, () => {
			for(const distractor of distractors) {
				const mutatedCode = code.split('\n').map(line => `${distractor}\n${line}`).join('\n');
				testResolve(distractor, `${line * 2}@${identifier}`, mutatedCode, expected, allow);
			}
		});
	}

	describe('Negative Tests', () => {
		testResolve('Unknown if',           '2@x', 'if(u) { x <- 2 } else { x <- foo() } \n x', Top);

		testResolve('Unknown Fn',           '2@x', 'x <- foo(1) \n x', Top);
		testResolve('Unknown Fn 2',         '2@f', 'f <- function(x = 3) { foo(x) } \n f()', Top);
		testResolve('Recursion',            '2@f', 'f <- function(x = 3) { f(x) } \n f()', Top);
		testResolve('Get Unknown',          '3@x', 'y <- 5 \n x <- get(u) \n x', Top);

		testResolve('rm()',                 '3@x', 'x <- 1 \n rm(x) \n x', Bottom, Allow.Top);

		testResolve('Eval before Variable', '3@x', 'x <- 1 \n eval(u) \n x', Top);
	});

	describe('Resolve Value', () => {
		testResolve('Constant Value',       '1@x', 'x <- 5', set([5]));
		testResolve('Constant Value Str',   '1@x', 'x <- "foo"', set(['foo']));
		testResolve('Alias Constant Value', '3@x', 'y <- 5 \n x <- y \n x', set([5]));

		testResolve('rm() with alias',      '4@x', 'y <- 2 \n x <- y \n rm(y) \n x', set([2]));
	});

	describe('Graph vs. Environment', () => {
		testWithGraphAndEnvironment('Not yet supported', (resolveWith) => {
			// Not yet Supported
			testResolve('Loop plus x',          '5@x', 'x <- 2 \n for(i in 1:10) { x \n x <- i + x \n i} \n x', interval(2, 57), Allow.Top, resolveWith);
			testResolve('Get',                  '3@x', 'y <- 5 \n x <- get("y") \n x', set([5]), Allow.Top, resolveWith);
			testResolve('Super Assign',         '4@x', 'x <- 1 \n f <- function() { x <<- 2} \n f() \n x', set([2]), Allow.Top, resolveWith);
			testResolve('Plus One',             '3@x', 'x <- 1 \n x <- x+1 \n x', interval(1, Top), Allow.Top, resolveWith);

			testResolve('Random Loop',          '4@x', 'x <- 1 \n while(TRUE) { x <- x + 1 \n if(runif(1) > 0.5) { break } } \n x', Top, Allow.Top, resolveWith);
			testResolve('Loop plus one',        '4@i', 'for(i in 1:10) { i \n i <- i + 1 \n i} \n i', interval(2, 11), Allow.Top, resolveWith);
			testResolve('Loop plus x',          '5@x', 'x <- 2 \n for(i in 1:10) { x \n x <- i + x \n i} \n x', interval(2, 57), Allow.Top, resolveWith);

			testResolve('Superassign Arith',    '5@x', 'y <- 4 \n x <- 1 \n f <- function() { x <<- 2 * y } \n f() \n x', set([8]), Allow.Top, resolveWith);
		});
	});

	describe('Resolve Value (distractors)', () => {
		testMutate('Constant Value',        1, 'x', 'x <- 5',                                     set([5]));
		testMutate('Constant Value branch', 4, 'x', 'if(u) { \n x <- 5} else { \n x <- 6 } \n x', set([5, 6]));
		testMutate('Alias Constant Value',  3, 'x', 'y <- 5 \n x <- y \n x',                      set([5]));
		testMutate('Vector',                2, 'x', 'x <- 1 \n x <- c(1,2,3)',                    vector([1, 2, 3]));
	});

	describe('Resolve (vectors)', () => {
		// Do not resolve vector, if c is redefined
		testResolve('c redefined',            '2@x', 'c <- function() {} \n x <- c(1,2,3)', Top);

		testResolve('Simple Vector (int)',    '2@x', 'x <- c(1, 2, 3, 4) \n x',                      vector([1, 2, 3, 4]));
		testResolve('Simple Vector (string)', '2@x', 'x <- c("a", "b", "c", "d") \n x',              vector(['a', 'b', 'c', 'd']));
		testResolve('Vector with alias',      '2@x', 'y <- 1 \n x <- c(y,2)',                        vector([1, 2]));
		testResolve('Vector in vector',       '1@x', 'x <- c(1, 2, c(3, 4, 5))',                     vector([1, 2, 3, 4, 5]));
		testResolve('Vector in vector alias', '2@x', 'y <- c(1, 2, c(3,4)) \n x <- c(y, 5, c(6,7))', vector([1, 2, 3, 4, 5, 6, 7]));

		testResolve('c aliased',              '2@x', 'f <- c \n x <- f(1,2,3)',                      vector([1, 2, 3]));
		testResolve('c aliased deeply',       '3@x', 'f <- c \n g <- f \n x <- g(1,2,3)',            vector([1, 2, 3]));
	});

	describe('Resolve (vectors replacement operators)', () => {
		testResolve('simple', '2@x', 'x <- c(1,2,3) \n x$b <- 1', Top);
	});

	describe('Resolve (arithmetic)', () => {
		testResolve('times',              '2@x', 'x <- 2 * 3 \n x',        set([6]));
		testResolve('divide',             '2@x', 'x <- 9 / 2 \n x',        set([4.5]));
		testResolve('power',              '2@x', 'x <- 2^10 \n x',         set([1024]));
		testResolve('modulo',             '2@x', 'x <- 7 %% 3 \n x',       set([1]));
		// R rounds towards -Inf, so this is 1 and not the -2 of a JS remainder
		testResolve('modulo negative',    '3@x', 'y <- -5 \n x <- y %% 3 \n x',   set([1]));
		testResolve('integer divide',     '3@x', 'y <- -5 \n x <- y %/% 2 \n x',  set([-3]));
		testResolve('with alias',         '3@x', 'a <- 4 \n x <- a * 2 \n x',     set([8]));
		testResolve('nested',             '2@x', 'x <- (1 + 2) * (10 - 4) \n x',  set([18]));
		testResolve('unary minus',        '2@x', 'x <- -3 \n x',           set([-3]));
		/* an operator is a call like any other, so R matches its `e1`/`e2` by name just as well */
		testResolve('infix named args',   '2@x', 'x <- `%%`(e2 = 3, e1 = 5) \n x', set([2]));
		testResolve('minus named args',   '2@x', 'x <- `-`(e2 = 1, e1 = 5) \n x',  set([4]));
		/* one vector operand folds elementwise */
		testResolve('vector and scalar',  '2@x', 'x <- c(1, 2) + 1 \n x',  vector([2, 3]));
		testResolve('two vectors',        '2@x', 'x <- c(1, 2) * c(3, 4) \n x', vector([3, 8]));
		testResolve('division by zero',   '2@x', 'x <- 1 / 0 \n x',        Top);
		testResolve('unknown operand',    '2@x', 'x <- 2 * u \n x',        Top);
		testResolve('* redefined',        '2@x', '`*` <- function(a, b) 0 \n x <- 2 * 3 \n x', Top);
	});

	describe('Resolve (comparison)', () => {
		testResolve('less than',          '2@x', 'x <- 1 < 2 \n x',        set([true]));
		testResolve('greater equal',      '2@x', 'x <- 2 >= 3 \n x',       set([false]));
		testResolve('equal strings',      '2@x', 'x <- "a" == "a" \n x',   set([true]));
		testResolve('unequal strings',    '2@x', 'x <- "a" != "b" \n x',   set([true]));
		testResolve('with alias',         '3@x', 'n <- 5 \n x <- n > 3 \n x', set([true]));
		// R compares strings by locale collation, so their order does not fold
		testResolve('ordered strings',    '2@x', 'x <- "a" < "b" \n x',    Top);
		// R would coerce the number to a string first, we stay conservative
		testResolve('mixed kinds',        '2@x', 'x <- 1 == "1" \n x',     Top);
		testResolve('unknown operand',    '2@x', 'x <- 1 < u \n x',        Top);
	});

	describe('Resolve (logical)', () => {
		testResolve('and',                '2@x', 'x <- TRUE && FALSE \n x', set([false]));
		testResolve('or',                 '2@x', 'x <- TRUE || FALSE \n x', set([true]));
		testResolve('not',                '2@x', 'x <- !TRUE \n x',         set([false]));
		testResolve('vectorized and',     '2@x', 'x <- TRUE & TRUE \n x',   set([true]));
		testResolve('number as logical',  '2@x', 'x <- !0 \n x',            set([true]));
		testResolve('with alias',         '3@x', 'b <- FALSE \n x <- !b \n x', set([true]));
		// && and || short-circuit, so the lhs alone decides
		testResolve('short-circuit and',  '2@x', 'x <- FALSE && u \n x',    set([false]));
		testResolve('short-circuit or',   '2@x', 'x <- TRUE || u \n x',     set([true]));
		// & and | vectorize, so an unknown rhs may still widen the result
		testResolve('no short-circuit',   '2@x', 'x <- FALSE & u \n x',     Top);
		testResolve('unknown operand',    '2@x', 'x <- TRUE && u \n x',     Top);
	});

	describe('Resolve (paste)', () => {
		testResolve('paste0 constants',      '2@x', 'x <- paste0("handler_", "foo") \n x', set(['handler_foo']));
		testResolve('paste default sep',     '2@x', 'x <- paste("a", "b") \n x',           set(['a b']));
		testResolve('paste explicit sep',    '2@x', 'x <- paste("a", "b", sep="-") \n x',  set(['a-b']));
		testResolve('paste0 with alias',     '3@x', 'k <- "b" \n x <- paste0("cfg_", k) \n x', set(['cfg_b']));
		// a non-constant part keeps the result unknown
		testResolve('paste0 unresolved part', '2@x', 'x <- paste0("cfg_", Sys.getenv("K")) \n x', Top);
		testResolve('file.path constants',   '2@x', 'x <- file.path("data", "in.csv") \n x', set(['data/in.csv']));
		testResolve('file.path with alias',  '3@x', 'd <- "data" \n x <- file.path(d, "in.csv") \n x', set(['data/in.csv']));
		testResolve('file.path explicit fsep', '2@x', 'x <- file.path("a", "b", fsep="|") \n x', set(['a|b']));
		/* the separator sits behind the `...`, so its position among the arguments does not matter */
		testResolve('paste sep first',       '2@x', 'x <- paste(sep="-", "a", "b") \n x',   set(['a-b']));
		testResolve('paste collapse ignored', '2@x', 'x <- paste("a", "b", collapse="") \n x', set(['a b']));
		/* a name no parameter carries is a part of the join, just as R treats it */
		testResolve('paste unknown name',    '2@x', 'x <- paste0("a", nope="b") \n x',      set(['ab']));
		testResolve('unresolved separator',  '2@x', 'x <- paste("a", "b", sep=Sys.getenv("S")) \n x', Top);
		/* the fixed-arity folds take their argument by name as well, and refuse an argument they do not model */
		testResolve('dirname named arg',     '2@x', 'x <- dirname(path="a/b/c") \n x',      set(['a/b']));
		testResolve('nchar extra argument',  '2@x', 'x <- nchar("abc", "bytes") \n x',      Top);
	});

	describe('Resolve (math)', () => {
		testResolve('abs',                '2@x', 'x <- abs(-3.5) \n x',            set([3.5]));
		testResolve('sqrt',               '2@x', 'x <- sqrt(16) \n x',             set([4]));
		testResolve('floor negative',     '2@x', 'x <- floor(-1.2) \n x',          set([-2]));
		testResolve('ceiling negative',   '2@x', 'x <- ceiling(-1.2) \n x',        set([-1]));
		testResolve('round ties to even', '2@x', 'x <- round(2.5) \n x',           set([2]));
		testResolve('round ties down',    '2@x', 'x <- round(-1.5) \n x',          set([-2]));
		testResolve('round named arg',    '2@x', 'x <- round(x = 1.5) \n x',       set([2]));
		testResolve('on a variable',      '3@x', 'y <- 9 \n x <- sqrt(y) \n x',    set([3]));
		testResolve('nested in arith',    '2@x', 'x <- abs(-2) * floor(3.7) \n x', set([6]));
		testResolve('digits',             '2@x', 'x <- round(1.234, 2) \n x',      set([1.23]));
		testResolve('digits named',       '2@x', 'x <- round(1.234, digits = 2) \n x', set([1.23]));
		testResolve('log with base',      '2@x', 'x <- log(8, 2) \n x',            set([3]));
		testResolve('log base named',     '2@x', 'x <- log(8, base = 2) \n x',     set([3]));
		testResolve('signif',             '2@x', 'x <- signif(123.456, 4) \n x',   set([123.5]));
		testResolve('over a vector',      '2@x', 'x <- abs(c(-1, -2)) \n x',       vector([1, 2]));
		testResolve('not a number',       '2@x', 'x <- sqrt(-1) \n x',             Top);
		testResolve('too many arguments', '2@x', 'x <- round(1.234, 2, 3) \n x',   Top);
		testResolve('unknown argument',   '2@x', 'x <- round(1.5, nope = 2) \n x', Top);
		testResolve('sqrt redefined',     '2@x', 'sqrt <- function(a) 0 \n x <- sqrt(16) \n x', Top);
	});

	describe('Resolve (string functions)', () => {
		testResolve('toupper',            '2@x', 'x <- toupper("aBc") \n x',       set(['ABC']));
		testResolve('tolower',            '2@x', 'x <- tolower("AbC") \n x',       set(['abc']));
		testResolve('trimws',             '2@x', 'x <- trimws("  a b\t") \n x',    set(['a b']));
		testResolve('nchar',              '2@x', 'x <- nchar("abcd") \n x',        set([4]));
		testResolve('nchar named arg',    '2@x', 'x <- nchar(x = "") \n x',        set([0]));
		testResolve('on a variable',      '3@x', 'y <- "Data" \n x <- tolower(y) \n x', set(['data']));
		testResolve('nested with paste',  '2@x', 'x <- toupper(paste0("a", "b")) \n x', set(['AB']));
		testResolve('unicode',            '2@x', 'x <- toupper("héllo") \n x',      set(['HÉLLO']));
		testResolve('unicode nchar',      '2@x', 'x <- nchar("héllo") \n x',        set([5]));
		testResolve('unresolved',         '2@x', 'x <- toupper(Sys.getenv("P")) \n x',  Top);
		/* we see the source text, in which an escape is still a backslash and a letter */
		testResolve('escape untouched',   '2@x', 'x <- toupper("a\\tb") \n x',      Top);
		testResolve('escape not counted', '2@x', 'x <- nchar("a\\tb") \n x',        Top);
		/* a second argument changes what these do, so the plain fold would be wrong */
		testResolve('nchar in bytes',     '2@x', 'x <- nchar("ab", type = "bytes") \n x', Top);
		testResolve('trimws one side',    '2@x', 'x <- trimws("  a  ", which = "left") \n x', Top);
		testResolve('basename two args',  '2@x', 'x <- basename("a/b", "c") \n x',  Top);
	});

	describe('Resolve (basename/dirname)', () => {
		testResolve('basename constant',      '2@x', 'x <- basename("a/b/c.csv") \n x',   set(['c.csv']));
		testResolve('basename trailing sep',  '2@x', 'x <- basename("a/b/") \n x',        set(['b']));
		testResolve('basename no sep',        '2@x', 'x <- basename("a") \n x',           set(['a']));
		testResolve('dirname constant',       '2@x', 'x <- dirname("a/b/c.csv") \n x',    set(['a/b']));
		testResolve('dirname no sep',         '2@x', 'x <- dirname("a") \n x',            set(['.']));
		testResolve('dirname root',           '2@x', 'x <- dirname("/a") \n x',           set(['/']));
		testResolve('dirname named arg',      '2@x', 'x <- dirname(path = "a/b/c") \n x', set(['a/b']));
		testResolve('nested with file.path',  '3@x', 'd <- file.path("data", "raw") \n x <- basename(d) \n x', set(['raw']));
		testResolve('basename unresolved',    '2@x', 'x <- basename(Sys.getenv("P")) \n x', Top);
	});

	/** everything the solver may not fold, as the value is not known statically or the built-in may not be the one called */
	describe('Resolve (no folding)', () => {
		testResolve('for loop',            '3@x', 'x <- 0 \n for(i in 1:3) x <- x + 1 \n x',     Top);
		testResolve('while loop',          '3@x', 'x <- 1 \n while(u) x <- x * 2 \n x',          Top);
		testResolve('repeat loop',         '3@x', 'x <- 1 \n repeat { x <- x + 1 } \n x',        Top);
		testResolve('loop with paste',     '4@x', 'p <- "a" \n for(i in 1:2) p <- paste0(p, "b") \n x <- p \n x', Top);
		testResolve('unknown function',    '2@x', 'x <- foo(1) + 1 \n x',                        Top);
		testResolve('unknown namespace',   '2@x', 'x <- pkg::f(1) + 1 \n x',                     Top);
		testResolve('user function',       '3@x', 'f <- function() 1 + 1 \n x <- f() \n x',      Top);
		testResolve('undefined variable',  '2@x', 'x <- y + 1 \n x',                             Top);
		testResolve('self reference',      '2@x', 'x <- x + 1 \n x',                             Top);
		testResolve('mutual alias',        '3@x', 'x <- y \n y <- x \n x',                       Top);
		testResolve('NA operand',          '2@x', 'x <- 1 + NA \n x',                            Top);
		testResolve('NULL operand',        '2@x', 'x <- 1 + NULL \n x',                          Top);
		testResolve('string in arithmetic', '2@x', 'x <- "a" + 1 \n x',                          Top);
		/* R would recycle the shorter side, which is too easy to get wrong to guess at */
		testResolve('vectors of unequal length', '2@x', 'x <- c(1, 2) + c(1, 2, 3) \n x',        Top);
		testResolve('missing argument',    '2@x', 'x <- toupper() \n x',                         Top);
		testResolve('empty argument',      '2@x', 'x <- abs(,) \n x',                            Top);
		testResolve('function argument',   '2@x', 'x <- toupper(function() 1) \n x',             Top);
		testResolve('quoted argument',     '2@x', 'x <- abs(quote(a)) \n x',                     Top);
		testResolve('grouping redefined',  '3@x', '`(` <- function(a) 0 \n x <- (1 + 2) \n x',   Top);
		testResolve('conditionally redefined', '3@x', 'if(u) abs <- function(a) 0 \n x <- abs(-1) \n x', Top);
		testResolve('brace block',         '2@x', 'x <- { 1 + 2 } \n x',                         Top);
		testResolve('removed again',       '3@x', 'x <- 1 + 1 \n rm(x) \n x',                    Top);
		/* `NA` and `NaN` make R answer `NA`, never a logical */
		testResolve('NaN compared',        '2@x', 'x <- NaN > 1 \n x',                           Top);
		testResolve('NaN equal to itself', '2@x', 'x <- NaN == NaN \n x',                        Top);
		testResolve('NA compared',         '2@x', 'x <- NA > 1 \n x',                            Top);
		testResolve('operand of another kind', '2@x', 'x <- 1 > "a" \n x',                       Top);
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
	describe.each<[string, With]>([
		['Graph only',  With.GraphOnly  ],
		['Environment', With.Environment],
	])('Resolve built-in constants (%s)', (_name, resolveWith) => {
		testResolve('T resolves to true',         '1@T',    'T',             set([true]),  Allow.ExactOnly, resolveWith);
		testResolve('F resolves to false',        '1@F',    'F',             set([false]), Allow.ExactOnly, resolveWith);
		testResolve('TRUE resolves to true',      '1@TRUE', 'TRUE',          set([true]),  Allow.ExactOnly, resolveWith);
		testResolve('T multiple, resolve second', '2@T',    'T\nT\nT',       set([true]),  Allow.ExactOnly, resolveWith);
		testResolve('T shadow with logical',      '2@T',    'T <- FALSE\nT', set([false]), Allow.ExactOnly, resolveWith);
		testResolve('T shadow with number',       '2@T',    'T <- 42\nT',    set([42]),    Allow.ExactOnly, resolveWith);
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
			['TRUE',  true,  defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, cds: [{ id: 42, when: true }] })],
			['FALSE', false, defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, cds: [{ id: 42, when: true }] })]
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
			['FALSE',   false,     defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, cds: [{ id: 42, when: true }, { id: 42, when: false }] })]
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
				['TRUE',  setFrom(Top, valueFromTsValue(true)),  defaultEnv().defineInEnv({ name: 'TRUE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, cds: [{ id: 42, when: true }] })],
				['FALSE', setFrom(Top, valueFromTsValue(false)), defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, cds: [{ id: 42, when: true }] })]
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
				['FALSE',     setFrom(Top),     defaultEnv().defineInEnv({ name: 'FALSE', nodeId: 0, definedAt: 1, type: ReferenceType.Constant, cds: [{ id: 42, when: true }, { id: 42, when: false }] })]
			])("Identifier '%s' should never resolve to %s", (identifier, wantedValue, environment) => {
				const defs = resolveToConstants(identifier, environment);
				assert.deepEqual(defs, wantedValue);
			});
		});
	});
}));
