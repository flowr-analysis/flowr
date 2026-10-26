import { assert, describe, test } from 'vitest';
import { withShell } from '../../_helper/shell';
import { decorateLabelContext, label } from '../../_helper/label';
import type { FlowrCapabilityId } from '../../../../src/r-bridge/data/get';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import type { RShell } from '../../../../src/r-bridge/shell';

/** the program the removal slice of `criteria` leaves of `code` */
async function removalOf(shell: RShell, code: string, criteria: SlicingCriteria): Promise<string> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(shell).build();
	analyzer.addRequest(code);
	const { 'static-slice': slices } = await analyzer.query([{ type: 'static-slice', criteria, removal: true }]);
	const left = (Object.values(slices.results)[0] as { reconstruct?: { code: string | string[] } } | undefined)?.reconstruct?.code;
	return Array.isArray(left) ? left.join('\n') : left ?? '';
}

describe('Removal slices', { concurrent: false }, withShell(shell => {
	/**
	 * Removing `criteria` from `code` leaves `left`, which R still runs, printing `output`: what is left keeps working
	 * without the removed code, which is what makes a removal slice one.
	 */
	function assertRemoval(name: string, capabilities: readonly FlowrCapabilityId[], code: string, criteria: SlicingCriteria, left: string, output: string): void {
		test(decorateLabelContext(label(name, capabilities), ['slice', 'output']), async() => {
			const remaining = await removalOf(shell, code, criteria);
			assert.strictEqual(remaining, left, `the removal slice of ${criteria.join(', ')} in:\n${code}`);
			const printed = await shell.sendCommandWithOutput(`tryCatch(eval(parse(text = ${JSON.stringify(remaining)})), error = function(e) cat("R error:", conditionMessage(e), "\\n"))`, { automaticallyTrimOutput: true });
			shell.clearEnvironment();
			assert.strictEqual(printed.join('\n'), output, `what is left of the program does not run as it should:\n${remaining}`);
		});
	}
	const caps = ['name-normal', 'call-normal', 'newlines'] as const;

	describe('Values', () => {
		assertRemoval('a value only one print needs goes with it', [...caps], 'x <- 1\ny <- x + 1\nprint(y)\nprint(x)', ['3@print'], 'x <- 1\nprint(x)', '[1] 1');
		assertRemoval('a value the rest still reads stays', [...caps], 'x <- 1\ny <- x + 1\nprint(y)\nprint(x)', ['2@y'], 'x <- 1\ny <- x + 1\nprint(y)\nprint(x)', '[1] 2\n[1] 1');
		assertRemoval('a chain only one output needs goes as a whole', [...caps], 'a <- 1\nb <- a * 2\nc <- b + 1\nprint(c)\nz <- 5\nprint(z)', ['4@print'], 'z <- 5\nprint(z)', '[1] 5');
		assertRemoval('a redefinition keeps the first definition the rest reads', [...caps], 'x <- 1\nprint(x)\nx <- 2\nprint(x)', ['4@print'], 'x <- 1\nprint(x)', '[1] 1');
		assertRemoval('nothing goes that the rest needs', [...caps], 'x <- 1\nprint(x)', ['1@x'], 'x <- 1\nprint(x)', '[1] 1');
	});
	describe('Functions', () => {
		assertRemoval('a function only the removed call uses goes with it', [...caps, 'normal-definition'], 'f <- function(x) x * 2\ng <- function(x) x + 1\nprint(f(2))\nprint(g(2))', ['3@print'], 'g <- function(x) x + 1\nprint(g(2))', '[1] 3');
		assertRemoval('a function used elsewhere stays', [...caps, 'normal-definition'], 'f <- function(x) x * 2\nprint(f(2))\nprint(f(3))', ['2@print'], 'f <- function(x) x * 2\nprint(f(3))', '[1] 6');
	});
	describe('What the rest reads', () => {
		assertRemoval('a write into a closure environment keeps the closure', [...caps, 'environment-sharing', 'closures'], 'x <- 1\nf <- function() { y <- 3; function() y }\ng <- f()\nenvironment(g)$y <- 10\nprint(g())\nprint(x)', ['6@print'],
			'f <- function() {\n        y <- 3\n        function() y\n    }\ng <- f()\nenvironment(g)$y <- 10\nprint(g())', '[1] 10');
		assertRemoval('a handler goes with the output it counts for', [...caps, 'exceptions-and-errors', 'super-left-assignment'], 'tally <- 0\nsafe <- function(f) tryCatch(f(), error = function(e) { tally <<- tally + 1; NA })\nignore <- safe(function() stop("x"))\nprint(tally)', ['4@print'],
			'tally <- 0\nsafe <- function(f) tryCatch(f(), error = function(e) { tally <<- tally + 1; NA })', '');
	});
	describe('Plots', () => {
		assertRemoval('a plot takes its device along', [...caps, 'graphics-state'], 'x <- 1\npdf(NULL)\nplot(x)\ninvisible(dev.off())\nprint(x)', ['3@plot'], 'x <- 1\nprint(x)', '[1] 1');
		assertRemoval('removing the device removes what it draws', [...caps, 'graphics-state'], 'x <- 1\npdf(NULL)\nplot(x)\ninvisible(dev.off())\nprint(x)', ['2@pdf'], 'x <- 1\nprint(x)', '[1] 1');
		assertRemoval('the data of a plot goes, the rest stays', [...caps, 'graphics-state'], 'd <- c(3, 1, 2)\nk <- 7\npdf(NULL)\nbarplot(d)\ninvisible(dev.off())\nprint(k)', ['4@barplot'], 'k <- 7\nprint(k)', '[1] 7');
	});
	describe('Files', () => {
		/* the names `tempfile()` makes are unknown, so the other read may read either file and both writes stay */
		assertRemoval('a write to a file we cannot name stays for any other read', [...caps, 'i-o'], 'p <- tempfile()\nq <- tempfile()\nwriteLines("a", p)\nwriteLines("b", q)\nr <- readLines(p)\nprint(r)\nprint(readLines(q))', ['6@print'],
			'p <- tempfile()\nq <- tempfile()\nwriteLines("a", p)\nwriteLines("b", q)\nprint(readLines(q))', '[1] "b"');
	});
	describe('Control flow', () => {
		assertRemoval('a loop only the removed output needs goes as a whole', [...caps, 'for-loop'], 's <- 0\nfor(i in 1:3) s <- s + i\nprint(s)\nprint(2)', ['3@print'], 'print(2)', '[1] 2');
		assertRemoval('a branch keeps what the rest needs of it', [...caps, 'if'], 'x <- 1\nif(x > 0) { y <- 2; z <- 3 }\nprint(y)\nprint(z)', ['3@print'], 'x <- 1\nif(x > 0) { z <- 3 }\nprint(z)', '[1] 3');
	});
	describe('Loaded packages', () => {
		/* the built-in functions of a loaded package read its library() call, but they are no code that is left */
		test(decorateLabelContext(label('the library only the removed plot needs goes with it', ['name-normal', 'call-normal', 'newlines']), ['slice']), async() => {
			const code = 'library(ggplot2)\nx <- 1\nprint(x)\nggplot(data.frame(a = 1:3), aes(a)) + geom_bar()';
			assert.strictEqual(await removalOf(shell, code, ['4@ggplot']), 'x <- 1\nprint(x)');
		});
		test(decorateLabelContext(label('the save of a removed plot goes with it', ['name-normal', 'call-normal', 'newlines']), ['slice']), async() => {
			const code = 'x <- 1\nprint(x)\nggplot(data.frame(a = 1:3), aes(a)) + geom_bar()\nggsave("a.png")';
			assert.strictEqual(await removalOf(shell, code, ['3@ggplot']), 'x <- 1\nprint(x)');
		});
	});
}));
