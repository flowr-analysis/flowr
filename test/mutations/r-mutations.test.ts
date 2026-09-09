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

/** whether R reads the code as a program, which every mutant has to remain */
async function parses(shell: RShell, code: string): Promise<boolean> {
	return await evaluate(shell, `tryCatch({ parse(text = ${JSON.stringify(code)}); "yes" }, error = function(e) "no")`) === 'yes';
}

/** what R says about `expression`, so that what a pass rests on is checked against R rather than argued */
async function evaluate(shell: RShell, expression: string): Promise<string> {
	const out = await shell.sendCommandWithOutput(`cat(${expression}, "\\n")`);
	return out.join('').trim();
}

describe('R mutations', { concurrent: false }, withShell(shell => {
	/** programs a pass must either reject or rewrite into something R still reads */
	const programs: readonly MutationTarget[] = [
		{ code: 'x <- 5\nprint(x)', criterion: '2@x', expected: '[1] 5' },
		/* the body of the function is on the next line, so the first line is not a statement of its own */
		{ code: 'f <- function()\n5\nr <- f()\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		/* the same for an operator R does not read as the end of the expression */
		{ code: 'x <- 1:\n3\nr <- sum(x)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ code: 'if(TRUE)\nx <- 2\nprint(x)', criterion: '3@x', expected: '[1] 2' },
		{ code: '\nx <- 1\ny <- x\nprint(y)', criterion: '4@y', expected: '[1] 1' },
		{ code: 'nm <- "vvv"\nvvv <- 8\nr <- get(nm)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ code: 'if(TRUE) x <- 2\nprint(x)', criterion: '2@x', expected: '[1] 2' },
		{ code: 'r <- sum(rev(1:3))\nprint(r)', criterion: '2@r', expected: '[1] 6' }
	];
	describe('every mutant is a program R reads', () => {
		for(const pass of MutationPasses) {
			/* a pass the host's R is too old for rewrites nothing, which says nothing about the pass */
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
