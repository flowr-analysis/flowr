import { describe } from 'vitest';
import { assertDiced, withTreeSitter } from '../../_helper/shell';

describe('Static Dicing', withTreeSitter(shell => {
	describe('Basic variable flows', () => {
		assertDiced('motivating example: a flows to c, b excluded',
			shell, 'a <- 3\nb <- 4\nc <- a + b', ['1@a'], ['3@c'],
			'a <- 3\nc <- a + b');

		assertDiced('only b contribution when dicing from b to c',
			shell, 'a <- 3\nb <- 4\nc <- a + b', ['2@b'], ['3@c'],
			'b <- 4\nc <- b');

		assertDiced('unrelated start yields empty result',
			shell, 'a <- 3\nb <- 4\nc <- b + 1', ['1@a'], ['3@c'],
			{ maxSize: 0 });

		assertDiced('start and end are the same node',
			shell, 'x <- 42\ny <- x', ['1@x'], ['1@x'],
			'x <- 42');
	});

	describe('Chains', () => {
		assertDiced('partial chain stops at the requested end',
			shell, 'a <- 1\nb <- a + 1\nc <- b * 2', ['1@a'], ['2@b'],
			'a <- 1\nb <- a + 1');

		assertDiced('dice from middle excludes source of the start node',
			shell, 'a <- 1\nb <- a + 1\nc <- b * 2\nd <- c - 3', ['2@b'], ['4@d'],
			'b <- a + 1\nc <- b * 2\nd <- c - 3');

		assertDiced('unrelated d-assignment excluded; d-def node absent from result',
			shell, 'a <- 1\nb <- a + 1\nc <- b * 2\nd <- 100\nresult <- c + d',
			['1@a'], ['5@result'],
			{
				excludes:   ['d <- 100'],
				contains:   ['result <-'],
				lacksNodes: ['4@d'],
			});
	});

	describe('Re-definition blocks flow', () => {
		assertDiced('overwritten variable: first assignment does not reach y',
			shell, 'x <- 1\nx <- 2\ny <- x', ['1@x'], ['3@y'],
			{ maxSize: 0 });

		assertDiced('second assignment reaches y',
			shell, 'x <- 1\nx <- 2\ny <- x', ['2@x'], ['3@y'],
			'x <- 2\ny <- x');

		assertDiced('value propagates through repeated reassignment: x <- 1 flows to final y',
			shell, 'x <- 1\nx <- x + 1\nx <- x * 2\ny <- x', ['1@x'], ['4@y'],
			{ contains: ['x <- 1', 'y <- x'] });
	});

	describe('Diamond patterns', () => {
		assertDiced('both paths a -> b -> result and a -> c -> result are included',
			shell, 'a <- 1\nb <- a + 1\nc <- a * 2\nresult <- b + c', ['1@a'], ['4@result'],
			'a <- 1\nb <- a + 1\nc <- a * 2\nresult <- b + c');

		assertDiced('multiple start nodes: both a and b to c',
			shell, 'a <- 3\nb <- 4\nc <- a + b', ['1@a', '2@b'], ['3@c'],
			'a <- 3\nb <- 4\nc <- a + b');

		assertDiced('multiple end nodes: unrelated e is excluded',
			shell, 'a <- 1\nb <- a + 1\nc <- b * 2\nd <- a + 10\ne <- 999',
			['1@a'], ['3@c', '4@d'],
			{ minSize: 1, lacksNodes: ['5@e'] });
	});

	describe('Function calls', () => {
		assertDiced('function body is on the data-flow path from argument to return value',
			shell, 'f <- function(x) x * 2\na <- 3\nb <- f(a)', ['2@a'], ['3@b'],
			{ contains: ['a <- 3', 'b <- f(a)'], excludes: ['f <- function'] });

		assertDiced('dice through a two-argument function: a-path excludes b-def, b-path excludes a-def',
			shell,
			`subtract <- function(x, y) x - y
a <- 10
b <- 3
result <- subtract(a, b)`,
			['2@a'], ['4@result'],
			{ minSize: 1, hasNodes: ['2@a'], lacksNodes: ['3@b'] });

		assertDiced('dice through two-argument function from b: b-path excludes a-def',
			shell,
			`subtract <- function(x, y) x - y
a <- 10
b <- 3
result <- subtract(a, b)`,
			['3@b'], ['4@result'],
			{ minSize: 1, hasNodes: ['3@b'], lacksNodes: ['2@a'] });

		assertDiced('closure: outer variable flows to result through captured reference',
			shell, 'y <- 10\nf <- function(x) x + y\nresult <- f(5)', ['1@y'], ['3@result'],
			{ minSize: 1 });
	});

	describe('Control flow', () => {
		assertDiced('conditional: x flows through condition and branches to result',
			shell,
			`x <- 1
if(x > 0) {
  y <- x + 1
} else {
  y <- x - 1
}
result <- y`,
			['1@x'], ['7@result'],
			{ contains: ['x <- 1', 'result <- y'] });

		assertDiced('branch-only variable excluded when it does not reach result',
			shell,
			`x <- 5
z <- 100
if(x > 0) {
  w <- z + 1
}
result <- x * 2`,
			['1@x'], ['6@result'],
			{ lacksNodes: ['2@z'] });
	});

	describe('Compound programs', () => {
		assertDiced('data pipeline excludes noise variable',
			shell,
			`raw <- 10
step1 <- raw * 2
step2 <- step1 + 5
noise <- 999
final <- step2 - 3`,
			['1@raw'], ['5@final'],
			'raw <- 10\nstep1 <- raw * 2\nstep2 <- step1 + 5\nfinal <- step2 - 3');

		assertDiced('two independent pipelines: dice selects only the requested one',
			shell,
			`a1 <- 1
a2 <- a1 + 1
a3 <- a2 * 3
b1 <- 10
b2 <- b1 + 1
b3 <- b2 * 3`,
			['1@a1'], ['3@a3'],
			'a1 <- 1\na2 <- a1 + 1\na3 <- a2 * 3');

		assertDiced('downstream forks excluded: x forks into y->z and p->q, dice from x to z only',
			shell,
			`x <- 2
y <- x * 3
z <- y + 1
p <- x + 100
q <- p - 5`,
			['1@x'], ['3@z'],
			'x <- 2\ny <- x * 3\nz <- y + 1');

		assertDiced('for-loop accumulator: initial value flows through loop to result',
			shell,
			`total <- 0
for(i in 1:5) {
  total <- total + i
}
result <- total`,
			['1@total'], ['5@result'],
			{ minSize: 1, hasNodes: ['5@result'] });
	});
}));
