import { describe, test, assert } from 'vitest';
import { withShell } from '../functionality/_helper/shell';
import type { RShell } from '../../src/r-bridge/shell';
import type { MutationPass, MutationTarget } from '../functionality/_helper/r-mutations';
import { MutationPasses, mutate, passIsAvailable, slice } from '../functionality/_helper/r-mutations';

function passOf(name: string): MutationPass {
	const pass = MutationPasses.find(p => p.name === name);
	assert.isDefined(pass, `there is no pass named ${name}`);
	return pass;
}

async function parses(shell: RShell, code: string): Promise<boolean> {
	return await evaluate(shell, `tryCatch({ parse(text = ${JSON.stringify(code)}); "yes" }, error = function(e) "no")`) === 'yes';
}

async function evaluate(shell: RShell, expression: string): Promise<string> {
	const out = await shell.sendCommandWithOutput(`cat(${expression}, "\\n")`);
	return out.join('').trim();
}

describe('R mutations', { concurrent: false }, withShell(shell => {
	const programs: readonly MutationTarget[] = [
		{ code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5' },
		{ code: 'f <- function()\n5\nr <- f()\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		{ code: 'x <- 1:\n3\nr <- sum(x)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ code: 'if(TRUE)\nx <- 2\nprint(x)', criterion: '3@x', expected: '[1] 2' },
		{ code: '\nx <- 1\ny <- x\nprint(y)', criterion: '4@y', expected: '[1] 1' },
		{ code: 'nm <- "vvv"\nvvv <- 8\nr <- get(nm)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ code: 'if(TRUE) x <- 2\nprint(x)', criterion: '2@x', expected: '[1] 2' },
		{ code: 'r <- sum(rev(1:3))\nprint(r)', criterion: '2@r', expected: '[1] 6' },
		{ code: 'p <- "a/b.txt"\nr <- basename(p)\nprint(r)', criterion: '3@r', expected: '[1] "b.txt"' }
	];
	describe('every mutant is a program R reads', () => {
		for(const pass of MutationPasses) {
			test.skipIf(!passIsAvailable(pass))(pass.name, async() => {
				let applied = 0;
				for(const program of programs) {
					const mutant = await mutate(shell, program, pass);
					if(mutant !== undefined) {
						applied++;
						assert.isTrue(await parses(shell, mutant.code), `${pass.name} produced:\n${mutant.code}`);
					}
				}
				assert.isAbove(applied, 0, `${pass.name} rewrote none of the sample programs, so this test checks nothing`);
			});
		}
	});

	describe('a statement continued on the next line is left alone', () => {
		const continued: MutationTarget = { code: 'f <- function()\n5\nr <- f()\nprint(r)', criterion: '4@r', expected: '[1] 5' };
		const colon: MutationTarget = { code: 'x <- 1:\n3\nr <- sum(x)\nprint(r)', criterion: '4@r', expected: '[1] 6' };
		for(const name of ['grouped right hand side', 'braced right hand side', 'assign call', 'equals assignment']) {
			test(name, async() => {
				assert.isUndefined(await mutate(shell, continued, passOf(name)));
				assert.isUndefined(await mutate(shell, colon, passOf(name)));
			});
		}
	});

	describe('first two statements joined', () => {
		test('an empty first line is no statement to join', async() => {
			assert.isUndefined(await mutate(shell, { code: '\nx <- 1\ny <- x\nprint(y)', criterion: '4@y', expected: '[1] 1' }, passOf('first two statements joined')));
		});
		test('two statements are joined and the criterion moves up', async() => {
			const mutant = await mutate(shell, { code: 'x <- 1\ny <- 2\nr <- x + y\nprint(r)', criterion: '4@r', expected: '[1] 3' }, passOf('first two statements joined'));
			assert.strictEqual(mutant?.code, 'x <- 1; y <- 2\nr <- x + y\nprint(r)');
			assert.strictEqual(mutant?.criterion, '3@r');
		});
	});

	describe('assign call', () => {
		test('the line the criterion points at keeps its name', async() => {
			const mutant = await mutate(shell, { code: 'x <- 5\ny <- 2\nprint(x + y)', criterion: '1@x', expected: '[1] 7' }, passOf('assign call'));
			assert.strictEqual(mutant?.code, 'x <- 5\nassign("y", 2)\nprint(x + y)');
		});
		test('nothing is left to rewrite where the criterion is the only assignment', async() => {
			assert.isUndefined(await mutate(shell, { code: 'x <- 5\nprint(x)', criterion: '1@x', expected: '[1] 5' }, passOf('assign call')));
		});
		test('every other assignment is rewritten', async() => {
			const mutant = await mutate(shell, { code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5' }, passOf('assign call'));
			assert.strictEqual(mutant?.code, 'assign("x", 5)\nprint(x)');
		});
	});

	describe('renamed criterion variable', () => {
		test('a dotted name is not read as a pattern', async() => {
			const mutant = await mutate(shell, { code: 'a.b <- 1\nq <- "axb"\nprint(a.b)', criterion: '3@a.b', expected: '[1] 1' }, passOf('renamed criterion variable'));
			assert.strictEqual(mutant?.code, 'mut_v <- 1\nq <- "axb"\nprint(mut_v)');
			assert.strictEqual(mutant?.criterion, '3@mut_v');
		});
		test('a name a string spells out is still left alone', async() => {
			assert.isUndefined(await mutate(shell, { code: 'vv <- 1\nnm <- "vv"\nprint(vv)', criterion: '3@vv', expected: '[1] 1' }, passOf('renamed criterion variable')));
		});
	});

	describe('split string literal', () => {
		test('the package of a library call is taken as written, named or not', async() => {
			assert.isUndefined(await mutate(shell, { code: 'library(package = "stats")\nr <- 1\nprint(r)', criterion: '3@r', expected: '[1] 1' }, passOf('split string literal')));
		});
		test('any other literal is split', async() => {
			const mutant = await mutate(shell, { code: 'nm <- "vvv"\nprint(nm)', criterion: '2@nm', expected: '[1] "vvv"' }, passOf('split string literal'));
			assert.strictEqual(mutant?.code, 'nm <- paste0("v", "vv")\nprint(nm)');
		});
	});

	test('criterion value shifted by one keeps what else the target says', async() => {
		const target: MutationTarget & { readonly name: string } = { code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5', name: 'kept' };
		const mutant = await mutate(shell, target, passOf('criterion value shifted by one'));
		assert.strictEqual(mutant?.code, 'x <- (5) + 1\nprint(x)');
		assert.strictEqual(mutant?.expected, '[1] 6');
		assert.strictEqual((mutant as typeof target | undefined)?.name, 'kept');
	});

	test('equals assignment', async() => {
		const mutant = await mutate(shell, { code: 'x <- 5\nr <- x + 1\nprint(r)', criterion: '3@r', expected: '[1] 6' }, passOf('equals assignment'));
		assert.strictEqual(mutant?.code, 'x = 5\nr = x + 1\nprint(r)');
		assert.strictEqual(mutant?.criterion, '3@r');
	});

	test('trailing comments', async() => {
		const mutant = await mutate(shell, { code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5' }, passOf('trailing comments'));
		assert.strictEqual(mutant?.code, 'x <- 5 # mut_note\nprint(x) # mut_note');
		assert.strictEqual(mutant?.criterion, '2@x');
	});

	describe('every statement in a block', () => {
		test('a block hands on the visibility of what it wraps', async() => {
			assert.strictEqual(await evaluate(shell, 'withVisible({ mut_x <- 1 })$visible'), 'FALSE');
			assert.strictEqual(await evaluate(shell, 'withVisible({ 41 + 1 })$visible'), 'TRUE');
			assert.strictEqual(await evaluate(shell, 'withVisible({ (function() invisible(7))() })$visible'), 'FALSE');
			assert.strictEqual(await evaluate(shell, 'withVisible({ (function() 9)() })$visible'), 'TRUE');
		});
		test('every statement is wrapped and the criterion stays put', async() => {
			const mutant = await mutate(shell, { code: 'x <- 5\nf <- function() x\nprint(f())', criterion: '3@print', expected: '[1] 5' }, passOf('every statement in a block'));
			assert.strictEqual(mutant?.code, '{ x <- 5 }\n{ f <- function() x }\n{ print(f()) }');
			assert.strictEqual(mutant?.criterion, '3@print');
		});
		test('a line holding more than one statement is left alone', async() => {
			const mutant = await mutate(shell, { code: 'x <- 1; y <- 2\nprint(x + y)', criterion: '2@print', expected: '[1] 3' }, passOf('every statement in a block'));
			assert.strictEqual(mutant?.code, 'x <- 1; y <- 2\n{ print(x + y) }');
		});
	});

	describe('top level super assignment', () => {
		test('the search path decides whether a name may be written', async() => {
			assert.strictEqual(await evaluate(shell, 'tryCatch({ sum <<- 1; "ok" }, error = function(e) "locked")'), 'locked');
			assert.strictEqual(await evaluate(shell, 'tryCatch({ mut_free <<- 1; "ok" }, error = function(e) "locked")'), 'ok');
			assert.strictEqual(await evaluate(shell, 'exists("mut_free", envir = globalenv(), inherits = FALSE)'), 'TRUE');
		});
		test('a name no attached base package exports is super-assigned', async() => {
			const mutant = await mutate(shell, { code: 'zz <- 5\nprint(zz)', criterion: '2@zz', expected: '[1] 5' }, passOf('top level super assignment'));
			assert.strictEqual(mutant?.code, 'zz <<- 5\nprint(zz)');
		});
		test('a name an attached base package exports keeps its arrow', async() => {
			const mutant = await mutate(shell, { code: 'sum <- function(x) 1\nzz <- sum(1:3)\nprint(zz)', criterion: '3@zz', expected: '[1] 1' }, passOf('top level super assignment'));
			assert.strictEqual(mutant?.code, 'sum <- function(x) 1\nzz <<- sum(1:3)\nprint(zz)');
		});
		test('nothing is rewritten where every name is exported', async() => {
			assert.isUndefined(await mutate(shell, { code: 'sum <- function(x) 1\nprint(sum(1:3))', criterion: '2@print', expected: '[1] 1' }, passOf('top level super assignment')));
		});
	});

	describe('non-syntactic criterion name', () => {
		const target: MutationTarget = { code: 'zz <- 5\nprint(zz)', criterion: '2@zz', expected: '[1] 5' };
		test('the criterion names the variable in backticks, as the program writes it', async() => {
			const mutant = await mutate(shell, target, passOf('non-syntactic criterion name'));
			assert.isDefined(mutant);
			assert.strictEqual(mutant.code, '`mut_non syntactic` <- 5\nprint(`mut_non syntactic`)');
			assert.strictEqual(mutant.criterion, '2@`mut_non syntactic`');
			assert.isTrue(await parses(shell, mutant.code));
		});
		test('the criterion of the mutant resolves, the same one without backticks does not', async() => {
			const mutant = await mutate(shell, target, passOf('non-syntactic criterion name'));
			assert.isDefined(mutant);
			assert.strictEqual(await slice(shell, mutant), '`mut_non syntactic` <- 5\n`mut_non syntactic`');
			assert.strictEqual(await slice(shell, { ...mutant, criterion: '2@mut_non syntactic' }), '');
		});
	});

	describe('every variable renamed', () => {
		test('every binding and every reference to it gets the same fresh name', async() => {
			const mutant = await mutate(shell, { code: 'k <- 4\nf <- function(a) a * k\nr <- f(2)\nprint(r)', criterion: '4@r', expected: '[1] 8' }, passOf('every variable renamed'));
			assert.strictEqual(mutant?.code, 'mut_r1 <- 4\nmut_r2 <- function(mut_r3) mut_r3 * mut_r1\nmut_r4 <- mut_r2(2)\nprint(mut_r4)');
			assert.strictEqual(mutant?.criterion, '4@mut_r4');
			assert.deepStrictEqual(mutant?.renames, { mut_r1: 'k', mut_r2: 'f', mut_r3: 'a', mut_r4: 'r' });
		});
		test('a name used as an argument name, a field or a string keeps its spelling', async() => {
			const mutant = await mutate(shell, { code: 'a <- 1\nb <- 2\nl <- list(a = 3)\nr <- l$a + b\nq <- "r"\nprint(r)', criterion: '6@r', expected: '[1] 5' }, passOf('every variable renamed'));
			assert.strictEqual(mutant?.code, 'a <- 1\nmut_r1 <- 2\nmut_r2 <- list(a = 3)\nr <- mut_r2$a + mut_r1\nmut_r3 <- "r"\nprint(r)');
		});
		test('a program reading names as data is left alone', async() => {
			assert.isUndefined(await mutate(shell, { code: 'v1 <- 5\nr <- get(paste0("v", 1))\nprint(r)', criterion: '3@r', expected: '[1] 5' }, passOf('every variable renamed')));
		});
		test('a name a base package exports and a dotted name keep their spelling', async() => {
			const mutant = await mutate(shell, { code: 'sum <- function(x) 1\nprint.sq <- function(x) 2\nzz <- sum(1)\nprint(zz)', criterion: '4@zz', expected: '[1] 1' }, passOf('every variable renamed'));
			assert.strictEqual(mutant?.code, 'sum <- function(mut_r1) 1\nprint.sq <- function(mut_r1) 2\nmut_r2 <- sum(1)\nprint(mut_r2)');
		});
		test('the non-syntactic variant writes every name in backticks', async() => {
			const mutant = await mutate(shell, { code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5' }, passOf('every variable renamed to a non-syntactic name'));
			assert.strictEqual(mutant?.code, '`mut_r 1` <- 5\nprint(`mut_r 1`)');
			assert.strictEqual(mutant?.criterion, '2@`mut_r 1`');
		});
	});

	describe('independent statements swapped', () => {
		test('two statements that do not read each other trade places', async() => {
			const mutant = await mutate(shell, { code: 'a <- 1\nb <- 2\nr <- a + b\nprint(r)', criterion: '4@r', expected: '[1] 3' }, passOf('independent statements swapped'));
			assert.strictEqual(mutant?.code, 'b <- 2\na <- 1\nr <- a + b\nprint(r)');
		});
		test('a statement reading the other stays behind it', async() => {
			assert.isUndefined(await mutate(shell, { code: 'a <- 1\nb <- a\nprint(b)', criterion: '3@b', expected: '[1] 1' }, passOf('independent statements swapped')));
		});
		test('a call that may have an effect stays where it is', async() => {
			assert.isUndefined(await mutate(shell, { code: 'a <- runif(1)\nb <- runif(1)\nprint(b > 0)', criterion: '3@b', expected: '[1] TRUE' }, passOf('independent statements swapped')));
		});
	});

	describe('control flow rewritten', () => {
		test('an if with an else swaps its branches under the negated condition', async() => {
			const mutant = await mutate(shell, { code: 'x <- 3\nif(x > 2) y <- 1 else y <- 2\nprint(y)', criterion: '3@y', expected: '[1] 1' }, passOf('if and else swapped under a negated condition'));
			assert.strictEqual(mutant?.code, 'x <- 3\nif(!(x > 2)) { y <- 2 } else { y <- 1 }\nprint(y)');
		});
		test('a condition that may not be a logical is not negated', async() => {
			assert.isUndefined(await mutate(shell, { code: 'x <- "a"\ny <- if(x) 1 else 2\nprint(y)', criterion: '3@y', expected: '[1] 1' }, passOf('if and else swapped under a negated condition')));
		});
		test('a while loop becomes a repeat loop with the condition as its first break', async() => {
			const mutant = await mutate(shell, { code: 'i <- 0\nwhile(i < 5) i <- i + 2\nprint(i)', criterion: '3@i', expected: '[1] 6' }, passOf('while loop as a repeat loop'));
			assert.strictEqual(mutant?.code, 'i <- 0\nrepeat { if(!(i < 5)) break; i <- i + 2 }\nprint(i)');
		});
		test('a for loop over a range becomes a while loop over its indices', async() => {
			const mutant = await mutate(shell, { code: 's <- 0\nfor(i in 1:4) s <- s + i\nprint(s)', criterion: '3@s', expected: '[1] 10' }, passOf('for loop as a while loop'));
			assert.strictEqual(mutant?.code, 's <- 0\nmut_seq <- 1:4; mut_k <- 0L; while(mut_k < length(mut_seq)) { mut_k <- mut_k + 1L; i <- mut_seq[[mut_k]]; s <- s + i }\nprint(s)');
		});
		test('a for loop over what may be empty is left alone', async() => {
			assert.isUndefined(await mutate(shell, { code: 's <- 0\nfor(i in seq_len(0)) s <- s + i\nprint(s)', criterion: '3@s', expected: '[1] 0' }, passOf('for loop as a while loop')));
			assert.strictEqual(await evaluate(shell, 'local({ i <- 5; for(i in integer(0)) NULL; is.null(i) })'), 'TRUE');
		});
	});

	describe('function forms', () => {
		test('a body without braces is returned explicitly', async() => {
			const mutant = await mutate(shell, { code: 'fs <- list(f = function(x) x * 3)\nr <- fs$f(2)\nprint(r)', criterion: '3@r', expected: '[1] 6' }, passOf('function result made an explicit return'));
			assert.strictEqual(mutant?.code, 'fs <- list(f = function(x) return(x * 3))\nr <- fs$f(2)\nprint(r)');
		});
		test('a returned assignment stays invisible at the top level', async() => {
			const out = await shell.sendCommandWithOutput('mut_s <- 0; mut_k <- function(i) return(mut_s <<- mut_s + i); mut_k(1); rm(mut_s, mut_k)');
			assert.deepStrictEqual(out.filter(l => l.trim() !== ''), []);
		});
		test('a pipe becomes the nested call it stands for', async() => {
			const mutant = await mutate(shell, { code: 'f <- function(p) p\n"a" |> f()\nr <- 1 |> f()\nprint(r)', criterion: '4@r', expected: '[1] 1' }, passOf('pipe rewritten as a nested call'));
			assert.strictEqual(mutant?.code, 'f <- function(p) p\nf("a")\nr <- f(1)\nprint(r)');
		});
		test('a pipe whose left side is no primary is left alone', async() => {
			assert.isUndefined(await mutate(shell, { code: 'f <- function(p) p\nr <- 1 + 2 |> f()\nprint(r)', criterion: '3@r', expected: '[1] 3' }, passOf('pipe rewritten as a nested call')));
		});
		test('the first plain argument is passed through identity', async() => {
			const mutant = await mutate(shell, { code: 'v <- 1:3\nr <- sum(v, 1)\nprint(r)', criterion: '3@r', expected: '[1] 7' }, passOf('argument passed through identity'));
			assert.strictEqual(mutant?.code, 'v <- 1:3\nr <- sum(identity(v), 1)\nprint(r)');
		});
		test('a call naming its result after an argument is left alone', async() => {
			assert.isUndefined(await mutate(shell, { code: 'a <- 1\nd <- data.frame(a)\nprint(names(d))', criterion: '3@print', expected: '[1] "a"' }, passOf('argument passed through identity')));
		});
	});

	describe('literals and layout', () => {
		test('double quotes become single quotes', async() => {
			const mutant = await mutate(shell, { code: 'x <- "a"\ny <- "it\'s"\nprint(x)', criterion: '3@x', expected: '[1] "a"' }, passOf('string literals in single quotes'));
			assert.strictEqual(mutant?.code, 'x <- \'a\'\ny <- "it\'s"\nprint(x)');
		});
		test('whole numbers are written with an exponent and ranges stay integer', async() => {
			const mutant = await mutate(shell, { code: 'x <- 1:3\ny <- x[2] + 10L\nprint(y)', criterion: '3@y', expected: '[1] 12' }, passOf('numbers in scientific notation'));
			assert.strictEqual(mutant?.code, 'x <- 1e0:3e0\ny <- x[2e0] + 10L\nprint(y)');
			assert.strictEqual(await evaluate(shell, 'is.integer(1e0:3e0)'), 'TRUE');
		});
		test('an assignment continues on the next line and the criterion moves down', async() => {
			const mutant = await mutate(shell, { code: 'x <- 1\ny <- x\nprint(y)', criterion: '3@y', expected: '[1] 1' }, passOf('assignment continued on the next line'));
			assert.strictEqual(mutant?.code, 'x <-\n  1\ny <-\n  x\nprint(y)');
			assert.strictEqual(mutant?.criterion, '5@y');
		});
		test('a dead assignment to the criterion is put right before it', async() => {
			const mutant = await mutate(shell, { code: 'x <- 1\nprint(x)', criterion: '2@x', expected: '[1] 1' }, passOf('dead assignment to the criterion variable'));
			assert.strictEqual(mutant?.code, 'x <- 1\nif(FALSE) x <- NULL\nprint(x)');
			assert.strictEqual(mutant?.criterion, '3@x');
		});
	});

	describe('whole program in a block', () => {
		test('the program is wrapped and the criterion moves down', async() => {
			const mutant = await mutate(shell, { code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5' }, passOf('whole program in a block'));
			assert.strictEqual(mutant?.code, '{\nx <- 5\nprint(x)\n}');
			assert.strictEqual(mutant?.criterion, '3@x');
		});
		test('a statement the top level prints is not hidden in a block', async() => {
			assert.isUndefined(await mutate(shell, { code: 'v <- 0\ntryCatch(v <- 1, error = function(e) NULL)\nprint(v)', criterion: '3@v', expected: '[1] 1' }, passOf('whole program in a block')));
		});
	});
}));
