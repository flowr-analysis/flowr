import { assertSliced, assumeLoadedPackages, withShell, assertCallTargets, assertDataflow, assertSliceKeeps, assertSliceMatchesR, assertSliceRunsInR, withTreeSitter, type TestConfiguration } from '../../../_helper/shell';
import { label, decorateLabelContext } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { FlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import { MIN_VERSION_LAMBDA, MIN_VERSION_PIPE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { describe, afterAll, assert, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { assertHappensBefore, controlReaches } from '../../../_helper/controlflow/happens-before';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { Ternary } from '../../../../../src/util/logic';
import { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { canReach } from '../../../../../src/control-flow/simple-visitor';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../../../src/control-flow/control-flow-graph';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';

assumeLoadedPackages('dplyr', 'magrittr', 'maps', 'plyr', 'inferference');

describe('Calls', { concurrent: false }, withShell(shell => {
	describe('Simple Calls', () => {
		const code = 'i <- 4\na <- function(x) { x }\na(i)';
		for(const criterion of ['3:1', '3@a'] as const) {
			assertSliced(label(JSON.stringify(code), ['function-definitions', 'resolve-arguments', 'formals-named', 'name-normal', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments']),
				shell, code, [criterion], 'i <- 4\na <- function(x) x\na(i)'
			);
		}
		const constCapabilities: FlowrCapabilityId[] = ['function-definitions', 'resolve-arguments', 'formals-named', 'name-normal', 'numbers', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'implicit-return'];
		const constFunction = 'i <- 4\na <- function(x) { x <- 2; 1 }\na(i)';
		/* actually, `i` does not have to be defined, as it is _not used_ by the function, so we do not have to include `i <- 4` */
		assertSliced(label('Function call with constant function', constCapabilities),
			shell, constFunction, ['3:1'], 'a <- function(x) 1\na(i)');
		/* nothing of the function-content is required */
		assertSliced(label('Slice function definition', constCapabilities), shell, constFunction, ['2@a'], 'a <- function(x) { }');
		assertSliced(label('Slice within function', constCapabilities), shell, constFunction, ['2@[2]x'], 'a <- function(x) x <- 2');
		assertSliced(label('Multiple unknown calls', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'numbers', 'call-normal', 'newlines']),
			shell, '\nfoo(x, y)\nfoo(x, 3)\n    ', ['3@foo'], 'foo(x, 3)');
		assertSliced(label('Multiple unknown calls sharing known def', ['name-normal', 'resolve-arguments', 'formals-named', 'unnamed-arguments', 'implicit-return', 'numbers', 'call-normal', 'newlines']),
			shell, '\nx. <- function (x) { x }\nfoo(x, x.(y))\nfoo(x, x.(3))\n    ', ['4@foo'], 'x. <- function(x) x\nfoo(x, x.(3))');
		assertSliced(label('Using ...', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-dot-dot-dot', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'numbers']),
			shell, '\nf1 <- function (a,b) { WW }\nf2 <- function (...) { f1(...) }\nx <- 3\nWW <- 4\ny <- 3\nf2(1,x)\n    ', ['7@f2'], 'f1 <- function(a, b) WW\nf2 <- function(...) f1(...)\nx <- 3\nWW <- 4\nf2(1,x)');
	});
	describe('Functions using environment', () => {
		const envCaps: FlowrCapabilityId[] = ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'numbers'];
		/** checks both slicing criteria ('n:1' and 'n\@a') land on the same expected slice */
		function envCase(name: string, code: string, criteria: readonly SlicingCriterion[], expected: string) {
			for(const criterion of criteria) {
				assertSliced(label(name, envCaps), shell, code, [criterion], expected);
			}
		}
		envCase('Must include read (defined before)', 'i <- 4\na <- function(x) { x + i }\na(4)', ['3:1', '3@a'], 'i <- 4\na <- function(x) x + i\na(4)');
		envCase('Must include read (defined after)', 'a <- function(x) { x + i }\ni <- 4\na(5)', ['3:1', '3@a'], 'a <- function(x) x + i\ni <- 4\na(5)');
		envCase('Only keep second definition (defined before and after)', 'i <- 3\na <- function(x) { x + i }\ni <- 4\na(5)', ['4:1', '4@a'], 'a <- function(x) x + i\ni <- 4\na(5)');
	});
	describe('Functions with multiple definitions', () => {
		const code = 'a <- b <- function() { x }\nx <- 2\na()\nb()';
		const caps: FlowrCapabilityId[] = ['name-normal', 'normal-definition', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'return-value-of-assignments', 'precedence'];
		assertSliced(label('Include only b-definition', caps),
			shell, code, ['3@a'], 'a <- b <- function() x\nx <- 2\na()');
		assertSliced(label('Include only b-definition', caps),
			shell, code, ['4@b'], 'a <- b <- function() x\nx <- 2\nb()');
		const redefined = 'f <- function(g) g(1)\nk <- f(function(x) x)\nf <- function(g) g(2)\nk2 <- f(function(x) x)\nprint(k)';
		const redefinedCaps: FlowrCapabilityId[] = [...caps, 'resolve-arguments', 'formals-named', 'unnamed-arguments', 'call-anonymous', 'lambda-syntax'];
		assertSliced(label('A call does not see the body of a later redefinition', redefinedCaps),
			shell, redefined, ['5@print'], 'f <- function(g) g(1)\nk <- f(function(x) x)\nprint(k)', { expectedSliceOutput: '[1] 1' });
		const nested = 'f <- function(g, a, b) {\n  x <- g(a + b) + b\n  print(x)\n  return(x)\n}\nk <- f(\\(x) { return(x * 2) }, 3, 4)\nprint(-k)\n';
		assertSliced(label('Repeated redefinition keeps each call to its own copy', redefinedCaps),
			shell, nested + nested + nested, ['7@print'], 'f <- function(g, a, b) {\n        x <- g(a + b) + b\n        x\n        return(x)\n    }\nk <- f(\\(x) { return(x * 2) }, 3, 4)\nprint(-k)', { minRVersion: MIN_VERSION_LAMBDA });
		const draws = 'sim <- function(n) {\n  a <- rmvnorm(n)\n  b <- rnorm(n)\n  list(a = a, b = b)\n}\n' + [1, 2, 3, 4, 5, 6].map(i => `dat <- sim(${i})\nm <- fit(dat)\n`).join('') + 'print(m)';
		assertSliced(label('Top-level calls chained by the random state', caps),
			shell, draws, ['18@m'], 'sim <- function(n) {\n        a <- rmvnorm(n)\n        b <- rnorm(n)\n        list(a = a, b = b)\n    }\n' + [1, 2, 3, 4, 5].map(i => `dat <- sim(${i})\nfit(dat)\n`).join('') + 'dat <- sim(6)\nm <- fit(dat)\nm');
	});
	describe('Functions with named arguments', () => {
		const code = 'a <- function(x=4) { x }\na(x = 3)';
		assertSliced(label('Must include function definition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'implicit-return', 'newlines', 'named-arguments', 'resolve-arguments', 'numbers']),
			shell, code, ['2@a'], 'a <- function(x=4) x\na(x = 3)');

		assertSliced(label('Must work for same named arguments too', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'named-arguments', 'newlines']), shell, 'a <- 3\nb <- foo(a=a)', ['2@b'], 'a <- 3\nb <- foo(a=a)');

		assertSliced(label('Must work for same named arguments nested', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'named-arguments', 'accessing-exported-names', 'implicit-return', 'newlines', 'strings']), shell, '\nf <- function(some_variable="hello") {\n  result <- some::other(some_variable=some_variable)\n  result\n}\n    ', ['4@result'], 'f <- function(some_variable="hello") {\n        result <- some::other(some_variable=some_variable)\n        result\n    }');

		const lateCode = 'f <- function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }\nf()\n';
		assertSliced(label('Late bindings of parameter in body', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'implicit-return', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'call-normal', 'semicolons']),
			shell, lateCode, ['2@f'], 'f <- function(a=b, m=3) {\n        b <- 1\n        a\n        a + 1\n    }\nf()',
			{ expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		const lateCodeB = 'f <- function(a=b, b=3) { b <- 1; a; b <- 5; a + 1 }\nf()\n';
		assertSliced(label('Late bindings of parameter in parameters', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'call-normal', ...OperatorDatabase['+'].capabilities, 'semicolons']),
			shell, lateCodeB, ['2@f'], 'f <- function(a=b, b=3) {\n        b <- 1\n        a\n        a + 1\n    }\nf()',
			{ expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		assertSliced(label('Parameters binding context', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'implicit-return', 'newlines', 'numbers', 'call-normal']),
			shell, 'f <- function(a=y) { a }\na <- 5\ny <- 3\ny <- 4\nf()', ['5@f'], 'f <- function(a=y) a\ny <- 4\nf()');

		assertSliced(label('Named argument collides with variable', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'named-arguments', 'newlines']), shell, 'x <- 100\nlist(123, x = 200, 234)\nprint(x)',
			['3@x'], 'x <- 100\nx');
	});
	describe('Functions with nested definitions', () => {
		describe('Simple Function pass with return', () => {
			const code = 'a <- function() { a <- 2; return(function() { 1 }) }\nb <- a()\nb()';
			assertSliced(label('Must include outer function', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'numbers', 'return', 'implicit-return', 'call-normal', 'newlines', 'semicolons']),
				shell, code, ['2@a'], 'a <- function() return(function() { 1 })\na()');
			assertSliced(label('Must include linked function', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'return', 'implicit-return', 'numbers', 'newlines', 'call-normal']),
				shell, code, ['3@b'], 'a <- function() return(function() { 1 })\nb <- a()\nb()');
		});
		describe('Functions binding multiple scopes', () => {
			const code = '\na <- function() { x <- function() { z + y }; y <- 12; return(x) }\ny <- 5\nz <- 5\nu <- a()\nu()';
			assertSliced(label('Must include function shell', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'numbers', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'return', 'newlines', 'call-normal', 'semicolons']),
				shell, code, ['5@a'], 'a <- function() {\n        x <- function() { }\n        return(x)\n    }\na()');
			assertSliced(label('Must include function shell on call', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'return', 'call-normal']), shell, code, ['6@u'], 'a <- function() {\n        x <- function() z + y\n        y <- 12\n        return(x)\n    }\nz <- 5\nu <- a()\nu()');
		});
	});
	describe('Anonymous Functions', () => {
		assertSliced(label('keep anonymous', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'binary-operator', 'infix-calls', ...OperatorDatabase['-'].capabilities, 'implicit-return', 'call-anonymous', 'unnamed-arguments']),
			shell, '\nx <- (function() {\n  x <- 4\n  x - 5\n  3\n })()\ncat(x)\n    ', ['7@x'], 'x <- (function() 3)()\nx');
	});
	describe('Criterion within a function body', () => {
		/* a body only runs through its definition, so slicing into it keeps the definition and its binding */
		assertSliced(label('body without its header', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'function-calls', 'call-normal']), shell, 'f <- function() { x <- 2\nprint(x) }\nf()', ['2@x'], 'f <- function() {\n        x <- 2\n        x\n    }', { expectedOutput: '[1] 2', expectedSliceOutput: '' });
		assertSliced(label('a body beside a criterion outside it', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'semicolons', 'function-calls', 'call-normal']), shell, 'x <- 5\nf <- function() { x <- 2; x }\nprint(x)', ['2@x', '3@print'], 'x <- 5\nf <- function() x <- 2\nprint(x)', { expectedOutput: '[1] 5', expectedSliceOutput: '[1] 5' });
	});
	describe('Higher-order Functions', () => {
		const code = 'a <- function() { x <- 3; i }\ni <- 4\nb <- function(f) { i <- 5; f() }\nb(a)';
		const caps: FlowrCapabilityId[] = ['name-normal', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'newlines', 'numbers', 'formals-named', 'call-normal', 'unnamed-arguments'];
		assertSliced(label('Only i, bound globally', caps), shell, code, ['1@i'], 'a <- function() i\ni <- 4');
		assertSliced(label('Slice of b is independent', caps), shell, code, ['3@b'], 'b <- function(f) { }');
		assertSliced(label('Slice of b-call uses function', caps), shell, code, ['4@b'], 'a <- function() i\ni <- 4\nb <- function(f) f()\nb(a)');
		assertSliced(label('Directly call returned function', ['name-normal', 'closures', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'normal-definition', 'implicit-return', 'return', 'unnamed-arguments', 'newlines', 'numbers', 'call-normal']),
			shell, 'm <- 12\na <- function(x) {\n  b <- function() { function() { x } }\n  return(b())\n}\nres <- a(m)()', ['6@res'], 'm <- 12\na <- function(x) {\n        b <- function() function() x\n        return(b())\n    }\nres <- a(m)()');
		assertSliced(label('Higher order anonymous function', ['name-normal', 'resolve-arguments', 'closures', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'normal-definition', 'call-anonymous', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'newlines', 'precedence']),
			shell, 'a <- function(b) {\n  b\n}\nx <- a(function() 2 + 3)() + a(function() 7)()', ['4@x'], 'a <- function(b) b\nx <- a(function() 2 + 3)() + a(function() 7)()');
	});
	describe('Side-Effects', () => {
		assertSliced(label('Important Side-Effect', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call', 'implicit-return', 'call-normal', 'unnamed-arguments', 'newlines', 'precedence']), shell, 'x <- 2\nf <- function() { x <<- 3 }\nf()\ncat(x)\n    ', ['4@x'], 'f <- function() x <<- 3\nf()\nx');

		assertSliced(label('Unimportant Side-Effect', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', ...OperatorDatabase['<<-'].capabilities, 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'call-normal', 'unnamed-arguments', 'newlines']), shell, 'f <- function() { y <<- 3 }\nf()\ncat(x)\n    ', ['3@x'], 'x');
	});
	assertSliced(label('Nested Side-Effect For Last', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'implicit-return', 'numbers', 'call-normal', 'side-effects-in-function-call']), shell, 'f <- function() {\n  a <- function() { x }\n  x <- 3\n  a()\n  x <- 2\n  a()\n}\nb <- f()\n    ', ['8@b'], 'f <- function() {\n        a <- function() x\n        x <- 2\n        a()\n    }\nb <- f()');
	// that it contains x <- 2 is an error in the current implementation as this happens due to the 'reads' edge from the closure linking
	// however, this read edge should not apply when the call happens within the same scope
	// we have to separate on the exit points for this and re-resolve for each exit point
	assertSliced(label('Nested Side-Effect For First', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'numbers', 'call-normal', 'newlines', 'side-effects-in-function-call']), shell, 'f <- function() {\n  a <- function() { x }\n  x <- 3\n  b <- a()\n  x <- 2\n  a()\n  b\n}\nb <- f()\n    ', ['9@b'], 'f <- function() {\n        a <- function() x\n        x <- 3\n        b <- a()\n        x <- 2\n        b\n    }\nb <- f()');
	assertSliced(label('always dominating', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'side-effects-in-function-call']), shell, 'x <- 2\nf <- function() x <<- 3\nf()\nprint(x)', ['4@x'], 'f <- function() x <<- 3\nf()\nx');
	assertSliced(label('conditionally dominating', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'side-effects-in-function-call']), shell, 'x <- 2\nf <- function() x <<- 3\nif(u) f()\nprint(x)', ['4@x'], 'x <- 2\nf <- function() x <<- 3\nif(u) f()\nx');
	describe('Lazy arguments', () => {
		assertSliced(label('A call in an argument runs only when the callee forces it', ['name-normal', 'call-normal', 'newlines', 'side-effects-in-function-call', 'formals-promises']), shell, 'cnt <- 0\nf <- function(x) {\n  cnt <<- cnt + 1\n  x\n}\ng <- function(a, b) if(a) b else 0\ng(TRUE, f(3))\ng(FALSE, f(4))\nprint(cnt)', ['9@cnt'], 'cnt <- 0\nf <- function(x) {\n        cnt <<- cnt + 1\n        x\n    }\ng <- function(a, b) if(a) b else\n    0\ng(TRUE, f(3))\ng(FALSE, f(4))\ncnt', { expectedOutput: '[1] 3\n[1] 0\n[1] 1', expectedSliceOutput: '[1] 3\n[1] 0\n[1] 1' });
	});
	describe('Sink', () => {
		assertSliced(label('Output written while a sink is active reaches its readers', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'tf <- tempfile()\nsink(tf)\nprint("hidden")\nsink()\nr <- length(readLines(tf))\nprint(r)', ['6@r'], 'tf <- tempfile()\nsink(tf)\nprint("hidden")\nsink()\nr <- length(readLines(tf))\nr', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('Output a sink diverts into a text connection reaches the variable it writes', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'rc <- textConnection("buf", "w")\nsink(rc)\ncat("hi\\n")\nsink()\nclose(rc)\nbuf', ['6@buf'], 'rc <- textConnection("buf", "w")\nsink(rc)\ncat("hi\\n")\nsink()\nclose(rc)\nbuf', { expectedOutput: '[1] "hi"', expectedSliceOutput: '[1] "hi"' });
		assertSliced(label('A sink into a text connection leaves an unrelated variable alone', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'y <- 2\nrc <- textConnection("buf", "w")\nsink(rc)\ncat("hi\\n")\nsink()\nclose(rc)\ny', ['7@y'], 'y <- 2\nrc <- textConnection("buf", "w")\nsink(rc)\nsink()\ny', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		assertSliced(label('A text connection opened for reading writes no variable', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'buf <- "a"\ntc <- textConnection(buf)\ncat("hi\\n")\nbuf', ['4@buf'], 'buf <- "a"\nbuf', { expectedOutput: 'hi\n[1] "a"', expectedSliceOutput: '[1] "a"' });
		assertSliced(label('Printing a sink diverts into a text connection reaches the variable it writes', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'rc <- textConnection("buf", "w")\nsink(rc)\nprint(1)\nsink()\nclose(rc)\nprint(buf)', ['6@print'], 'rc <- textConnection("buf", "w")\nsink(rc)\nprint(1)\nsink()\nclose(rc)\nprint(buf)', { expectedOutput: '[1] "[1] 1"', expectedSliceOutput: '[1] "[1] 1"' });
		assertSliced(label('Printing after the sink ends does not reach the text connection', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'rc <- textConnection("buf", "w")\nsink(rc)\ncat("a\\n")\nsink()\nprint(2)\nclose(rc)\nprint(buf)', ['7@print'], 'rc <- textConnection("buf", "w")\nsink(rc)\ncat("a\\n")\nsink()\nclose(rc)\nprint(buf)', { expectedOutput: '[1] 2\n[1] "a"', expectedSliceOutput: '[1] "a"' });
	});
	describe('Warnings as errors', () => {
		assertSliced(label('A call that may raise in a body called within try aborts the body', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nf <- function() { g(); x <<- 2 }\ntry(f(), silent = TRUE)\nprint(x)', ['4@print'], 'x <- 1\nf <- function() {\n        g()\n        x <<- 2\n    }\ntry(f(), silent = TRUE)\nprint(x)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('A call that may raise in a body called within tryCatch aborts the body', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nf <- function() { g(); x <<- 2 }\ntryCatch(f(), error = function(e) NULL)\nprint(x)', ['4@print'], 'x <- 1\nf <- function() {\n        g()\n        x <<- 2\n    }\ntryCatch(f(), error = function(e) NULL)\nprint(x)', { expectedOutput: 'NULL\n[1] 1', expectedSliceOutput: 'NULL\n[1] 1' });
		assertSliced(label('A call that may raise in a body called through another function within try aborts the body', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nf <- function() { g(); x <<- 2 }\nk <- function() f()\ntry(k(), silent = TRUE)\nprint(x)', ['5@print'], 'x <- 1\nf <- function() {\n        g()\n        x <<- 2\n    }\nk <- function() f()\ntry(k(), silent = TRUE)\nprint(x)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('A call that may raise in a body defined after the try aborts the body', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nh <- function() try(f(), silent = TRUE)\nf <- function() { g(); x <<- 2 }\nh()\nprint(x)', ['5@print'], 'x <- 1\nh <- function() try(f(), silent = TRUE)\nf <- function() {\n        g()\n        x <<- 2\n    }\nh()\nprint(x)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('A call that may raise in a body passed as an argument within try aborts the body', ['name-normal', 'call-normal', 'newlines', 'strings', 'formals-named']), shell, 'x <- 1\nf <- function() { g(); x <<- 2 }\nh <- function(fn) fn()\ntry(h(f), silent = TRUE)\nprint(x)', ['5@print'], 'x <- 1\nf <- function() {\n        g()\n        x <<- 2\n    }\nh <- function(fn) fn()\ntry(h(f), silent = TRUE)\nprint(x)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('A call that may raise in an S3 method dispatched within try aborts the body', ['name-normal', 'call-normal', 'newlines', 'strings', 'oop-s3']), shell, 'x <- 1\nf <- function(o) UseMethod("f")\nf.default <- function(o) { g(); x <<- 2 }\ntry(f(1), silent = TRUE)\nprint(x)', ['5@print'], 'x <- 1\nf <- function(o) UseMethod("f")\nf.default <- function(o) {\n        g()\n        x <<- 2\n    }\ntry(f(1), silent = TRUE)\nprint(x)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('A body called outside of any try keeps no earlier call', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nh <- function() 3\nf <- function() { h(); x <<- 2 }\nf()\nprint(x)', ['5@print'], 'f <- function() x <<- 2\nf()\nprint(x)', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		assertSliced(label('With warn 2 set in a function never called a warning leaves the assignment', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nf <- function() options(warn = 2)\ntry({ log(-1); x <- 5 }, silent = TRUE)\nprint(x)', ['4@print'], 'f <- function() options(warn = 2)\nx <- 5\nprint(x)', { expectedOutput: '[1] 5', expectedSliceOutput: '[1] 5' });
		assertSliced(label('With warn 2 a warning aborts the assignment in try', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'options(warn = 2)\nx <- 1\ntry(x <- as.numeric("a"), silent = TRUE)\nx\noptions(warn = 0)', ['4@x'], 'options(warn = 2)\nx <- 1\ntry(x <- as.numeric("a"), silent = TRUE)\nx\noptions(warn = 0)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('With warn 2 a warning aborts the loop in try', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'options(warn = 2)\nn <- 0\ntry(for(i in 1:3) { n <- n + 1; log(-1) }, silent = TRUE)\nn\noptions(warn = 0)', ['4@n'], 'options(warn = 2)\nn <- 0\ntry(for(i in 1:3) { n <- n + 1; log(-1) }, silent = TRUE)\nn\noptions(warn = 0)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('With warn 2 a warning aborts the super-assignment of a called function', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'options(warn = 2)\nx <- 1\nf <- function() { log(-1); x <<- 2 }\ntry(f(), silent = TRUE)\nx\noptions(warn = 0)', ['5@x'], 'options(warn = 2)\nx <- 1\nf <- function() {\n        log(-1)\n        x <<- 2\n    }\ntry(f(), silent = TRUE)\nx\noptions(warn = 0)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('With warn 2 set in a function a warning aborts the try block', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\nf <- function() options(warn = 2)\nf()\ntry({ log(-1); x <- 5 }, silent = TRUE)\nx\noptions(warn = 0)', ['5@x'], 'x <- 1\nf <- function() options(warn = 2)\nf()\ntry({ log(-1); x <- 5 }, silent = TRUE)\nx\noptions(warn = 0)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('Without warn 2 a warning leaves the assignment in try', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'x <- 1\ntry(x <- as.numeric("a"), silent = TRUE)\nx', ['3@x'], 'x <- as.numeric("a")\nx', { expectedOutput: '[1] NA', expectedSliceOutput: '[1] NA' });
		assertSliced(label('With warn reset before the try a warning leaves the assignment', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'options(warn = 2)\noptions(warn = 0)\nx <- 1\ntry(x <- as.numeric("a"), silent = TRUE)\nx', ['5@x'], 'options(warn = 2)\noptions(warn = 0)\nx <- as.numeric("a")\nx', { expectedOutput: '[1] NA', expectedSliceOutput: '[1] NA' });
		assertSliced(label('Without warn 2 a warning leaves the loop in try', ['name-normal', 'call-normal', 'newlines', 'strings']), shell, 'n <- 0\ntry(for(i in 1:3) { n <- n + 1; log(-1) }, silent = TRUE)\nn', ['3@n'], 'n <- 0\nfor(i in 1:3) n <- n + 1\nn', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
	});
	describe('Files', () => {
		const caps = ['name-normal', 'call-normal', 'newlines', 'strings'] as const;
		assertSliced(label('A read of a named file keeps only the writes that may reach it', [...caps]), shell, 'writeLines("a", "a.txt")\nwriteLines("b", "b.txt")\nr <- readLines("out/a.txt")\nprint(r)', ['4@r'], 'writeLines("a", "a.txt")\nr <- readLines("out/a.txt")\nr');
		assertSliced(label('A read of a file we cannot name keeps every write', [...caps]), shell, 'p <- tempfile()\nwriteLines("b", "b.txt")\nwriteLines("a", p)\nr <- readLines(p)\nprint(r)', ['5@r'], 'p <- tempfile()\nwriteLines("b", "b.txt")\nwriteLines("a", p)\nr <- readLines(p)\nr');
		assertSliced(label('A write to a file we cannot name reaches a read of a named one', [...caps]), shell, 'p <- tempfile()\nwriteLines("a", p)\nwriteLines("b", "b.txt")\nr <- readLines("a.txt")\nprint(r)', ['5@r'], 'p <- tempfile()\nwriteLines("a", p)\nr <- readLines("a.txt")\nr');
		assertSliced(label('A write to another named file within a called function is not kept', [...caps, 'normal-definition']), shell, 'f <- function() writeLines("b", "b.txt")\nwriteLines("a", "a.txt")\nf()\nr <- readLines("a.txt")\nprint(r)', ['5@r'], 'writeLines("a", "a.txt")\nr <- readLines("a.txt")\nr');
		assertSliced(label('A write after the read is not kept', [...caps]), shell, 'writeLines("a", "a.txt")\nr <- readLines("a.txt")\nwriteLines("c", "a.txt")\nprint(r)', ['4@r'], 'writeLines("a", "a.txt")\nr <- readLines("a.txt")\nr');
		assertSliced(label('A serialized object written to another file is not kept', [...caps, 'numbers']), shell, 'saveRDS(1, "a.rds")\nsaveRDS(2, "b.rds")\nr <- readRDS("a.rds")\nprint(r)', ['4@r'], 'saveRDS(1, "a.rds")\nr <- readRDS("a.rds")\nr');
	});
	describe('Early return of function', () => {
		const code = 'x <- (function() {\n  g <- function() { y }\n  y <- 5\n  if(z)\n  \treturn(g)\n  y <- 3\n  g\n})()\nres <- x()';
		assertSliced(label('Double return points', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'call-anonymous', 'normal-definition', 'implicit-return', 'numbers', 'if', 'return', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['9@res'], '\nx <- (function() {\n        g <- function() y\n        y <- 5\n        if(z) return(g)\n        y <- 3\n        g\n    })()\nres <- x()'.trim());
	});
	describe('Recursive functions', () => {
		const code = 'f <- function() { f() }\nf()';
		assertSliced(label('Endless recursion', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['2@f'], 'f <- function() f()\nf()');
		assertSliced(label('A global read through mutual recursion', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'call-normal', 'newlines', 'if']), shell,
			'x <- 2\nf <- function(n) if(n > 0) g(n - 1) else x\ng <- function(m) f(m)\nh <- function() f(3)\nr <- h()\nx <- 5\nprint(r)', ['7@print'],
			'x <- 2\nf <- function(n) if(n > 0) g(n - 1) else\n    x\ng <- function(m) f(m)\nh <- function() f(3)\nr <- h()\nprint(r)');
		assertSliced(label('A recursive read sees no write made after the top-level call', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'call-normal', 'newlines', 'if']), shell,
			'x <- 2\nf <- function(n) if(n > 0) f(n - 1) else x\nr <- f(3)\nx <- 5\ny <- 7\nprint(r)', ['6@print'],
			'x <- 2\nf <- function(n) if(n > 0) f(n - 1) else\n    x\nr <- f(3)\nprint(r)', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
	});
	describe('Uninteresting calls', () => {
		const code = '\na <- list(1,2,3,4)\na[3]\nprint(a[2])\n    ';
		assertSliced(label('No function if not required', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'single-bracket-access', 'newlines']), shell, code, ['3@a'], 'a <- list(1,2,3,4)\na');
	});
	describe('Global vs. local definitions', () => {
		const localCode = '\na <- function() { x = x + 5; cat(x) }\nx <- 3\na()\ncat(x)';
		const localCaps: readonly FlowrCapabilityId[] = ['name-normal', 'lexicographic-scope', 'normal-definition', ...OperatorDatabase['='].capabilities, 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'semicolons', 'unnamed-arguments', 'newlines', 'call-normal', 'numbers', 'precedence'];
		assertSliced(label('Local redefinition has no effect', localCaps), shell, localCode, ['5@x'], 'x <- 3\nx');
		assertSliced(label('Local redefinition must be kept as part of call', localCaps), shell, localCode, ['4@a'], 'a <- function() {\n        x = x + 5\n        cat(x)\n    }\nx <- 3\na()');
		const globalCode = '\na <- function() { x <<- x + 5; cat(x) }\nx <- 3\na()\nx';
		assertSliced(label('But the global redefinition remains', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'call-normal', 'unnamed-arguments', 'precedence']), shell, globalCode, ['5@x'], 'a <- function() x <<- x + 5\nx <- 3\na()\nx');
		const globalCodeWithoutLocal = '\na <- function() { x <<- 5; cat(x) }\nx <- 3\na()\nx';
		assertSliced(label('The local assignment is only needed if the global reads', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'function-definitions', ...OperatorDatabase['<<-'].capabilities, 'numbers', 'newlines', 'call-normal', 'unnamed-arguments', 'precedence']), shell, globalCodeWithoutLocal, ['5@x'], 'a <- function() x <<- 5\na()\nx');

		assertSliced(label('Must work with nested globals', ['name-normal', 'resolve-arguments', 'lexicographic-scope', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'numbers', 'call-normal', 'unnamed-arguments', 'precedence']),
			shell, 'a <- function() { function(b) x <<- b }\ny <- 5\nx <- 2\na()(y)\nx', ['5@x'], 'a <- function() function(b) x <<- b\ny <- 5\na()(y)\nx');

		assertSliced(label('Must work with nested globals and known assignments not-happening', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'if', 'logical', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments', 'resolve-arguments', 'implicit-return', 'newlines', 'call-normal', 'unnamed-arguments']),
			shell, 'a <- function() { function(b) { if(FALSE) { x <<- b } } }\ny <- 5\nx <- 2\na()(y)\ncat(x)', ['5@x'], 'x <- 2\nx');

		assertSliced(label('Must work with nested globals and maybe assignments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'if', 'call-normal', ...OperatorDatabase['>'].capabilities, 'numbers', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments', 'resolve-arguments', 'lexicographic-scope', 'newlines', 'unnamed-arguments', 'closures']),
			shell, 'a <- function() { function(b) { if(runif() > .5) { x <<- b } } }\ny <- 5\nx <- 2\na()(y)\ncat(x)', ['5@x'], 'a <- function() function(b) if(runif() > .5) { x <<- b }\ny <- 5\nx <- 2\na()(y)\nx');
		assertSliced(label('A caller local is no binding of a global function', localCaps), shell, 'v <- 5\nf <- function() { v <- 1; g() }\ng <- function() v\nr <- f()\nprint(r)', ['5@print'], 'v <- 5\nf <- function() g()\ng <- function() v\nr <- f()\nprint(r)');
		assertSliced(label('A global read through a nested call sees the value at the call', localCaps), shell, 'x <- 1\ng <- function() x\nf <- function() g()\nr <- f()\nx <- 2\nprint(r)', ['6@print'], 'x <- 1\ng <- function() x\nf <- function() g()\nr <- f()\nprint(r)');
		assertSliced(label('A caller local is not needed by a global function that does not read it', localCaps), shell, 'f <- function() { v <- 1; g() }\ng <- function() 3\nr <- f()\nprint(r)', ['4@print'], 'f <- function() g()\ng <- function() 3\nr <- f()\nprint(r)', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
		assertSliced(label('A global the nested call does not read is not kept', localCaps), shell, 'a <- 1\nb <- 2\ng <- function() a\nf <- function() g()\nr <- f()\nprint(r)', ['6@print'], 'a <- 1\ng <- function() a\nf <- function() g()\nr <- f()\nprint(r)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('A closure reads its defining frame, neither the global nor its caller frame', [...localCaps, 'closures']), shell, 'x <- 1\nmk <- function() { x <- 10; function() x }\nh <- mk()\nk <- function() { x <- 100; h() }\nr <- k()\nprint(r)', ['6@print'], 'mk <- function() {\n        x <- 10\n        function() x\n    }\nh <- mk()\nk <- function() h()\nr <- k()\nprint(r)', { expectedOutput: '[1] 10', expectedSliceOutput: '[1] 10' });
	});
	describe('Using strings for definitions', () => {
		const code = "\n'a' <- function() { x <- 3; 4 }\n'a'()\na()\na <- function() { x <- 3; 5 }\n'a'()\na()\n`a`()\n    ";
		const caps: FlowrCapabilityId[] = ['name-quoted', 'name-escaped', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'name-normal', 'numbers', 'semicolons', 'implicit-return', 'call-normal', 'newlines', 'name-escaped'];
		function strCase(name: string, criterion: SlicingCriterion, expected: string) {
			assertSliced(label(name, caps), shell, code, [criterion], expected);
		}
		strCase('Must link with string/string', '3@\'a\'', '\'a\' <- function() 4\n\'a\'()');
		strCase('Must link with string/no-string', '4@a', '\'a\' <- function() 4\na()');
		strCase('Must link with no-string/string', '6@\'a\'', 'a <- function() 5\n\'a\'()');
		strCase('Must link with no-string/no-string', '7@a', 'a <- function() 5\na()'); // the common case
		strCase('Try with special backticks', '8@`a`', 'a <- function() 5\n`a`()');
		const dyn = (s: string) => label(s, ['name-normal', 'function-calls', 'strings']);
		const ran = { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1', assumeLoaded: [] };
		function assertCalls(title: string, call: string) {
			const code = `f_123 <- function() 1\nx <- ${call}\nprint(x)`;
			assertSliced(dyn(title), shell, code, ['3@print'], code, ran);
		}
		assertCalls('get with a name pasted from arithmetic', 'get(paste0("f_12", 1 + 2))()');
		assertCalls('get with a name pasted with a separator', 'get(paste("f", 120 + 3, sep = "_"))()');
		assertCalls('get with nested arithmetic', 'get(paste0("f_", 100 + 20 + 3))()');
		assertCalls('match.fun with a unary minus', 'match.fun(paste0("f_12", -(-3)))()');
		assertCalls('do.call with a computed name', 'do.call(paste0("f_", 2 * 61 + 1), list())');
		assertSliced(dyn('do.call with a name held in a variable'), shell, 'f_123 <- function() 1\nnm <- "f_123"\nx <- do.call(nm, list())\nprint(x)', ['4@print'],
			'f_123 <- function() 1\nnm <- "f_123"\nx <- do.call(nm, list())\nprint(x)', ran);
	});
	describe('Using own infix operators', () => {
		const code = "\n`%a%` <- function(x, y) { x + y }\n`%a%`(3, 4)\n\n'%b%' <- function(x, y) { x * y }\n'%b%'(3, 4)\n\ncat(3 %a% 4)\ncat(4 %b% 5)\n      ";
		const caps: FlowrCapabilityId[] = ['name-escaped', 'resolve-arguments', 'name-quoted', 'infix-calls', 'formals-named', 'implicit-return', 'newlines', 'unnamed-arguments', 'special-operator'];
		assertSliced(label('Must link with backticks', caps), shell, code, ['8:7'], '`%a%` <- function(x, y) x + y\n3 %a% 4');
		assertSliced(label('Must link with backticks', caps), shell, code, ['9:7'], "'%b%' <- function(x, y) x * y\n4 %b% 5");
		assertSliced(label('Must work with assigned custom pipes too', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'infix-calls', 'numbers', 'special-operator', 'precedence']), shell, 'a <- b %>% c %>% d', ['1@a'], 'a <- b %>% c %>% d');
	});
	describe('Using own alias infix operators', () => {
		const code = '\n"%a%" <- function(x, y) { x + y }\n"%a%" <- pkg::"%a%"\ncat(4 %a% 5)\n      ';
		assertSliced(label('Must link alias but not namespace origin', ['name-quoted', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'infix-calls', 'special-operator', 'accessing-exported-names', 'newlines', 'unnamed-arguments']),
			shell, code, ['4:1'], '"%a%" <- pkg::"%a%"\ncat(4 %a% 5)');
	});
	describe('Using own alias infix operators with namespace', () => {
		const code = '\npkg::"%a%" <- function(x, y) { x + y }\n"%a%" <- pkg::"%a%"\ncat(4 %a% 5)\n      ';
		assertSliced(label('must link alias with namespace', ['accessing-exported-names', 'resolve-arguments', 'name-quoted', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'special-operator', 'unnamed-arguments']),
			shell, code, ['4:1'], 'pkg::"%a%" <- function(x, y) x + y\n"%a%" <- pkg::"%a%"\ncat(4 %a% 5)');
	});
	describe('Quotation', () => {
		assertSliced(label('quote does not reference variables', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'built-in-quoting']), shell, 'x <- 3\ny <- quote(x)', ['2@y'], 'y <- quote(x)');
	});
	/** an S3 dispatch case: `caps` (shared per describe below) plus code/criterion/expected slice/output */
	function s3Case(name: string, caps: FlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string, out: string) {
		assertSliced(label(name, caps), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
	}
	describe('S3 Dispatch', () => {
		const s3Caps: FlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal'];
		const plainCaps: FlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'normal-definition', 'implicit-return', 'call-normal'];
		/* the generic has to evaluate its object to know the class, even though no method body reads it */
		s3Case('dispatch forces its object', s3Caps, 'p <- function(x) UseMethod("p")\np.foo <- function(x) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '5@v', 'p <- function(x) UseMethod("p")\np.foo <- function(x) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '[1] "FOO"');
		s3Case('dispatch with dots forces its object', s3Caps, 'p <- function(x, ...) UseMethod("p")\np.foo <- function(x, ...) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '5@v', 'p <- function(x, ...) UseMethod("p")\np.foo <- function(x, ...) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '[1] "FOO"');
		s3Case('next-method keeps the object as well', s3Caps, 'p <- function(x) UseMethod("p")\np.foo <- function(x) NextMethod()\np.default <- function(x) "DEF"\no <- structure(1, class="foo")\nv <- p(o)\nv', '6@v', 'p <- function(x) UseMethod("p")\np.foo <- function(x) NextMethod()\np.default <- function(x) "DEF"\no <- structure(1, class="foo")\nv <- p(o)\nv', '[1] "DEF"');
		/* `NextMethod` passes on the current value of the formals, so the reassignment before it stays */
		s3Case('next-method sees the modified formal', s3Caps, 'f <- function(x) UseMethod("f")\nf.a <- function(x) {\n  x <- unclass(x)\n  NextMethod()\n}\nf.default <- function(x) class(x)\nr <- f(structure(1, class="a"))\nprint(r)', '8@r', 'f <- function(x) UseMethod("f")\nf.a <- function(x) {\n        x <- unclass(x)\n        NextMethod()\n    }\nf.default <- function(x) class(x)\nr <- f(structure(1, class="a"))\nr', '[1] "numeric"');
		/* control: a plain function never forces the parameter it does not mention, so the argument may go */
		s3Case('a plain call still drops the argument it never forces', plainCaps, 'p <- function(x) "FOO"\nu <- 1\nv <- p(u)\nv', '4@v', 'p <- function(x) "FOO"\nv <- p(u)\nv', '[1] "FOO"');
		/* control: naming the object moves the dispatch to it, leaving the first formal lazy */
		s3Case('a named object leaves the first formal lazy', s3Caps, 'p <- function(x, y) UseMethod("p", y)\np.foo <- function(x, y) "FOO"\np.default <- function(x, y) "DEF"\nw <- 7\no <- structure(1, class="foo")\nv <- p(w, o)\nv', '7@v', 'p <- function(x, y) UseMethod("p", y)\np.foo <- function(x, y) "FOO"\np.default <- function(x, y) "DEF"\no <- structure(1, class="foo")\nv <- p(w, o)\nv', '[1] "FOO"');
		const printCounter = 'cnt <- 0\nprint.zz <- function(x, ...) { cnt <<- cnt + 1; invisible(x) }\nx <- structure(1, class = "zz")\n';
		assertSliced(label('an invisible value at the top level runs no print method', [...s3Caps, 'side-effects-in-function-call']), shell, `${printCounter}invisible(x)\ncat(cnt, "\\n")`, ['5@cat'], 'cnt <- 0\ncat(cnt, "\\n")', { expectedOutput: /^0\s*$/, expectedSliceOutput: /^0\s*$/ });
		assertSliced(label('an assignment at the top level runs no print method', [...s3Caps, 'side-effects-in-function-call']), shell, `${printCounter}y <- x\ncat(cnt, "\\n")`, ['5@cat'], 'cnt <- 0\ncat(cnt, "\\n")', { expectedOutput: /^0\s*$/, expectedSliceOutput: /^0\s*$/ });
		assertSliced(label('a visible value at the top level runs its print method', [...s3Caps, 'side-effects-in-function-call']), shell, `${printCounter}x\ncat(cnt, "\\n")`, ['5@cat'], 'cnt <- 0\nprint.zz <- function(x, ...) cnt <<- cnt + 1\nx <- structure(1, class = "zz")\nx\ncat(cnt, "\\n")', { expectedOutput: /^1\s*$/, expectedSliceOutput: /^1\s*$/ });
	});
	describe('S3 Dispatch on Base Generics', () => {
		const baseCaps: FlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal', 'named-arguments', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities];
		/* `length` dispatches just like a `UseMethod` generic does, so its method has to stay */
		s3Case('a method of a base generic stays', baseCaps, 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '4@v', 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '[1] 99');
		s3Case('a method of an operator stays', [...baseCaps, 'name-quoted', 'infix-calls', ...OperatorDatabase['+'].capabilities], '"+.mn" <- function(e1, e2) 123\no <- structure(1, class="mn")\nv <- o + 1\nv', '4@v', '"+.mn" <- function(e1, e2) 123\no <- structure(1, class="mn")\nv <- o + 1\nv', '[1] 123');
		s3Case('a method of an extractor stays', [...baseCaps, 'name-quoted', 'single-bracket-access'], '"[.mm" <- function(x, i) 55\no <- structure(c(1,2,3), class="mm")\nv <- o[2]\nv', '4@v', '"[.mm" <- function(x, i) 55\no <- structure(c(1,2,3), class="mm")\nv <- o[2]\nv', '[1] 55');
		s3Case('next-method through a base generic', baseCaps, 'length.zz <- function(x) NextMethod()\no <- structure(c(1,2,3), class="zz")\nv <- length(o)\nv', '4@v', 'length.zz <- function(x) NextMethod()\no <- structure(c(1,2,3), class="zz")\nv <- length(o)\nv', '[1] 3');
		/* precision: only the methods of the generic that is called, and only when it is called at all */
		s3Case('a method of another generic is not dragged in', baseCaps, 'foo.bar <- function(x) 1\nlength.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '5@v', 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '[1] 99');
		s3Case('an undispatched method goes', baseCaps, 'length.zz <- function(x) 99\nu <- 5\nv <- u\nv', '4@v', 'u <- 5\nv <- u\nv', '[1] 5');
	});
	describe('S4 Registration', () => {
		const s4Caps: FlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s4', 'normal-definition', 'implicit-return', 'call-normal', 'unnamed-arguments', 'named-arguments', ...OperatorDatabase['<-'].capabilities];
		/** `sliceOut` defaults to `out` when the R output and the slice's own output agree */
		function s4Case(name: string, code: string, criterion: SlicingCriterion, expected: string, out: string | RegExp, sliceOut?: string | RegExp) {
			assertSliced(label(name, s4Caps), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: sliceOut ?? out });
		}
		/* `setClass` writes a string-keyed registry `new("P")` reads, so the slice cannot drop it */
		s4Case('new keeps the class registration', 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '4@r', 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '[1] 1');
		s4Case('a prototype default is kept with its class', 'setClass("W", representation(v = "numeric"), prototype(v = 12))\no <- new("W")\nr <- o@v\nr', '4@r', 'setClass("W", representation(v = "numeric"), prototype(v = 12))\no <- new("W")\nr <- o@v\nr', '[1] 12');
		/* `setMethod` answers an existing generic, so it depends on the `setGeneric` that created it */
		s4Case('a method keeps the generic it answers', 'setGeneric("sz", function(x) standardGeneric("sz"))\nsetMethod("sz", "numeric", function(x) x * 3)\nr <- sz(4)\nr', '4@r', 'setGeneric("sz", function(x) standardGeneric("sz"))\nsetMethod("sz", "numeric", function(x) x * 3)\nr <- sz(4)\nr', '[1] "sz"\n[1] 12');
		/* `setReplaceMethod` is `setMethod` for the `<-` generic */
		s4Case('a replace method keeps its registration', 'setClass("S", representation(a = "numeric"))\nsetGeneric("inc<-", function(o, value) standardGeneric("inc<-"))\nsetReplaceMethod("inc", "S", function(o, value) {\n  o@a <- o@a + value\n  o\n})\ns <- new("S", a = 1)\ninc(s) <- 5\nr <- s@a\nprint(r)', '10@r', 'setClass("S", representation(a = "numeric"))\nsetGeneric("inc<-", function(o, value) standardGeneric("inc<-"))\nsetReplaceMethod("inc", "S", function(o, value) {\n  o@a <- o@a + value\n  o\n})\ns <- new("S", a = 1)\ninc(s) <- 5\nr <- s@a\nr', '[1] "inc<-"\n[1] 6');
		/* `callNextMethod` reaches the method of the superclass, which the chain of generic reads keeps */
		s4Case('call-next-method keeps the inherited method', 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "A", function(o) o@x)\nsetMethod("f", "B", function(o) callNextMethod() + 1)\nr <- f(new("B", x = 10))\nr', '7@r', 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "A", function(o) o@x)\nsetMethod("f", "B", function(o) callNextMethod() + 1)\nr <- f(new("B", x = 10))\nr', '[1] "f"\n[1] 11');
		/* `setValidity` changes what `new` does with the class, so it is kept, and it keeps the declaration in turn */
		s4Case('a validator is kept with the class it guards', 'setClass("P", representation(s = "numeric"))\nsetValidity("P", function(object) if(object@s < 0) "neg" else TRUE)\nr <- tryCatch(new("P", s = -1)@s, error = function(e) -99)\nr', '4@r', 'setClass("P", representation(s = "numeric"))\nsetValidity("P", function(object) if(object@s < 0) "neg" else TRUE)\nr <- tryCatch(new("P", s = -1)@s, error = function(e) -99)\nr', /\[1\] -99$/);
		/* precision: the registry is keyed by name, so a class nothing uses stays out */
		s4Case('an unused class registration is dropped', 'setClass("P", representation(s = "numeric"))\nsetClass("Q", representation(t = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '5@r', 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '[1] 1');
		/* precision: the same for a generic nothing calls */
		s4Case('an unused generic is dropped', 'setGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "numeric", function(o) o * 2)\nsetGeneric("h", function(o) standardGeneric("h"))\nsetMethod("h", "numeric", function(o) o + 100)\nr <- f(3)\nr', '6@r', 'setGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "numeric", function(o) o * 2)\nr <- f(3)\nr', '[1] "f"\n[1] "h"\n[1] 6', '[1] "f"\n[1] 6');
	});
	describe('Assignment and Reflection Functions', () => {
		describe('Assign', () => {
			assertSliced(label('using assign as assignment', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']), shell, 'assign("x", 42)\nx', ['2@x'], 'assign("x", 42)\nx');
			assertSliced(label('function', ['name-normal', 'assignment-functions', 'strings', 'newlines', 'numbers', 'implicit-return', 'normal-definition']), shell, 'assign("a", function() 1)\na()', ['2@a'], 'assign("a", function() 1)\na()');
			assertSliced(label('conditional assign', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'if', 'lambda-syntax', 'numbers', 'call-normal', 'implicit-return', 'assignment-functions', 'strings', 'numbers']),
				shell, `a <- \\() 2
if(y) {
   assign("a", function() 1)
}
a()`, ['5@a'], `a <- \\() 2
if(y) { assign("a", function() 1) }
a()`, { minRVersion: MIN_VERSION_LAMBDA });
		});
		describe('DelayedAssign', () => {
			assertSliced(label('using delayed-assign as assignment', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']), shell, 'delayedAssign("x", 42)\nx', ['2@x'], 'delayedAssign("x", 42)\nx');
			/** a delayed-assign force case, checked with both the R output and the slice's own output */
			function delayedCase(name: string, code: string, criterion: SlicingCriterion, expected: string, out: string) {
				assertSliced(label(name, ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
			}
			/* the promise is forced at the read, so it sees the last write of `x`, not the one at registration time */
			delayedCase('using delayed-assign keeps the bindings the force may see', 'x <- 4\ndelayedAssign("y", x)\nx <- 5;\ny', '4@y', 'x <- 4\ndelayedAssign("y", x)\nx <- 5\ny', '[1] 5');
			delayedCase('the delayed expression drags in what it reads', 'z <- 1\ndelayedAssign("d", z * 2)\nv <- d\nv', '4@v', 'z <- 1\ndelayedAssign("d", z * 2)\nv <- d\nv', '[1] 2');
			delayedCase('the force decides which binding is read', 'z <- 1\ndelayedAssign("d", z)\nz <- 10\nv <- d\nv', '5@v', 'z <- 1\ndelayedAssign("d", z)\nz <- 10\nv <- d\nv', '[1] 10');
			/* the writes of the delayed expression happen at the force, a read before it sees the old value (checked against R) */
			delayedCase('the promise is bound in assign.env', 'x <- 1\ne <- new.env()\ndelayedAssign("p", x, assign.env = e)\nx <- 5\nprint(get("p", e))', '5@print', 'x <- 1\ne <- new.env()\ndelayedAssign("p", x, assign.env = e)\nx <- 5\nprint(get("p", e))', '[1] 5');
			delayedCase('a read before the force misses what the promise writes', 'x <- 1\ndelayedAssign("p", {x <- 2; 3})\nprint(x)\ny <- p', '3@print', 'x <- 1\nprint(x)', '[1] 1');
			/* control: an expression without free variables must not pull anything along */
			delayedCase('a closed delayed expression drags in nothing', 'q <- 99\ndelayedAssign("d", 1 + 2)\nv <- d\nv', '4@v', 'delayedAssign("d", 1 + 2)\nv <- d\nv', '[1] 3');
		});
		describe('Get', () => {
			assertSliced(label('get-access should work like a symbol-access', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'name-created-resolved']), shell, 'x <- 42\ny <- get("x")', ['2@y'], 'x <- 42\ny <- get("x")');
			assertSliced(label('function', ['name-normal', 'strings', 'newlines', 'normal-definition', 'implicit-return', ...OperatorDatabase['<-'].capabilities, 'name-created-resolved']), shell, 'a <- function() 1\nb <- get("a")\nb()', ['3@b'], 'a <- function() 1\nb <- get("a")\nb()');
			assertSliced(label('get in function', ['name-normal', 'function-definitions', 'newlines', 'strings', 'implicit-return', 'name-created-resolved']),
				shell, 'a <- 5\nf <- function() {\n  get("a")\n}\nf()', ['5@f'], 'a <- 5\nf <- function() get("a")\nf()');
			assertSliced(label('get in function argument', ['name-normal', 'formals-default', 'strings', 'implicit-return', ...OperatorDatabase['<-'].capabilities, 'newlines', 'numbers', 'name-created-resolved']),
				shell, 'a <- 5\nf <- function(a = get("a")) {\n  a\n}\nf()', ['5@f'], 'f <- function(a=get("a")) a\nf()');
			assertSliced(label('exists with the name in a variable', ['name-normal', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'name-created', 'name-created-resolved']),
				shell, 'x <- 1\nnm <- "x"\nr <- exists(nm)\nprint(r)', ['4@r'], 'x <- 1\nnm <- "x"\nr <- exists(nm)\nr');
			assertSliced(label('get with a piped, computed name resolves the same as the nested form', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'name-created-resolved', 'pipe-and-pipe-bind']),
				shell, 'i <- 1\nv1 <- 5\nr <- "v" |> paste0(i) |> get()\nprint(r)', ['4@r'], 'i <- 1\nv1 <- 5\nr <- "v" |> paste0(i) |> get()\nr',
				{ minRVersion: MIN_VERSION_PIPE });
			assertSliced(label('get with an unresolvable name drops the definition it reads', ['name-created']),
				shell, 'x <- 1\nnm <- Sys.getenv("FLOWR_TEST_UNSET_VAR", unset = "x")\nprint(get(nm))', ['3@get'], 'nm <- Sys.getenv("FLOWR_TEST_UNSET_VAR", unset = "x")\nget(nm)');
		});
		describe('Combine get and assign', () => {
			assertSliced(label('get in assign', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'assignment-functions', 'strings', 'unnamed-arguments', 'newlines', 'name-created-resolved']), shell, 'b <- 5\nassign("a", get("b"))\nprint(a)', ['3@a'], 'b <- 5\nassign("a", get("b"))\na');
			assertSliced(label('get-access a function call', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'function-definitions', 'call-normal', 'name-created-resolved']),
				shell, 'a <- function() 1\nb <- get("a")\nres <- b()', ['3@res'], 'a <- function() 1\nb <- get("a")\nres <- b()');
		});
	});
	describe('Redefine built-ins', () => {
		assertSliced(label('redefining assignments should work', ['name-quoted', 'name-normal', 'precedence', 'numbers', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['='].capabilities, 'redefinition-of-built-in-functions-primitives']), shell, 'x <- 1\n`<-`<-`*`\nx <- 3\ny = x', ['4@y'], 'x <- 1\ny = x');
		assertSliced(label('redefine if', ['name-escaped', ...OperatorDatabase['<-'].capabilities, 'numbers', 'formals-dot-dot-dot', 'newlines', 'unnamed-arguments']),
			shell, '`if` <- function(...) 2\nif(1) \n   x <- 3\nprint(x)', ['4@x'], '`if` <- function(...) 2\nif(1) x <- 3\nx');
		assertSliced(label('named argument with redefine', ['name-escaped', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities, 'named-arguments', 'newlines', 'numbers']),
			shell, 'x <- 2\n`<-` <- `*`\nx <- 3\nprint(y = x)', ['4@y'], 'y=x');
		assertSliced(label('redefine in local scope', [
			'newlines', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities,
			'numbers', 'name-escaped', 'call-normal', 'function-definitions', 'redefinition-of-built-in-functions-primitives'
		]),
		shell, 'f <- function() {\n   x <- 2\n   `<-` <- `*`\n   x <- 3\n}\ny <- f()\nprint(y)', ['7@y'], 'f <- function() {\n        x <- 2\n        `<-` <- `*`\n        x <- 3\n    }\ny <- f()\ny' /* the formatting here seems wild, why five spaces */, { expectedOutput: '[1] 6' });
	});
	describe('Switch', () => {
		assertSliced(label('Switch with named arguments', ['switch', ...OperatorDatabase['<-'].capabilities, 'numbers', 'strings', 'named-arguments', 'unnamed-arguments', 'switch', 'function-calls']), shell, 'x <- switch("a", a=1, b=2, c=3)', ['1@x'], 'x <- switch("a", a=1, b=2, c=3)');
	});
	describe('Separate Function Resolution', () => {
		const resolutionCaps: FlowrCapabilityId[] = ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'call-normal', 'newlines', 'search-type'];
		assertSliced(label('Separate function resolution', resolutionCaps), shell, 'c <- 3\nc(1, 2, 3)', ['2@c'], 'c(1, 2, 3)');
		assertSliced(label('Separate function resolution', resolutionCaps), shell, 'c <- 3\nprint(c(1, 2))', ['2@print'], 'print(c(1, 2))');
	});
	describe('Failures in Practice', () => {
		describe('empty functions', () => {
			assertSliced(label('Empty Function in Reconstruct', ['function-definitions']), shell,
				'x <- 2\nfoo <- function(n, x = 3) { print(x) }\nprint(x)', ['3@x'], 'x <- 2\nx');
		});
		describe('Super Side-Effects', () => {
			const sideEffectCaps: FlowrCapabilityId[] = ['super-left-assignment', 'lexicographic-scope'];
			assertSliced(label('No recursion', sideEffectCaps), shell, 'calls <- 0\nx <- function() {\n  calls <<- calls + 1\n  4\n}\nx()', ['6@x'], 'x <- function() 4\nx()');
			assertSliced(label('With recursion', sideEffectCaps), shell, 'calls <- 0\nx <- function() {\n  calls <<- calls + 1\n  x()\n}\nx()', ['6@x'], 'x <- function() x()\nx()');
			assertSliced(label('Counting fibonacci', sideEffectCaps), shell, 'calls <- 0\nfib <- function() {\n  calls <<- calls + 1\n  if(n <= 1) {\n    n\n  } else {\n    fib(n - 1) + fib(n - 2)\n  }\n}\nfib(42)', ['10@fib'], 'fib <- function() if(n <= 1) { n } else\n' +
				'    { fib(n - 1) + fib(n - 2) }\nfib(42)');
		});
		describe('Inverted Caller', () => {
			const invertedCaps: FlowrCapabilityId[] = ['function-calls', 'lexicographic-scope'];
			function invertedCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, invertedCaps), shell, code, [criterion], expected);
			}
			invertedCase('Call from Higher', 'create <- function() function() 3\ng <- create()\nc <- g()', '3@c', 'create <- function() function() 3\ng <- create()\nc <- g()');
			invertedCase('Call from Lower', 'g <- function() 3\ncreate <- function() function() g()\nc <- create()()', '3@c', 'g <- function() 3\ncreate <- function() function() g()\nc <- create()()');
			invertedCase('Higher Base', '\nx <- function() b()\nc <- (function() {\na <- function() b() + x()\nb <<- function() 2\ng <- function() f() + 1\nh <- function() g() * 2\nf <- function() a()\nh()})()'.trim(), '2@c', '\nx <- function() b()\nc <- (function() {\n        a <- function() b() + x()\n        b <<- function() 2\n        g <- function() f() + 1\n        h <- function() g() * 2\n        f <- function() a()\n        h()\n    })()\n'.trim());
		});
		/* adapted from a complex pipe in practice */
		describe('Nested Pipes', () => {
			const caps: FlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'double-bracket-access', 'numbers', 'infix-calls', 'binary-operator', 'call-normal', 'newlines', 'unnamed-arguments', 'precedence', 'special-operator', 'strings', ...OperatorDatabase['=='].capabilities];
			const code = 'x <- fun %>%\n\t\t\t\tfilter(X == "green") %>%\n\t\t\t\tdplyr::select(X, Y) %>%\n\t\t\t\tmutate(Z = 5) %>%\n\t\t\t\tdistinct() %>%\n\t\t\t\tgroup_by(X) %>%\n\t\t\t\t# i am commento!\n\t\t\t\tsummarize(Y = mean(Y)) %>%\n\t\t\t\tleft_join(., ., by = "X") %>%\n\t\t\t\tungroup() %>%\n\t\t\t\tmutate(Y = Y + 1) %>%\n\t\t\t\tfilter(Y > 5)';
			assertSliced(label('Require complete pipe', caps), shell, code, ['1@x'], 'x <- fun %>% filter(X == "green") %>% dplyr::select(X, Y) %>% mutate(Z = 5) %>% distinct() %>% group_by(X) %>% summarize(Y = mean(Y)) %>% left_join(., ., by = "X") %>% ungroup() %>% mutate(Y = Y + 1) %>% filter(Y > 5)');
			/* a name in a data mask is a column of the data handed to the verb, so the data is part of its slice */
			assertSliced(label('Slice for variable in filter', caps), shell, code, ['2@X'], 'fun %>% X');
			assertSliced(label('Slice for variable in last filter', caps), shell, code, ['12@Y'], 'fun %>% filter(X == "green") %>% dplyr::select(X, Y) %>% mutate(Z = 5) %>% distinct() %>% group_by(X) %>% summarize(Y = mean(Y)) %>% left_join(., ., by = "X") %>% ungroup() %>% mutate(Y = Y + 1) %>% Y');
		});
		describe('Functions in Unknown Call Contexts', () => {
			const capabilities: FlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities,
				'numbers', 'unnamed-arguments', 'newlines', 'call-normal', 'resolve-arguments', 'named-arguments', 'implicit-return', 'grouping', 'formals-named'
			];
			function fooCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, capabilities), shell, code, [criterion], expected);
			}
			fooCase('call in unknown foo', '\nf <- function(y) { y + 3 }\nfoo(.x = f(3))\n', '3@foo', 'f <- function(y) y + 3\nfoo(.x = f(3))');
			fooCase('definition in unknown foo', 'x <- 2;\nfoo(.x = function(y) { y + 3 })', '2@foo', 'foo(.x = function(y) { y + 3 })');
			fooCase('nested definition in unknown foo', 'x <- function() { 3 }\nfoo(.x = function(y) { c(X = x()) })', '2@foo', 'x <- function() 3\nfoo(.x = function(y) { c(X = x()) })');
			fooCase('nested definition in unknown foo with reference', 'x <- function() { 3 }\ng = function(y) { c(X = x()) }\nfoo(.x = g)', '3@foo', 'x <- function() 3\ng = function(y) c(X = x())\nfoo(.x = g)');
		});
		describe('Anonymous Function Recovery on Parameter', () => {
			const caps: FlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'grouping',
				'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition', 'unnamed-arguments',
				'formals-named'
			];
			function anonCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, caps), shell, code, [criterion], expected);
			}
			anonCase('Simple Anonymous Function', 'function(x, y=3) {\n    x\n   x + y\n   }', '2@x', 'function(x, y=3) x');
			anonCase('Simple Anonymous Function (both)', 'function(x, y=3) {\n    x\n   z <- x + y\n   }', '3@z', 'function(x, y=3) z <- x + y');
		});
		describe('Grouped Default Values', () => {
			const caps: FlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping',
				'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition',
				'unnamed-arguments', 'formals-named', 'call-normal'
			];
			const plusCaps: FlowrCapabilityId[] = [...caps, ...OperatorDatabase['+'].capabilities];
			function groupedDefault(name: string, usesPlus: boolean, code: string, expected: string, out: string) {
				assertSliced(label(name, usesPlus ? plusCaps : caps), shell, code, ['3@v'], expected, { expectedOutput: out, expectedSliceOutput: out });
			}
			groupedDefault('Parenthesized default', false, 'f <- function(a, b = (1)) { b }\nv <- f(3)\nv', 'f <- function(a, b=(1)) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Braced default', false, 'f <- function(a, b = { 1 }) { b }\nv <- f(3)\nv', 'f <- function(a, b={1}) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Nested parenthesized default', false, 'f <- function(a, b = ((1))) { b }\nv <- f(3)\nv', 'f <- function(a, b=((1))) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Parenthesized compound default', true, 'f <- function(a, b = (a + 1)) { b }\nv <- f(3)\nv', 'f <- function(a, b=(a + 1)) b\nv <- f(3)\nv', '[1] 4');
			groupedDefault('Braced multi-expression default', true, 'f <- function(a, b = { x <- 2; x + 1 }) { b }\nv <- f(3)\nv', 'f <- function(a, b={x <- 2; x + 1}) b\nv <- f(3)\nv', '[1] 3');
			/* controls: ungrouped defaults must stay untouched */
			groupedDefault('Constant default', false, 'f <- function(a, b = 1) { b }\nv <- f(3)\nv', 'f <- function(a, b=1) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Symbol default', false, 'f <- function(a, b = a) { b }\nv <- f(3)\nv', 'f <- function(a, b=a) b\nv <- f(3)\nv', '[1] 3');
			groupedDefault('Call default', false, 'f <- function(a, b = length(a)) { b }\nv <- f(3)\nv', 'f <- function(a, b=length(a)) b\nv <- f(3)\nv', '[1] 1');
		});
		describe('Grouped Conditions and Vectors', () => {
			const caps: FlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping', 'numbers', 'newlines'
			];
			function groupedCase(name: string, extraCaps: FlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string, out: string) {
				assertSliced(label(name, [...caps, ...extraCaps]), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
			}
			groupedCase('Parenthesized if condition', ['if', 'logical'], 'a <- TRUE\nif((a)) { v <- 1 } else { v <- 2 }\nv', '3@v', 'v <- 1\nv', '[1] 1');
			groupedCase('Parenthesized while condition', ['while-loop', ...OperatorDatabase['<'].capabilities, ...OperatorDatabase['+'].capabilities], 'i <- 0\nwhile((i < 2)) { i <- i + 1 }\nv <- i\nv', '4@v', 'i <- 0\nwhile((i < 2)) i <- i + 1\nv <- i\nv', '[1] 2');
			groupedCase('Parenthesized for vector', ['for-loop', ...OperatorDatabase[':'].capabilities, ...OperatorDatabase['+'].capabilities], 's <- 0\nfor(i in (1:3)) { s <- s + i }\nv <- s\nv', '4@v', 's <- 0\nfor(i in (1:3)) s <- s + i\nv <- s\nv', '[1] 6');
			groupedCase('Braced for vector', ['for-loop', ...OperatorDatabase[':'].capabilities, ...OperatorDatabase['+'].capabilities], 's <- 0\nfor(i in { 1:3 }) { s <- s + i }\nv <- s\nv', '4@v', 's <- 0\nfor(i in {1:3}) s <- s + i\nv <- s\nv', '[1] 6');
		});
		describe('Potentially redefine built-ins', () => {
			assertSliced(label('Potential Definition', [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'if'
			]), shell, 'x <- 2\nif(u) `<-` <- `*`\nx <- 3', ['3@x'], 'x <- 2\nif(u) `<-` <- `*`\nx <- 3');
		});
		describe('Primitive', () => {
			assertSliced(label('Without using primitive', [
				'built-in-internal-and-primitive-functions'
			]), shell, 'print <- function(...) 42\nprint(3)', ['2@print'], 'print <- function(...) 42\nprint(3)');
		});
		describe('Data Table Assignments', () => {
			const caps: FlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase[':='].capabilities,
				'strings', 'newlines', 'unnamed-arguments', 'call-normal'
			];
			function dtCase(name: string, extraCaps: FlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, [...caps, ...extraCaps]), shell, code, [criterion], expected);
			}
			dtCase('Single occurrence', ['single-bracket-access', 'functions-with-global-side-effects'], 'load("x")\nm[,ii:=sample(yy),]\nprint(m)', '3@print', 'load("x")\nm[,ii:=sample(yy),]\nprint(m)');
			dtCase('Work with double brackets too', ['double-bracket-access', 'functions-with-global-side-effects'], 'load("x")\nm[[ii:=sample(yy)]]\nprint(m)', '3@print', 'load("x")\nm[[ii:=sample(yy)]]\nprint(m)');
			dtCase('Multiple occurrences', ['single-bracket-access', 'access-with-argument-names', 'functions-with-global-side-effects', 'logical'], 'load("x")\nm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nprint(m)', '4@print', 'load("x")\nm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nprint(m)');
			dtCase('Overwrites should still apply', [...OperatorDatabase['<-'].capabilities, 'single-bracket-access', 'access-with-argument-names', 'numbers'], 'm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nm <- 5\nprint(m)', '4@print', 'm <- 5\nprint(m)');
		});
		describe('if-then-else format', () => {
			const caps: FlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'if', 'logical', 'binary-operator', 'infix-calls', 'call-normal', 'newlines', 'unnamed-arguments', 'precedence'];
			const code = 'x <- 3\n{\nif (x == 3)\n{ x <- 4 \ny <- 2 }\nelse { x <- y <- 3 }\n}\nprint(x)\n\t\t\t';
			assertSliced(label('Slice for initial x should return noting else', caps), shell, code, ['1@x'], 'x <- 3', { expectedOutput: '[1] 4' });
			assertSliced(label('Slice for first condition', caps), shell, code, ['3@x'], 'x <- 3\nx');
			assertSliced(label('Slice for last x', caps),
				shell, code, ['8@x'], 'x <- 3\nif(x == 3) { \n        x <- 4\n        y <- 2\n    } else \n{ x <- y <- 3 }\nx');
		});
		describe('Apply Functions', () => {
			const applyCaps: FlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return'];
			/** the slice at `criterion` is `expected` (`code` unchanged by default) */
			function applyCase(name: string, caps: FlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string = code) {
				assertSliced(label(name, caps), shell, code, [criterion], expected);
			}
			describe('Lapply Forcing the Map Function Body', () => {
				applyCase('Forcing Second Argument', applyCaps, 'res <- lapply(1:3, function(x) x + 1)', '1@res');
				applyCase('Forcing Second Argument with closure', [...applyCaps, 'closures'], 'y <- 2\nres <- lapply(1:3, function(x) x + y)', '2@res');
				applyCase('Forcing Second Argument with closure colliding with built-in name', [...applyCaps, 'closures'], 'data <- 2\nres <- lapply(1:3, function(x) x + data)', '2@res');
				applyCase('Forcing Second Argument with closure colliding with built-in name access', [...applyCaps, 'closures'], 'data <- c()\nres <- lapply(1:3, function(x) x + data[x])', '2@res');
				applyCase('Forcing Second Argument Nested with closure colliding with built-in name access', [...applyCaps, 'closures'], 'data <- c()\nres <- do.call(rbind, lapply(1:2, function(y) { lapply(1:3, function(x) x + data[x]) }))', '2@res');
				applyCase('Force-Including Call Reference', [...applyCaps, 'closures'], 'foo <- bar()\nres <- lapply(1:3, function(x) foo * 2)', '2@res');
			});
			describe('With FUN.VALUE', () => {
				applyCase('Force-Including Call Reference', [...applyCaps, 'closures'], 'themed <- vapply(defaults, FUN.VALUE = logical(1), function(x) {\n    is_quosure(x) && quo_is_call(x, name = "from_theme")\n  })', '1@themed');
			});
			describe('nested ddply', () => {
				applyCase('Force-Including Call Reference', [...applyCaps, 'closures'], 'foo <- function(k) {\n\t\t\t\t\tg <- function(x) { x + 1 }\n\t\t\t\t\tK <- ddply(k, k, .fun=function(xx,yy) { c(N=g(xx)) })\n\t\t\t\t\treturn(K)\n\t\t\t\t }\n\t\t\t\t foo(1:3)', '6@foo', 'foo <- function(k) {\n        g <- function(x) x + 1\n        K <- ddply(k, k, .fun=function(xx,yy) { c(N=g(xx)) })\n        return(K)\n    }\nfoo(1:3)');
			});
			describe('interference', () => {
				applyCase('interference function', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'call-normal', 'implicit-return'],
					'foo <- function(x) x\ninterference(formula = a | b | c, propensity_integrand="foo")', '2@interference');
			});
			describe('Mapply Forcing the Map Function Body in the first arg', () => {
				applyCase('Forcing First Argument', applyCaps, 'res <- mapply(function(x) x + 1, 1:3)', '1@res');
				applyCase('Force-Including Reference', applyCaps, 'foo <- bar()\nres <- mapply(function(x) foo * 2, 1:3)', '2@res');
			});
		});
		describe('Using built-in names as a variable', () => {
			for(const [loop, loopLabel] of [['for(i in 1:length(l))', 'for-loop'], ['while(xx)', 'while-loop'], ['repeat', 'repeat-loop']] as const) {
				describe(loopLabel, () => {
					for(const name of ['c', 'list', 'class', 'dim', 'any', 't', 'attach', 'source']) {
						const code = `foo <- function(l, ${name}) {
        tmp <- list()
        ${loop} tmp[[i]] <- l[[i]] %in% ${name}[[i]]
        return(tmp)
    }
x <- list(1,2,3,4)
y <- c(1,2)
bar <- foo(l=x, ${name}=y)`;
						assertSliced(label(`Using ${name} with `, ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return', loopLabel]),
							shell, code, ['8@bar'], code);
					}
				});
			}
		});
		describe('Loop iteration overwrites', () => {
			const code = 'x <- 20 : 30\nres <- 0\nfor(i in 1:10) {\n    x.y.data <- x[x > 25 + i]\n    for(j in x.y.data) res <- res + 1\n}\nprint(res)';
			assertSliced(label('Loop Re-Iterate', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return']), shell, code, ['7@print'], code);
		});
		describe('Nested dataframe assignments', () => {
			const code = 'df <- foo()\ndf$a[x > 3] <- 5\nprint(df)';
			assertSliced(label('Simple reassignment', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return']), shell, code, ['3@print'], code);
		});
	});
	describe('Closures', () => {
		assertSliced(label('closure w/ default arguments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition', 'closures', 'unnamed-arguments']),
			shell, 'f <- function(x = 1) {\n  function() x\n}\ng <- f(2)\nprint(g())', ['5@g'], 'f <- function(x=1) function() x\ng <- f(2)\ng()');
		assertSliced(label('nested closures w/ default arguments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'newlines', 'lambda-syntax', 'implicit-return', ...OperatorDatabase['+'].capabilities, 'closures', 'grouping']),
			shell, `f <- function(x = 1) {
  (\\(y = 2) function(z = 3) x + y + z)()
}
g <- f(8)
print(g())`, ['5@g'], `f <- function(x=1) (\\(y=2) function(z=3) x + y + z)()
g <- f(8)
g()`, { minRVersion: MIN_VERSION_LAMBDA });
		assertSliced(label('closure w/ side effects', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'closures', ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call', ...OperatorDatabase['+'].capabilities, 'numbers']),
			shell, 'f <- function() {\n  function() {\n    x <<- x + 1\n    x\n  }\n}\nx <- 2\nf()()\nprint(x)', ['9@x'], 'f <- function() function() x <<- x + 1\nx <- 2\nf()()\nx');
	});
	describe('Calls with potential side effects', () => {
		const mapCaps: FlowrCapabilityId[] = ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives'];
		function mapCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
			assertSliced(label(name, mapCaps), shell, code, [criterion], expected);
		}
		assertSliced(label('Changing the working directory', [
			'functions-with-global-side-effects', 'name-normal', 'strings', 'call-normal', 'unnamed-arguments', 'newlines'
		]), shell,
		'setwd("f/")\nx', ['2@x'],
		'setwd("f/")\nx'
		);
		assertSliced(label('Setting a fixed seed', [
			'functions-with-global-side-effects', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines'
		]), shell,
		'seed <- 1234\nset.seed(seed)\nx', ['3@x'],
		'x'
		);
		assertSliced(label('A draw after a fixed seed', [
			'functions-with-global-side-effects', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines'
		]), shell,
		'seed <- 1234\nset.seed(seed)\nx <- runif(1)\nx', ['4@x'],
		'seed <- 1234\nset.seed(seed)\nx <- runif(1)\nx'
		);
		const rngCaps: FlowrCapabilityId[] = ['functions-with-global-side-effects', 'name-normal', 'numbers', 'strings', 'call-normal', 'unnamed-arguments', 'newlines'];
		assertSliced(label('A seed set after the last draw is not kept', rngCaps), shell, 'set.seed(1)\nv <- runif(1)\nset.seed(2)\nv', ['4@v'], 'set.seed(1)\nv <- runif(1)\nv', { expectedOutput: '[1] 0.2655087', expectedSliceOutput: '[1] 0.2655087' });
		assertSliced(label('A generator kind with no draw after it is not kept', rngCaps), shell, 'RNGkind("Wichmann-Hill")\nu <- 3\nv <- u\nv', ['4@v'], 'u <- 3\nv <- u\nv');
		assertSliced(label('A generator kind set after the last draw is not kept', rngCaps), shell, 'set.seed(1)\nv <- runif(1)\nRNGkind("Wichmann-Hill")\nv', ['4@v'], 'set.seed(1)\nv <- runif(1)\nv');
		assertSliced(label('A local .Random.seed is not the state of the generator', [...rngCaps, 'normal-definition']), shell, 'f <- function() { .Random.seed <- c(1L, 2L); 1 }\nset.seed(1)\nf()\nv <- runif(1)\nv', ['5@v'], 'set.seed(1)\nv <- runif(1)\nv', { expectedOutput: '[1] 1\n[1] 0.2655087', expectedSliceOutput: '[1] 0.2655087' });
		assertSliced(label('A local .Random.seed does not cut a draw in the same function from the seed', [...rngCaps, 'normal-definition']), shell, 'set.seed(1)\nf <- function() { .Random.seed <- 3; runif(1) }\nv <- f()\nv', ['4@v'], 'set.seed(1)\nf <- function() runif(1)\nv <- f()\nv', { expectedOutput: '[1] 0.2655087', expectedSliceOutput: '[1] 0.2655087' });
		assertSliced(label('A data set that is not read is not loaded', rngCaps), shell, 'data("iris")\ndata("mtcars")\nv <- nrow(iris)\nv', ['4@v'], 'data("iris")\nv <- nrow(iris)\nv', { expectedOutput: '[1] 150', expectedSliceOutput: '[1] 150' });
		assertSliced(label('Configuring options', [
			'functions-with-global-side-effects', 'built-in-options', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines', 'named-arguments'
		]), shell,
		'x <- 1\noptions(y=2)\nx', ['3@x'],
		'x <- 1\nx'
		);
		assertSliced(label('Exit hooks', [
			'functions-with-global-side-effects', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines', 'named-arguments', 'implicit-return', 'function-definitions'
		]), shell,
		'x\non.exit(function() 3)', ['1@x'],
		'x\non.exit(function() 3)'
		);
		assertSliced(label('Library Loads and Installations', [
			'functions-with-global-side-effects', 'name-normal', 'strings', 'call-normal', 'unnamed-arguments', 'newlines', 'library-loading'
		]), shell,
		/* w should be included as it defined the package to be loaded by the library call */
		'v\nlibrary(x)\nrequire(y)\nw <- "x"\nattachNamespace(w)\nloadNamespace("x")', ['1@v'],
		'v\nlibrary(x)\nrequire(y)\nw <- "x"\nattachNamespace(w)\nloadNamespace("x")'
		);
		mapCase('Points Should Link to Plot', 'plot(f)\npoints(g)', '2@points', 'plot(f)\npoints(g)');
		mapCase('Custom plot should have no links', 'plot <- function() {}\nplot(f)\npoints(g)', '3@points', 'points(g)');
		describe('options', () => {
			const optionCaps: FlowrCapabilityId[] = ['functions-with-global-side-effects', 'built-in-options', 'name-normal', 'call-normal', 'named-arguments', 'newlines'];
			function optionCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, optionCaps), shell, code, [criterion], expected);
			}
			optionCase('An option does not affect unrelated values', 'options(digits=2)\ny <- 3\nz <- y', '3@z', 'y <- 3\nz <- y');
			optionCase('An option set later does not matter', 'y <- 3\noptions(digits=2)\nz <- y', '3@z', 'y <- 3\nz <- y');
			// @signature built-in-options
			optionCase('Printing reads the printing options', 'options(digits=2)\ny <- 3\nprint(y)', '3@print', 'options(digits=2)\ny <- 3\nprint(y)');
			optionCase('Cat and format read the printing options', 'options(scipen=100)\noptions(foo=1)\ncat(format(1e10))', '3@cat', 'options(scipen=100)\ncat(format(1e10))');
			optionCase('Printing a plain value ignores unrelated options', 'options(foo=2)\nprint(3)', '2@print', 'print(3)');
			optionCase('An overwritten option is dropped', 'options(digits=2)\noptions(digits=4)\nprint(1)', '3@print', 'options(digits=4)\nprint(1)');
			// @signature built-in-options
			optionCase('getOption reads the option it names', 'options(foo=2)\noptions(bar=3)\nx <- getOption("foo")', '3@x', 'options(foo=2)\nx <- getOption("foo")');
			optionCase('getOption with a default', 'options(foo=2)\noptions(bar=3)\nx <- getOption("bar", 1)', '3@x', 'options(bar=3)\nx <- getOption("bar", 1)');
			optionCase('getOption resolves the name', 'options(foo=2)\noptions(bar=3)\nk <- "bar"\nx <- getOption(k)', '4@x', 'options(bar=3)\nk <- "bar"\nx <- getOption(k)');
			optionCase('getOption with an unknown name reads all options', 'f <- function(k) getOption(k)\noptions(foo=2)\noptions(bar=3)\nx <- f(u)', '4@x', 'f <- function(k) getOption(k)\noptions(foo=2)\noptions(bar=3)\nx <- f(u)');
			optionCase('Querying with options', 'options(foo=2)\noptions(bar=3)\nx <- options("foo")', '3@x', 'options(foo=2)\nx <- options("foo")');
			optionCase('Restoring options', 'op <- options(foo=2)\noptions(op)\nx <- getOption("foo")', '3@x', 'op <- options(foo=2)\noptions(op)\nx <- getOption("foo")');
			optionCase('The old value is only read when used', 'options(foo=1)\noptions(foo=2)\nop <- options(foo=3)\nx <- op', '4@x', 'options(foo=2)\nop <- options(foo=3)\nx <- op');
			/* returning the call's value uses it, so the previous value matters */
			optionCase('The old value returned implicitly', 'options(foo=1)\ng <- function() {\n\toptions(foo=2)\n}\nop <- g()\nx <- op', '6@x', 'options(foo=1)\ng <- function() options(foo=2)\nop <- g()\nx <- op');
			optionCase('The old value returned explicitly', 'options(foo=1)\ng <- function() return(options(foo=2))\nop <- g()\nx <- op', '4@x', 'options(foo=1)\ng <- function() return(options(foo=2))\nop <- g()\nx <- op');
			optionCase('The old value as a body without braces', 'options(foo=1)\ng <- function() options(foo=2)\nop <- g()\nx <- op', '4@x', 'options(foo=1)\ng <- function() options(foo=2)\nop <- g()\nx <- op');
			optionCase('The old value as the value of a block', 'options(foo=1)\nop <- { options(foo=2) }\nx <- op', '3@x', 'options(foo=1)\nop <- { options(foo=2) }\nx <- op');
			optionCase('An uncalled function sets nothing', 'options(foo=1)\ng <- function() {\n\toptions(foo=2)\n\t1\n}\nx <- getOption("foo")', '6@x', 'options(foo=1)\nx <- getOption("foo")');
			optionCase('Setting an option in a function', 'f <- function() options(foo=1)\nf()\nx <- getOption("foo")', '3@x', 'f <- function() options(foo=1)\nf()\nx <- getOption("foo")');
			optionCase('Reading an option in a function', 'g <- function() getOption("foo")\noptions(foo=1)\noptions(bar=1)\nx <- g()', '4@x', 'g <- function() getOption("foo")\noptions(foo=1)\nx <- g()');
			optionCase('Setting and reading in nested functions', 'f <- function() options(foo=1)\nh <- function() f()\ng <- function() getOption("foo")\nh()\nx <- g()', '5@x', 'f <- function() options(foo=1)\nh <- function() f()\ng <- function() getOption("foo")\nh()\nx <- g()');
			optionCase('Conditionally setting an option', 'options(foo=1)\nif(u) options(foo=2)\nx <- getOption("foo")', '3@x', 'options(foo=1)\nif(u) options(foo=2)\nx <- getOption("foo")');
			optionCase('Options in a loop', 'for(i in 1:3) {\n\tx <- getOption("foo")\n\toptions(foo=i)\n}', '2@x', 'for(i in 1:3) {\n    x <- getOption("foo")\n    options(foo=i)\n}');
			optionCase('Setting an option between definition and call', 'options(foo=1)\ng <- function() getOption("foo")\noptions(foo=2)\nx <- g()', '4@x', 'g <- function() getOption("foo")\noptions(foo=2)\nx <- g()');
			optionCase('getOption in an anonymous function', 'options(foo=1)\nx <- sapply(1:2, function(i) getOption("foo"))', '2@x', 'options(foo=1)\nx <- sapply(1:2, function(i) getOption("foo"))');
			optionCase('Setting options in an anonymous function', 'invisible(sapply(1:2, function(i) options(foo=i)))\nx <- getOption("foo")', '2@x', 'invisible(sapply(1:2, function(i) options(foo=i)))\nx <- getOption("foo")');
			optionCase('Setting options in tryCatch', 'tryCatch(options(foo=1), error=function(e) 0)\nx <- getOption("foo")', '2@x', 'options(foo=1)\nx <- getOption("foo")');
			optionCase('Namespaced access', 'base::options(foo=1)\nx <- base::getOption("foo")', '2@x', 'base::options(foo=1)\nx <- base::getOption("foo")');
			optionCase('Calling options through do.call', 'do.call(options, list(foo=1))\nx <- getOption("foo")', '2@x', 'do.call(options, list(foo=1))\nx <- getOption("foo")');
			optionCase('Applying print', 'options(digits=3)\nx <- sapply(1:2, print)', '2@x', 'options(digits=3)\nx <- sapply(1:2, print)');
			optionCase('Printing in a user function', 'f <- function(v) print(v)\noptions(digits=3)\nf(pi)', '3@f', 'f <- function(v) print(v)\noptions(digits=3)\nf(pi)');
			optionCase('Calling a function argument', 'h <- function(g) g()\noptions(foo=1)\nx <- h(other)', '3@x', 'h <- function(g) g()\noptions(foo=1)\nx <- h(other)');
			/* functions flowR does not model may read any option: confirmed against R for summary, strwrap, and sQuote */
			optionCase('Functions we do not model read all options', 'options(digits=3)\nd <- data.frame(a=1)\ns <- summary(d)', '3@s', 'options(digits=3)\nd <- data.frame(a=1)\ns <- summary(d)');
			optionCase('strwrap reads the width', 'options(width=30)\nw <- strwrap(t)', '2@w', 'options(width=30)\nw <- strwrap(t)');
			optionCase('sQuote reads the quotes', 'options(useFancyQuotes=FALSE)\nq <- sQuote("a")', '2@q', 'options(useFancyQuotes=FALSE)\nq <- sQuote("a")');
			optionCase('Package functions read their options', 'options(ggplot2.discrete.fill="red")\ny <- ggplot(d)', '2@y', 'options(ggplot2.discrete.fill="red")\ny <- ggplot(d)');
			optionCase('Unknown functions read package options', 'options(lifecycle_verbosity="error")\nx <- foo(1)', '2@x', 'options(lifecycle_verbosity="error")\nx <- foo(1)');
			optionCase('Package options do not affect arithmetic', 'options(ggplot2.discrete.fill="red")\ny <- 3', '2@y', 'y <- 3');
			/* evaluating a captured expression runs its calls where it is evaluated */
			optionCase('Evaluating a quoted option', 'eval(quote(options(foo=1)))\nx <- getOption("foo")', '2@x', 'eval(quote(options(foo=1)))\nx <- getOption("foo")');
			optionCase('Evaluating a stored quote', 'e <- quote(options(foo=1))\neval(e)\nx <- getOption("foo")', '3@x', 'e <- quote(options(foo=1))\neval(e)\nx <- getOption("foo")');
			optionCase('A quote alone sets nothing', 'e <- quote(options(foo=1))\nx <- getOption("foo")', '2@x', 'x <- getOption("foo")');
			optionCase('evalq', 'evalq(options(foo=1))\nx <- getOption("foo")', '2@x', 'evalq(options(foo=1))\nx <- getOption("foo")');
			/* withr and rlang scope their changes (checked against R) */
			optionCase('with_options sets the options for its code', 'library(withr)\nx <- with_options(list(digits=3), getOption("digits"))', '2@x', 'library(withr)\nx <- with_options(list(digits=3), getOption("digits"))');
			optionCase('with_options restores the options', 'options(digits=5)\nlibrary(withr)\nwith_options(list(digits=3), print(pi))\nx <- getOption("digits")', '4@x', 'options(digits=5)\nx <- getOption("digits")');
			optionCase('with_options keeps what its code sets otherwise', 'library(withr)\nwith_options(list(digits=3), options(foo=1))\nx <- getOption("foo")', '3@x', 'options(foo=1)\nx <- getOption("foo")');
			optionCase('local_options ends with the function', 'library(withr)\nf <- function() {\n\tlocal_options(list(digits=3))\n\tgetOption("digits")\n}\noptions(digits=5)\nx <- f()\ny <- getOption("digits")', '8@y', 'options(digits=5)\ny <- getOption("digits")');
			optionCase('local_options within the function', 'library(withr)\nf <- function() {\n\tlocal_options(list(digits=3))\n\tgetOption("digits")\n}\nx <- f()', '6@x', 'library(withr)\nf <- function() {\n        local_options(list(digits=3))\n        getOption("digits")\n    }\nx <- f()');
			optionCase('local_options at the top level stays', 'library(withr)\nlocal_options(digits=4)\nx <- getOption("digits")', '3@x', 'library(withr)\nlocal_options(digits=4)\nx <- getOption("digits")');
			optionCase('rlang::with_options', 'library(rlang)\noptions(digits=5)\nx <- with_options(getOption("digits"), digits=2)', '3@x', 'library(rlang)\nx <- with_options(getOption("digits"), digits=2)');
			/* R prints every visible value at the top level of a script */
			optionCase('Auto-printing reads the printing options', 'options(digits=2)\nx <- pi\nx', '3@x', 'options(digits=2)\nx <- pi\nx');
			optionCase('Assignments do not print', 'options(digits=2)\nx <- pi', '2@x', 'x <- pi');
			optionCase('Invisible values do not print', 'options(digits=2)\ninvisible(pi)', '2@invisible', 'invisible(pi)');
			optionCase('Printing a plain value ignores unrelated options', 'options(foo=2)\nx <- 3\nx', '3@x', 'x <- 3\nx');
			optionCase('Printing an unknown value may read any option', 'options(foo=2)\nx <- foo()\nx', '3@x', 'options(foo=2)\nx <- foo()\nx');
			optionCase('print of an unknown value may read any option', 'options(foo=2)\nprint(d)', '2@print', 'options(foo=2)\nprint(d)');
			optionCase('Nothing prints within a function', 'f <- function() {\n\toptions(digits=2)\n\tx <- pi\n\tx\n}', '4@x', 'f <- function() {\n        x <- pi\n        x\n    }');
			optionCase('options through an alias', 'o <- options\no(k=1)\ny <- getOption("k")', '3@y', 'o <- options\no(k=1)\ny <- getOption("k")');
			optionCase('rm(list = ls()) keeps the options', 'options(k=1)\nrm(list=ls())\ny <- getOption("k")', '3@y', 'options(k=1)\ny <- getOption("k")');
			optionCase('.Options reads the option it names', 'options(k=1)\noptions(j=2)\ny <- .Options$k', '3@y', 'options(k=1)\ny <- .Options$k');
			optionCase('.Options with [[', 'options(k=1)\noptions(j=2)\ny <- .Options[["k"]]', '3@y', 'options(k=1)\ny <- .Options[["k"]]');
			optionCase('.Options as a whole', 'options(k=1)\noptions(j=2)\ny <- .Options', '3@y', 'options(k=1)\noptions(j=2)\ny <- .Options');
			optionCase('with_options with named arguments', 'options(k=1)\nlibrary(withr)\nx <- with_options(code=getOption("k"), new=list(k=2))', '3@x', 'library(withr)\nx <- with_options(code=getOption("k"), new=list(k=2))');
			optionCase('local_options at the top level replaces the option', 'options(k=1)\nlibrary(withr)\nlocal_options(.new=list(k=2))\nx <- getOption("k")', '4@x', 'library(withr)\nlocal_options(.new=list(k=2))\nx <- getOption("k")');
			/* these change how calls behave that we cannot name, so they stay in every slice */
			optionCase('Options with a global effect are kept', 'options(warn=2)\ny <- 3', '2@y', 'options(warn=2)\ny <- 3');
			optionCase('scipen changes every number to string conversion', 'options(scipen=999)\ny <- 1e5\nz <- paste(y)', '3@z', 'options(scipen=999)\ny <- 1e5\nz <- paste(y)');
			optionCase('OutDec changes as.character', 'options(OutDec=",")\nx <- as.character(1.5)', '2@x', 'options(OutDec=",")\nx <- as.character(1.5)');
			optionCase('Restoring unknown options is kept', 'options(op)\ny <- 3', '2@y', 'options(op)\ny <- 3');
		});
		describe('switch and evaluated calls', () => {
			const caps: FlowrCapabilityId[] = ['functions-with-global-side-effects', 'name-normal', 'call-normal', 'newlines'];
			function sliceCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, caps), shell, code, [criterion], expected);
			}
			/* only one arm runs, picked by the first argument */
			sliceCase('switch arms are alternatives', 'm <- "a"\nswitch(m, a = x <- 1, b = x <- 2)\ny <- x', '3@y', 'm <- "a"\nswitch(m, a = x <- 1, b = x <- 2)\ny <- x');
			/* an arm never sees what another arm defines (checked against R) */
			sliceCase('switch arms do not see each other', 'x <- 0\nm <- "b"\nswitch(m, a = x <- 1, b = y <- x)\nz <- y', '4@z', 'x <- 0\nm <- "b"\nswitch(m, a = x <- 1, b = y <- x)\nz <- y');
			sliceCase('switch may run no arm', 'x <- 0\nswitch(m, a = x <- 1)\ny <- x', '3@y', 'x <- 0\nswitch(m, a = x <- 1)\ny <- x');
			sliceCase('do.call binding a name', 'do.call("assign", list("w", 6))\nr <- w', '2@r', 'do.call("assign", list("w", 6))\nr <- w');
			/* a call in an evaluated capture reads the function it names */
			sliceCase('evalq of a call', 'f <- function() x <<- 2\nevalq(f())\ny <- x', '3@y', 'f <- function() x <<- 2\nevalq(f())\ny <- x');
			sliceCase('evalq sees the bindings of its call site', 'x <- 1\nf <- function() x\nr <- evalq(f())\nx <- 2\nprint(r)', '5@r', 'x <- 1\nf <- function() x\nr <- evalq(f())\nr');
			sliceCase('eval of a stored call', 'f <- function() x <<- 2\ne <- quote(f())\neval(e)\ny <- x', '4@y', 'f <- function() x <<- 2\ne <- quote(f())\neval(e)\ny <- x');
			sliceCase('evalq of a call setting options', 'f <- function() options(k=2)\nevalq(f())\ny <- getOption("k")', '3@y', 'f <- function() options(k=2)\nevalq(f())\ny <- getOption("k")');
		});
		describe('maps::map', () => {
			mapCase('Link to the last map', 'map(f)\nx <- points(g)', '2@points', 'map(f)\npoints(g)');
			mapCase('Link to the last map (print)', 'map(f)\nx <- points(g)\nprint(x)', '3@print', 'map(f)\nx <- points(g)\nprint(x)');
			mapCase('Link to the last map (with par)', 'par(mar=c(1,1,1,1))\nmap(f)\nx <- points(g)', '3@x', 'par(mar=c(1,1,1,1))\nmap(f)\nx <- points(g)');
			mapCase('Link to the last map (multiple map)', 'map("x")\nmap("y")\nx <- points(g)', '3@x', 'map("y")\nx <- points(g)');
			mapCase('Link to the last map (map with foo)', 'map("a", foo=c(-1))\npoints(x)', '2@points', 'map("a", foo=c(-1))\npoints(x)');
			mapCase('An added map should be included', 'map("a", add=TRUE)\npoints(x)', '2@points', 'map("a", add=TRUE)\npoints(x)');
			mapCase('A not-added map should be kept', 'map("a", add=FALSE)\npoints(x)', '2@points', 'map("a", add=FALSE)\npoints(x)');
			mapCase('Map-Add should cascade', 'map("a", add=FALSE)\nmap("b", add=TRUE)\npoints(x)', '3@points', 'map("a", add=FALSE)\nmap("b", add=TRUE)\npoints(x)');
		});
		describe('unknown assigns', () => {
			const assignCaps: FlowrCapabilityId[] = ['functions-with-global-side-effects', 'name-normal', 'call-normal'];
			function assignCase(name: string, code: string, expected: string) {
				assertSliced(label(name, assignCaps), shell, code, ['2@x'], expected);
			}
			assignCase('Same assign target', 'assign("x", 3)\nprint(x)', 'assign("x", 3)\nx');
			assignCase('Different assign target', 'assign("y", 3)\nprint(x)', 'x');
			/* as we do not know the target of `y`/`x`, we mark as unknown */
			assignCase('Variable assign target (different)', 'assign(y, 3)\nprint(x)', 'assign(y, 3)\nx');
			assignCase('Variable assign target (same)', 'assign(x, 3)\nprint(x)', 'assign(x, 3)\nx');
		});
	});
	describe('Array Overwriting Loops', () => {
		assertSliced(label('Overwrite in For-Loop', [
			'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'for-loop', 'newlines', 'unnamed-arguments', 'call-normal',
			'built-in-sequencing', 'double-bracket-access', 'replacement-functions', 'return', 'special-operator', 'function-definitions',
			'named-arguments'
		]), shell, `foo <- function(l,c){
\ttmp <- list()
\tfor(i in 1:length(l)){
\t\ttmp[[i]] <- l[[i]]%in%c[[i]]
\t}
\treturn(tmp)
}
bar <- foo(l=x, c=y)`, ['8@bar'], 'foo <- function(l, c) {\n        tmp <- list()\n        for(i in 1:length(l)) tmp[[i]] <- l[[i]] %in% c[[i]]\n        return(tmp)\n    }\nbar <- foo(l=x, c=y)');
	});
	describe('Include Callees', () => {
		const capabilities: FlowrCapabilityId[] = [
			'function-definitions', 'formals-named', 'name-normal', 'numbers', 'call-normal', 'newlines',
			'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities
		];
		function calleeCase(name: string, code: string, criterion: SlicingCriterion, expected: string, includeCallees?: boolean) {
			assertSliced(label(name, capabilities), shell, code, [criterion], expected, includeCallees ? { includeCallees: true } : undefined);
		}
		const code = 'f <- function(x) {\n  y <- x * 2\n  print(y)\n}\nf(21)';
		calleeCase('default stops at the function-definition boundary', code, '3@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }');
		calleeCase('includeCallees continues past the boundary', code, '3@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }\nf(21)', true);
		calleeCase('includeCallees includes all call sites', 'f <- function(x) {\n  y <- x * 2\n  print(y)\n}\nf(21)\nf(99)', '3@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }\nf(21)\nf(99)', true);
		calleeCase('includeCallees does not pull in other callers of a function the slice calls', 'f <- function(x) x + 1\nz <- f(2)\nprint(z)\nw <- f(3)', '3@print', 'f <- function(x) x + 1\nz <- f(2)\nprint(z)', true);
		calleeCase('includeCallees does not pull in unrelated code', 'g <- 3\nf <- function(x) {\n  y <- x * 2\n  print(y)\n}\nf(21)', '4@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }\nf(21)', true);
		// gate: a self-contained body (no parameter, no captured variable) must not pull in the callers
		const codeSelfContained = 'f <- function(x) {\n  y <- 5\n  print(y)\n}\nf(21)';
		calleeCase('includeCallees is a no-op when the body does not depend on the interface', codeSelfContained, '3@print', 'f <- function(x) {\n        y <- 5\n        print(y)\n    }', true);
		calleeCase('self-contained body slices identically without the flag', codeSelfContained, '3@print', 'f <- function(x) {\n        y <- 5\n        print(y)\n    }');
		// gate: a captured variable from the enclosing scope does let the callers (and the capture) in
		calleeCase('includeCallees follows a captured enclosing-scope variable', 'z <- 10\nf <- function(x) {\n  y <- z\n  print(y)\n}\nf(21)', '4@print', 'z <- 10\nf <- function(x) {\n        y <- z\n        print(y)\n    }\nf(21)', true);
	});
	describe('Super-assignment binds lexically', () => {
		const superCaps: readonly FlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['<<-'].capabilities, 'normal-definition', 'implicit-return', 'closures', 'lexicographic-scope', 'side-effects-in-function-call', 'numbers', 'newlines', 'semicolons', 'call-normal', 'unnamed-arguments'];
		function superCase(name: string, code: string, criterion: SlicingCriterion, expected: string, out: string) {
			assertSliced(label(name, superCaps), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
		}
		/* `<<-` searches the enclosing frames first, so this writes f's `x`, not the global one */
		superCase('the enclosing function frame wins over the global one', 'f <- function() { x <- 2; h <- function() x <<- 9; h(); x }\nv <- f()\nv', '3@v', 'f <- function() {\n        x <- 2\n        h <- function() x <<- 9\n        h()\n        x\n    }\nv <- f()\nv', '[1] 9');
		/* the write lands on f's `x`, so the global one is never touched and the call is irrelevant */
		superCase('a write caught by an enclosing frame leaves the global one alone', 'x <- 1\nf <- function() { x <- 2; h <- function() x <<- 9; h() }\nf()\nv <- x\nv', '5@v', 'x <- 1\nv <- x\nv', '[1] 1');
		/* control: a closure counter writes the frame it captured, so every call depends on the one before */
		superCase('a closure counter still chains its calls', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nc1 <- mk()\nc1()\nv <- c1()\nv', '5@v', 'mk <- function() {\n        n <- 0\n        function() {\n            n <<- n + 1\n            n\n        }\n    }\nc1 <- mk()\nc1()\nv <- c1()\nv', '[1] 1\n[1] 2');
		/* control: with no enclosing frame holding the name, the global one is still the target */
		superCase('a super-assignment no enclosing frame catches still reaches the global one', 'x <- 1\nf <- function() { g <- function() x <<- 42; g(); x }\nv <- f()\nv', '4@v', 'x <- 1\nf <- function() {\n        g <- function() x <<- 42\n        g()\n        x\n    }\nv <- f()\nv', '[1] 42');
		superCase('a closure calls the function its factory was handed', 'memo <- function(f) function(n) f(n)\nsq <- function(n) n^2\nm <- memo(sq)\nv <- m(4)\nv', '5@v', 'memo <- function(f) function(n) f(n)\nsq <- function(n) n ^ 2\nm <- memo(sq)\nv <- m(4)\nv', '[1] 16');
		superCase('a closure created by local chains its calls', 'counter <- local({ i <- 0; function() { i <<- i + 1; i } })\ncounter()\nv <- counter()\nv', '4@v', 'counter <- local({ i <- 0; function() { i <<- i + 1; i } })\ncounter()\nv <- counter()\nv', '[1] 1\n[1] 2');
		superCase('a closure taken out of a list in a loop chains its calls', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nL <- list(mk())\nfor(f in L) f()\nv <- L[[1]]()\nv', '5@v', 'mk <- function() {\n        n <- 0\n        function() {\n            n <<- n + 1\n            n\n        }\n    }\nL <- list(mk())\nfor(f in L) f()\nv <- (L[[1]])()\nv', '[1] 2');
		assertSliced(label('a closure taken out of a list by lapply chains its calls', superCaps), shell, 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nL <- list(mk())\ninvisible(lapply(L, function(g) g()))\nv <- L[[1]]()\nv', ['5@v'], 'mk <- function() {\n        n <- 0\n        function() {\n            n <<- n + 1\n            n\n        }\n    }\nL <- list(mk())\ninvisible(lapply(L, function(g) g()))\nv <- (L[[1]])()\nv', { expectedOutput: '[1] 2', expectedSliceOutput: /\[1\] 2$/ });
		superCase('the frame of a closure is what environment(fn) reads', 'mk <- function() { n <- 0; function() { n <<- n + 1; 0 } }\nh <- mk()\nh()\nv <- environment(h)$n\nv', '5@v', 'mk <- function() {\n        n <- 0\n        function() {\n            n <<- n + 1\n            0\n        }\n    }\nh <- mk()\nh()\nv <- environment(h)$n\nv', '[1] 0\n[1] 1');
		assertSliced(label('an exit hook reads what the body wrote before', superCaps), shell, 'lg <- character()\nf <- function() { lg <<- c(lg, "o"); on.exit(lg <<- c(lg, "c")); 1 }\nf()\nv <- lg\nv', ['5@v'], 'lg <- character()\nf <- function() {\n        lg <<- c(lg, "o")\n        on.exit(lg <<- c(lg, "c"))\n    }\nf()\nv <- lg\nv', { expectedOutput: '[1] 1\n[1] "o" "c"', expectedSliceOutput: '[1] "o" "c"' });
		assertSliced(label('a kept call keeps the globals its exit hook reads', superCaps), shell, 'lg <- character()\nf <- function(b) { on.exit(lg <<- c(lg, "c")); b }\nf(1)\nv <- 2\nv', ['5@v'], 'lg <- character()\nf <- function(b) on.exit(lg <<- c(lg, "c"))\nf(1)\nv <- 2\nv', { expectedOutput: '[1] 1\n[1] 2', expectedSliceOutput: '[1] 2' });
		superCase('a method writes the environment its factory captured', 'mk <- function() { self <- new.env(); self$v <- 0; self$inc <- function(x) self$v <- self$v + x; self }\no <- mk()\no$inc(5)\nv <- o$v\nv', '5@v', 'mk <- function() {\n        self <- new.env()\n        self$v <- 0\n        self$inc <- function(x) self$v <- self$v + x\n        self\n    }\no <- mk()\no$inc(5)\nv <- o$v\nv', '[1] 5');
		superCase('a default argument environment is written in place', 'e <- new.env()\ne$reg <- list()\nreg <- function(k, v, env = e) env$reg[[k]] <- v\nreg("a", 1)\nv <- e$reg$a\nv', '6@v', 'e <- new.env()\ne$reg <- list()\nreg <- function(k, v, env=e) env$reg[[k]] <- v\nreg("a", 1)\nv <- e$reg$a\nv', '[1] 1');
		assertSliced(label('separate factory instances do not share their state', superCaps), shell, 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\na <- mk()\nb <- mk()\nb()\nb()\nv <- a()\nv', ['7@v'], 'mk <- function() {\n        n <- 0\n        function() {\n            n <<- n + 1\n            n\n        }\n    }\na <- mk()\nv <- a()\nv', { expectedOutput: '[1] 1\n[1] 2\n[1] 1', expectedSliceOutput: '[1] 1' });
		superCase('a field of another environment is not needed', 'e1 <- new.env()\ne2 <- new.env()\ne1$v <- 1\ne2$v <- 2\nv <- e1$v\nv', '6@v', 'e1 <- new.env()\ne1$v <- 1\nv <- e1$v\nv', '[1] 1');
		superCase('an assign into another environment is not needed', 'e1 <- new.env()\ne2 <- new.env()\nassign("v", 1, envir = e1)\nassign("v", 2, envir = e2)\nv <- get("v", envir = e1)\nv', '6@v', 'e1 <- new.env()\nassign("v", 1, envir = e1)\nv <- get("v", envir = e1)\nv', '[1] 1');
	});
	describe('User-defined replacement functions', () => {
		const replCaps: readonly FlowrCapabilityId[] = ['name-quoted', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'replacement-functions', 'normal-definition', 'formals-named', 'implicit-return', 'numbers', 'newlines', 'call-normal', 'unnamed-arguments'];
		/** `code` is also the expected slice, as none of these drop anything */
		function replCase(name: string, extraCaps: FlowrCapabilityId[], code: string, criterion: SlicingCriterion, out: string) {
			assertSliced(label(name, [...replCaps, ...extraCaps]), shell, code, [criterion], code, { expectedOutput: out, expectedSliceOutput: out });
		}
		/* a replacement function rebinds its target whether or not flowR ships a built-in for it */
		replCase('a user-defined replacement rebinds its target', [], '`s<-` <- function(x, value) x + value\ny <- 1\ns(y) <- 5\nv <- y\nv', '5@v', '[1] 6');
		/* the same holds when the user redefines a replacement we do know */
		replCase('a user redefinition of a known replacement rebinds its target', [], '`levels<-` <- function(x, value) x + value\ny <- 1\nlevels(y) <- 5\nv <- y\nv', '5@v', '[1] 6');
		/* control: a built-in replacement is unaffected */
		replCase('a built-in replacement is unchanged', ['built-in-sequencing', 'single-bracket-access', 'strings'], 'x <- c(1, 2)\nnames(x) <- c("a", "b")\nv <- names(x)[1]\nv', '4@v', '[1] "a"');
		replCase('setting an attribute rebinds the object', ['user-defined', 'strings'], 'x <- 1\nattr(x, "unit") <- "cm"\nv <- attr(x, "unit")\nv', '4@v', '[1] "cm"');
		/* the super-assigning form binds outside the frame it is called in */
		assertSliced(label('a super-assigning user replacement binds outside the frame', [...replCaps, ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call']), shell, '`s<-` <- function(x, value) x + value\ny <- 1\nf <- function() { s(y) <<- 5 }\nf()\nv <- y\nv', ['6@v'], '`s<-` <- function(x, value) x + value\ny <- 1\nf <- function() s(y) <<- 5\nf()\nv <- y\nv', { expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
	});
}));

describe('Calls run in R', withShell(shell => {
	describe('Redefined primitives, environments and promises bound by name, run in R', () => {
		const name = (s: string) => decorateLabelContext(label(s, ['redefinition-of-built-in-functions-primitives']), ['dataflow']);
		const assertSliceRuns = (title: string, code: string, criterion: SlicingCriterion, lastLine: string) => assertSliceRunsInR(name(title), shell, code, criterion, lastLine);
		describe('redefined grouping', () => {
			assertSliceRuns('a redefined parenthesis', '`(` <- function(x) x * 2\ny <- (3)\nprint(y)', '3@print', '[1] 6');
			assertSliceRuns('a redefined parenthesis in a function', 'f <- function() {\n  `(` <- function(x) x + 1\n  (1)\n}\nprint(f())', '5@print', '[1] 2');
			assertSliceRuns('a redefined bracket', '`[` <- function(x, i) i\nv <- c(1, 2)\nprint(v[7])', '3@print', '[1] 7');
			assertSliceRuns('a redefined dollar', '`$` <- function(x, n) 42\nl <- list(a = 1)\nprint(l$a)', '3@print', '[1] 42');
		});
		describe('with on environments', () => {
			const assigned = 'e <- new.env()\nwith(e, x <- 5)\nx <- 1\n';
			assertSliceRuns('get in the environment', assigned + 'print(get("x", envir = e))', '4@print', '[1] 5');
			assertSliceRuns('dollar on the environment', assigned + 'print(e$x)', '4@print', '[1] 5');
			assertSliceRuns('with reading the environment', assigned + 'print(with(e, x))', '4@print', '[1] 5');
			assertSliceRuns('the global variable stays', 'x <- 1\ne <- new.env()\nwith(e, x <- 5)\nprint(x)', '4@print', '[1] 1');
			assertSliceRuns('an unknown environment', 'mk <- function() new.env()\ne <- mk()\nwith(e, x <- 5)\nprint(e$x)', '4@print', '[1] 5');
			assertSliceRuns('assign into an unknown environment', 'mk <- function() new.env()\ne <- mk()\nassign("x", 5, envir = e)\nprint(e$x)', '4@print', '[1] 5');
			assertSliceRuns('a parameter environment', 'f <- function(e) with(e, x <- 5)\ne <- new.env()\nf(e)\nprint(e$x)', '4@print', '[1] 5');
			assertSliceRuns('within on an environment', 'e <- new.env()\nlocal(x <- 5, envir = e)\nprint(e$x)', '3@print', '[1] 5');
		});
		describe('promises bound by name', () => {
			assertSliceRuns('delayedAssign reads at forcing time', 'y <- 1\ndelayedAssign("x", y * 10)\ny <- 2\nprint(x)', '4@print', '[1] 20');
			assertSliceRuns('delayedAssign side effects happen when forced', 'delayedAssign("x", {z <- 3; 4})\nz <- 1\nx\nprint(z)', '4@print', '[1] 3');
			assertSliceRuns('delayedAssign in a function', 'f <- function() {\n  delayedAssign("x", y)\n  y <- 7\n  x\n}\ny <- 1\nprint(f())', '7@print', '[1] 7');
			assertSliceRuns('delayedAssign into an environment', 'e <- new.env()\ndelayedAssign("x", 3, assign.env = e)\nx <- 1\nprint(e$x)', '4@print', '[1] 3');
			assertSliceRuns('delayedAssign evaluated in another environment', 'e <- new.env()\nassign("y", 9, envir = e)\ny <- 1\ndelayedAssign("x", y, eval.env = e)\nprint(x)', '5@print', '[1] 9');
			assertSliceRuns('delayedAssign forced through get', 'y <- 2\ndelayedAssign("x", y + 1)\nprint(get("x"))', '3@print', '[1] 3');
			assertSliceRuns('delayedAssign forced in a function', 'delayedAssign("x", {z <<- 3; 4})\nf <- function() x\nz <- 1\nf()\nprint(z)', '5@print', '[1] 3');
			assertSliceRuns('delayedAssign is forced once', 'y <- 1\ndelayedAssign("x", y)\ny <- 2\nx\ny <- 3\nprint(x)', '6@print', '[1] 2');
			assertSliceRuns('delayedAssign not forced by a call that skips it', 'y <- 1\ndelayedAssign("x", {y <<- 5; 0})\nf <- function(b) if(b) x\nf(FALSE)\nx\nprint(y)', '6@print', '[1] 5');
			assertSliceRuns('delayedAssign forced after a call wrote what it reads', 'k <- 1\ndelayedAssign("v", k + 1)\nf <- function() {\n  k <<- 9\n  v\n}\nprint(f())', '7@print', '[1] 10');
			assertSliceRuns('makeActiveBinding reads on every access', 'makeActiveBinding("x", function() y + 1, environment())\ny <- 4\nprint(x)', '3@print', '[1] 5');
		});
	});
	describe('Promises with higher-order functions, recursion and loops, run in R', () => {
		const name = (s: string) => decorateLabelContext(label(s, ['function-calls', 'formals-promises']), ['dataflow']);
		const assertSliceRuns = (title: string, code: string, criterion: SlicingCriterion, lastLine: string) => assertSliceRunsInR(name(title), shell, code, criterion, lastLine);
		function assertReaches(title: string, code: string, target: SlicingCriterion, expected: boolean) {
			test.each([shell, new TreeSitterExecutor()])(name(`${title} (%s)`), async parser => {
				assert.strictEqual(await controlReaches(parser, code, target), expected);
			});
		}
		describe('higher-order functions', () => {
			const applyF = 'apply_f <- function(f, x) f(x)\n';
			assertReaches('a promise handed through to a function that never forces it', applyF + 'g <- function(a) 1\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nh()', '5@"alive"', true);
			assertSliceRuns('the lazy callee decides the result', applyF + 'g <- function(a) 1\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nprint(h())', '7@print', '[1] "alive"');
			assertReaches('a promise handed through to a function that forces it', applyF + 'g <- function(a) a\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nh()', '5@"alive"', false);
			assertSliceRuns('the forcing callee decides the result', applyF + 'g <- function(a) a\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nprint(h())', '7@print', '[1] 5');
			assertSliceRuns('a closure handed to sapply returns from the closure only', 'h <- function() {\n  r <- sapply(1:3, function(i) if(i == 2) return("x") else i)\n  "end"\n}\nprint(h())', '5@print', '[1] "end"');
			assertReaches('a closure handed to sapply returns from the closure only', 'h <- function() {\n  r <- sapply(1:3, function(i) if(i == 2) return("x") else i)\n  "end"\n}\nh()', '3@"end"', true);
			assertSliceRuns('a closure handed to a function that calls it writes globally', 'x <- 1\ns <- function() x <<- 2\ng <- function(f) f()\ng(s)\ny <- 0\nprint(x)', '6@print', '[1] 2');
			assertSliceRuns('an anonymous closure handed to a function that calls it writes globally', 'x <- 1\ng <- function(f) f()\ng(function() x <<- 2)\nprint(x)', '4@print', '[1] 2');
			assertSliceRuns('a promise captured by a closure is forced when the closure runs', 'mk <- function(x) function() x\nh <- function() {\n  k <- mk(return(1))\n  k()\n  "end"\n}\nprint(h())', '7@print', '[1] 1');
		});
		describe('recursion (fixpoint)', () => {
			assertSliceRuns('a promise handed down until it is forced', 'f <- function(n, x) if(n > 0) f(n - 1, x) else x\nh <- function() {\n  f(3, return(1))\n  "alive"\n}\nprint(h())', '6@print', '[1] 1');
			assertSliceRuns('a promise handed down but never forced', 'rec <- function(n, a) if(n == 0) 0 else rec(n - 1, a)\nh <- function() {\n  rec(3, return(1))\n  "alive"\n}\nprint(h())', '6@print', '[1] "alive"');
			assertReaches('a promise handed down until it is forced', 'f <- function(n, x) if(n > 0) f(n - 1, x) else x\nh <- function() {\n  f(3, return(1))\n  "alive"\n}\nh()', '4@"alive"', false);
			assertReaches('a promise handed down but never forced', 'rec <- function(n, a) if(n == 0) 0 else rec(n - 1, a)\nh <- function() {\n  rec(3, return(1))\n  "alive"\n}\nh()', '4@"alive"', true);
		});
		describe('evaluation order', () => {
			assertSliceRuns('the callee forces its arguments in its own order', 'f <- function(a, b) { b; a }\nf(x <- 1, x <- 2)\nprint(x)', '3@print', '[1] 1');
			assertSliceRuns('a definition in a promise nobody forces does not happen', 'x <- 1\nf <- function(a) if(FALSE) a\nf(x <- 2)\nprint(x)', '4@print', '[1] 1');
			assertSliceRuns('a default sees the body it is forced in', 'f <- function(x = y) { y <- 2; x }\nprint(f())', '2@print', '[1] 2');
			assertSliceRuns('a jump within a default leaves the function using it', 'cond <- TRUE\nf <- function(x = return("early")) { if(cond) x; "late" }\nprint(f())', '3@print', '[1] "early"');
		});
		describe('nested calls', () => {
			const forwarding = 'outer <- function(y) inner(y)\ninner <- function(z) z\nh <- function() {\n  outer(return(1))\n  "alive"\n}\n';
			assertReaches('a promise forwarded to a function that forces it', forwarding + 'h()', '5@"alive"', false);
			assertSliceRuns('a promise forwarded to a function that forces it', forwarding + 'print(h())', '7@print', '[1] 1');
			const dropping = 'outer <- function(y) inner(y)\ninner <- function(z) 0\nh <- function() {\n  outer(return(1))\n  "alive"\n}\n';
			assertReaches('a promise forwarded to a function that drops it', dropping + 'h()', '5@"alive"', true);
			assertSliceRuns('a promise forwarded to a function that drops it', dropping + 'print(h())', '7@print', '[1] "alive"');
			const composed = 'compose <- function(f, g) function(x) f(g(x))\nid <- function(v) v\nk <- compose(id, id)\nh <- function() {\n  k(return(2))\n  "alive"\n}\n';
			assertSliceRuns('a promise handed to a composed closure', composed + 'print(h())', '8@print', '[1] 2');
			const conditional = 'w <- function(a, b) { if(a > 0) b else 0 }\nv <- function(n, q) w(n, q)\nh <- function() {\n  v(0, return("early"))\n  "late"\n}\n';
			assertReaches('a promise forwarded to a function forcing it only on one branch', conditional + 'h()', '5@"late"', true);
			assertSliceRuns('a promise forwarded to a function forcing it only on one branch', conditional + 'print(h())', '7@print', '[1] "late"');
			assertSliceRuns('a definition forwarded to a function that drops it', 'x <- 1\no <- function(a) i(a)\ni <- function(b) if(FALSE) b\no(x <- 2)\nprint(x)', '5@print', '[1] 1');
			assertSliceRuns('a definition forwarded to a function that forces it', 'x <- 1\no <- function(a) i(a)\ni <- function(b) b\no(x <- 2)\nprint(x)', '5@print', '[1] 2');
			assertSliceRuns('a nested call reads what its own global write replaces', 'counter <- 0\ninc <- function() counter <<- counter + 1\nf <- function() inc()\nf()\nprint(counter)', '5@print', '[1] 1');
			assertSliceRuns('a nested call made on some paths only writes maybe', 'counter <- 0\ninc <- function() counter <<- 5\nf <- function(n) if(n > 0) inc()\nf(0)\nprint(counter)', '5@print', '[1] 0');
			assertSliceRuns('draws within nested calls advance the state', 'set.seed(1)\nf <- function() g()\ng <- function() runif(1)\nf()\nr <- runif(1)\nprint(r)', '6@print', '[1] 0.3721239');
		});
		describe('rewriting a closure handed in', () => {
			/* `body<-` on the global binding changes what the promise `f` already refers to, as it is the same closure */
			assertSliceRuns('a body rewritten through the global binding changes the handed-in closure', 'adder <- function(n) function(x) x + n; add1 <- adder(1)\ntwice <- function(f, x) {\n  body(add1) <<- quote(x - n)\n  y <- f(f(x))\n  paste(deparse(body(f)), "=", y)\n}\nprint(twice(add1, 5))', '7@print', '[1] "x - n = 3"');
		});
		describe('the random number generator', () => {
			assertSliceRuns('draws within a higher-order function advance the state', 'set.seed(1)\nxs <- sapply(1:3, function(i) runif(1))\nr <- runif(1)\nprint(r)', '4@print', '[1] 0.9082078');
			assertSliceRuns('draws within evaluated code advance the state', 'set.seed(1)\ne <- quote(runif(1))\neval(e)\nr <- runif(1)\nprint(r)', '5@print', '[1] 0.3721239');
			assertSliceRuns('draws within a loop advance the state', 'set.seed(1)\nf <- function() runif(1)\nfor(i in 1:2) f()\nr <- runif(1)\nprint(r)', '5@print', '[1] 0.5728534');
		});
	});
	describe('Ambient state through every way of calling a function, run in R', () => {
		const name = (s: string) => decorateLabelContext(label(s, ['function-calls', 'side-effects-in-function-call']), ['dataflow', 'slice']);
		const assertSliceRuns = (title: string, code: string, lastLine: string, config?: Partial<TestConfiguration>) => assertSliceRunsInR(name(title), shell, code, `${code.split('\n').length}@print`, lastLine, config);
		describe('random numbers', () => {
			const rng = (title: string, body: string, expected: string) => assertSliceRuns(title, `set.seed(1)\n${body}\nr <- runif(1)\nprint(r)`, expected);
			const one = '[1] 0.3721239';
			const two = '[1] 0.5728534';
			describe('user functions', () => {
				rng('a direct call', 'f <- function() runif(1)\nf()', one);
				rng('a nested call', 'g <- function() runif(1)\nf <- function() g()\nf()', one);
				rng('a nested call defined later', 'f <- function() g()\ng <- function() runif(1)\nf()', one);
				rng('a recursive call', 'f <- function(n) if(n > 0) { runif(1); f(n - 1) }\nf(2)', two);
				rng('mutually recursive calls', 'a <- function(n) if(n > 0) b(n - 1)\nb <- function(n) { runif(1); a(n) }\na(2)', two);
				rng('a call on a true condition', 'f <- function() runif(1)\nc <- TRUE\nif(c) f()', one);
				rng('a call on a false condition', 'f <- function() runif(1)\nc <- FALSE\nif(c) f()', '[1] 0.2655087');
				rng('a call in a for loop', 'f <- function() runif(1)\nfor(i in 1:2) f()', two);
				rng('a call in a while loop', 'f <- function() runif(1)\ni <- 0\nwhile(i < 2) { f(); i <- i + 1 }', two);
				rng('a draw on the taken path of the callee', 'f <- function(n) if(n > 1) runif(1)\nf(2)', one);
				rng('a draw on the path the callee does not take', 'f <- function(n) if(n > 1) runif(1)\nf(0)', '[1] 0.2655087');
				rng('a reseed within a call', 'f <- function() set.seed(42)\nf()', '[1] 0.914806');
				rng('a draw whose result is assigned', 'f <- function() runif(1)\nx <- f()', one);
				rng('a draw in a loop within the callee', 'f <- function() for(i in 1) runif(1)\nf()', one);
				rng('a seed restored through .Random.seed', 's <- .Random.seed\nrunif(1)\nf <- function() assign(".Random.seed", s, envir = globalenv())\nf()', '[1] 0.2655087');
				rng('a seed restored through a super-assignment', 's <- .Random.seed\nrunif(1)\nf <- function() .Random.seed <<- s\nf()', '[1] 0.2655087');
			});
			describe('higher-order functions', () => {
				const g = 'g <- function(f) f(1)\n';
				rng('a built-in handed to a user function', g + 'g(runif)', one);
				rng('a built-in handed down twice', g + 'k <- function(f) g(f)\nk(runif)', one);
				rng('a sampler handed to a user function', 'g <- function(f) f(10)\ng(sample)', '[1] 0.2059746');
				rng('an anonymous closure handed to a user function', g + 'g(function(n) runif(n))', one);
				rng('a named closure handed to a user function', g + 'h <- function(n) runif(n)\ng(h)', one);
				rng('a closure handed down twice', g + 'k <- function(f) g(f)\nk(function(n) runif(n))', one);
				rng('a reseeding closure handed to a user function', 'g <- function(f) f()\ng(function() set.seed(42))', '[1] 0.914806');
				rng('a draw after the callback within the caller', 'g <- function(f) { f(1); runif(1) }\ng(runif)', two);
				rng('a closure from a factory', 'mk <- function() function() runif(1)\nk <- mk()\nk()', one);
				rng('a closure in a list', 'l <- list(f = function() runif(1))\nl$f()', one);
				rng('a closure in a list by index', 'l <- list(function() runif(1))\nl[[1]]()', one);
				rng('a built-in stored in a variable', 'h <- runif\nh(1)', one);
				rng('lapply', 'x <- lapply(1:2, function(i) runif(1))', two);
				rng('sapply with a built-in', 'x <- sapply(1:2, runif)', '[1] 0.9082078');
				rng('vapply', 'x <- vapply(1:2, function(i) runif(1), numeric(1))', two);
				rng('Map', 'x <- Map(function(i) runif(1), 1:2)', two);
				rng('mapply', 'x <- mapply(function(i) runif(1), 1:2)', two);
				rng('Filter', 'x <- Filter(function(i) runif(1) > 0.5, 1:2)', two);
				rng('Reduce', 'x <- Reduce(function(a, b) a + runif(1), 1:3)', two);
				rng('do.call with a built-in', 'x <- do.call(runif, list(2))', two);
				rng('do.call with a name', 'x <- do.call("runif", list(2))', two);
				rng('do.call with a closure', 'x <- do.call(function(n) runif(n), list(2))', two);
				rng('lapply reseeding', 'x <- lapply(1, function(i) set.seed(42))', '[1] 0.914806');
				rng('purrr::map', 'x <- purrr::map(1:2, function(i) runif(1))', two);
				rng('Map with a built-in', 'x <- Map(runif, 1:2)', '[1] 0.9082078');
				rng('mapply with a built-in', 'x <- mapply(runif, 1:2)', '[1] 0.9082078');
				rng('a user function handed to sapply', g + 'x <- sapply(1:2, function(i) g(runif))', two);
				rng('do.call of a user function', g + 'x <- do.call(g, list(runif))', one);
				rng('a higher-order call within a function', g + 'w <- function() g(runif)\nw()', one);
				rng('a higher-order call in a loop', g + 'for(i in 1:2) g(runif)', two);
				rng('a higher-order call on a condition', g + 'c <- TRUE\nif(c) g(runif)', one);
				rng('a higher-order call within local', g + 'local(g(runif))', one);
				rng('a recursive higher-order call', 'g <- function(f, n) if(n > 0) { f(1); g(f, n - 1) }\ng(runif, 2)', two);
				rng('a promise within a handed closure', g + 'h <- function(x) x\ng(function(n) h(runif(n)))', one);
				rng('a callback seeding before a draw of the caller', 'g <- function(f) { f(); runif(1) }\nx <- g(function() set.seed(42))', '[1] 0.9370754');
				assertSliceRuns('a draw in a function called after a higher-order call', 'set.seed(1)\ng <- function(f) f(1)\ng(runif)\nk <- function() runif(1)\nr <- k()\nprint(r)', one);
				assertSliceRuns('the value of a higher-order call', 'set.seed(1)\ng <- function(f) { f(1); runif(1) }\nprint(g(runif))', one);
			});
			describe('promises', () => {
				rng('a draw forced by the callee', 'h <- function(x) x\nh(runif(1))', one);
				rng('a draw the callee never forces', 'h <- function(x) 1\nh(runif(1))', '[1] 0.2655087');
				rng('a draw forced twice', 'h <- function(x) { x; x }\nh(runif(1))', one);
				rng('a draw forced within a nested callee', 'i <- function(y) y\nh <- function(x) i(x)\nh(runif(1))', one);
				rng('a default forced', 'f <- function(x = runif(1)) x\nf()', one);
				rng('a default never forced', 'f <- function(x = runif(1)) 1\nf()', '[1] 0.2655087');
				rng('a draw handed to a user function that forces it later', 'h <- function(x) { y <- 1; x + y }\nh(runif(1))', one);
			});
			describe('evaluation contexts', () => {
				rng('local', 'local(runif(1))', one);
				rng('a call within local', 'local({ f <- function() runif(1); f() })', one);
				rng('eval of a quote', 'eval(quote(runif(1)))', one);
				rng('eval of a stored quote', 'e <- quote(runif(1))\neval(e)', one);
				rng('tryCatch code', 'tryCatch(runif(1), error = function(e) 0)', one);
				rng('tryCatch handler', 'tryCatch(stop("x"), error = function(e) runif(1))', one);
				rng('tryCatch finally', 'tryCatch(1, finally = runif(1))', one);
				rng('on.exit', 'f <- function() { on.exit(runif(1)); 1 }\nf()', one);
				rng('withr::with_seed restores the generator', 'withr::with_seed(42, runif(1))', '[1] 0.2655087');
			});
			describe('the state of the generator', () => {
				assertSliceRuns('reading .Random.seed', 'set.seed(1)\nprint(.Random.seed[3])', '[1] -169270483');
				assertSliceRuns('restoring a saved .Random.seed', 'set.seed(1)\ns <- .Random.seed\nx <- runif(1)\n.Random.seed <- s\nprint(runif(1))', '[1] 0.2655087');
				assertSliceRuns('RNGkind before a seed', 'RNGkind("Wichmann-Hill")\nset.seed(1)\nprint(runif(1))', '[1] 0.1297134');
				assertSliceRuns('the kind set.seed sets persists', 'set.seed(1, kind = "Wichmann-Hill")\nx <- runif(1)\nset.seed(1)\nprint(runif(1))', '[1] 0.1297134');
			});
		});
		describe('options', () => {
			const digits = (title: string, body: string, expected = '[1] 3.14') => assertSliceRuns(title, `${body}\nprint(pi)`, expected);
			const set = 'function() options(digits = 3)';
			digits('a direct call', `f <- ${set}\nf()`);
			digits('a nested call', `f <- ${set}\nk <- function() f()\nk()`);
			digits('a recursive call', 'f <- function(n) if(n > 0) f(n - 1) else options(digits = 3)\nf(2)');
			digits('a call on a condition', `f <- ${set}\nc <- TRUE\nif(c) f()`);
			digits('a call in a loop', `f <- ${set}\nfor(i in 1:2) f()`);
			digits('a call on the path not taken', 'f <- function(n) if(n > 1) options(digits = 3)\nf(0)', '[1] 3.141593');
			digits('a closure handed to a user function', `g <- function(f) f()\ng(${set})`);
			digits('a named closure handed to a user function', `g <- function(f) f()\nh <- ${set}\ng(h)`);
			digits('options handed to a user function', 'g <- function(f, ...) f(...)\ng(options, digits = 3)');
			digits('lapply', 'x <- lapply(1, function(i) options(digits = 3))');
			digits('do.call', 'do.call(options, list(digits = 3))');
			digits('a closure from a factory', `mk <- function() ${set}\nk <- mk()\nk()`);
			digits('a promise forced by the callee', 'h <- function(x) x\nh(options(digits = 3))');
			digits('a promise the callee never forces', 'h <- function(x) 1\nh(options(digits = 3))', '[1] 3.141593');
			digits('local', 'local(options(digits = 3))');
			digits('withr::local_options in a function', 'f <- function() withr::local_options(digits = 3)\nf()', '[1] 3.141593');
			digits('tryCatch', 'tryCatch(options(digits = 3), error = function(e) 0)');
			digits('a higher-order call within a function', `g <- function(f) f()\nw <- function() g(${set})\nw()`);
			digits('a higher-order call on a condition', `g <- function(f) f()\nc <- TRUE\nif(c) g(${set})`);
			digits('a closure handed down twice', `g <- function(f) f()\nk <- function(f) g(f)\nk(${set})`);
			digits('options handed to sapply', 'x <- sapply(1, function(i) options(digits = 3))');
			assertSliceRuns('printing in a function called after a higher-order call', `g <- function(f) f()\ng(${set})\nk <- function() format(pi)\nprint(k())`, '[1] "3.14"');
			assertSliceRuns('getOption after a closure handed to a user function', 'g <- function(f) f()\ng(function() options(myopt = 5))\nprint(getOption("myopt"))', '[1] 5');
			const warns = 'r <- tryCatch({ warning("w"); "no" }, error = function(e) "error")\nprint(r)';
			assertSliceRuns('warn set in a called function', `f <- function() options(warn = 2)\nf()\n${warns}`, '[1] "error"');
			assertSliceRuns('warn set in a closure handed to a user function', `g <- function(f) f()\ng(function() options(warn = 2))\n${warns}`, '[1] "error"');
			assertSliceRuns('warn set in lapply', `x <- lapply(1, function(i) options(warn = 2))\n${warns}`, '[1] "error"');
			assertSliceRuns('warn set by options handed to a user function', `g <- function(f, ...) f(...)\ng(options, warn = 2)\n${warns}`, '[1] "error"');
			assertSliceRuns('warn set before a warning within a function', 'g <- function(f) f()\ng(function() options(warn = 2))\nk <- function() tryCatch({ warning("w"); "no" }, error = function(e) "error")\nprint(k())', '[1] "error"');
			assertSliceRuns('warn kept below two', `f <- function() options(warn = 1)\nf()\n${warns}`, '[1] "no"');
		});
		assertSliceRuns('a super-assignment in a closure handed down twice', 'x <- 1\ng <- function(f) f()\nk <- function(f) g(f)\nk(function() x <<- 2)\nprint(x)', '[1] 2');
		describe('files', () => {
			const file = (title: string, body: string, expected: string) => assertSliceRuns(title, `p <- tempfile()\n${body}`, expected);
			file('a connection written and closed', 'con <- file(p, "w")\nwriteLines("c", con)\nclose(con)\nprint(readLines(p))', '[1] "c"');
			file('a connection appended to', 'writeLines("x", p)\ncon <- file(p, "a")\nwriteLines("y", con)\nclose(con)\nprint(readLines(p)[2])', '[1] "y"');
			file('a connection flushed', 'con <- file(p, "w")\nwriteLines("y", con)\nflush(con)\nprint(readLines(p))', '[1] "y"');
			file('a sink to a connection', 'zz <- file(p, "w")\nsink(zz)\ncat("s\\n")\nsink()\nclose(zz)\nprint(readLines(p))', '[1] "s"');
			file('capture.output to a file', 'capture.output(print(5), file = p)\nprint(readLines(p))', '[1] "[1] 5"');
			file('dput and dget', 'dput(3, file = p)\nprint(dget(p))', '[1] 3');
			file('file.size', 'writeLines("abc", p)\nprint(file.size(p))', '[1] 4');
			file('a file sourced after a call wrote it', 'f <- function() writeLines("zz <- 3", p)\nf()\nsource(p)\nprint(zz)', '[1] 3');
			file('cat appending in a function', 'cat("a\\n", file = p)\nw <- function(s) cat(s, "\\n", file = p, append = TRUE)\nw("b")\nprint(length(readLines(p)))', '[1] 2');
		});
		describe('graphics', () => {
			const mar = (title: string, body: string, expected = '[1] 1 1 1 1', config?: Partial<TestConfiguration>) => assertSliceRuns(title, `${body}\nprint(par("mar"))`, expected, config);
			const paletteNames = { minRVersion: '4.0.0' };
			const set = 'function() par(mar = c(1, 1, 1, 1))';
			mar('a direct call', `f <- ${set}\nf()`);
			mar('a nested call', `f <- ${set}\nk <- function() f()\nk()`);
			mar('a call in a loop', `f <- ${set}\nfor(i in 1:2) f()`);
			mar('a closure handed to a user function', `g <- function(f) f()\ng(${set})`);
			mar('par handed to a user function', 'g <- function(f, ...) f(...)\ng(par, mar = c(1, 1, 1, 1))');
			mar('lapply', 'x <- lapply(1, function(i) par(mar = c(1, 1, 1, 1)))');
			mar('a promise forced by the callee', 'h <- function(x) x\nh(par(mar = c(1, 1, 1, 1)))');
			mar('a plot after the call', `f <- ${set}\nf()\nplot(1)`);
			mar('a higher-order call within a function', `g <- function(f) f()\nw <- function() g(${set})\nw()`);
			mar('do.call with par', 'do.call(par, list(mar = c(1, 1, 1, 1)))');
			mar('palette handed to a user function does not touch the parameters', 'g <- function(f, ...) f(...)\ng(palette, "R3")', '[1] 5.1 4.1 4.1 2.1', paletteNames);
			assertSliceRuns('palette handed to a user function', 'g <- function(f, ...) f(...)\ng(palette, "R3")\nprint(palette()[2])', '[1] "red"', paletteNames);
			assertSliceRuns('palette set in a closure handed to a user function', 'g <- function(f) f()\ng(function() palette("R3"))\nprint(palette()[2])', '[1] "red"', paletteNames);
		});
	});
}));

describe('Calls checked against R', withTreeSitter(parser => {
	const check = (cases: readonly (readonly [string, string, string?])[]) => {
		for(const [name, code, absent] of cases) {
			assertSliceMatchesR(parser, name, code, { absent });
		}
	};
	describe('soundness of slices', () => check([
		['R5 only', 'Counter <- function() { self <- environment(); n <- 0; inc <- function() n <<- n + 1; self }\nc1 <- Counter()\nc1$inc()\nprint(c1$n)'],
		['local env', 'x <- 1\nlocal({ x <<- 2 })\nprint(x)'],
		['closure in list', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nfs <- list(mk(), mk())\nfs[[1]]()\nr <- fs[[1]]()\nprint(r)'],
		['Reduce closure', 'acc <- 0\nReduce(function(a, b) { acc <<- acc + b; a + b }, 1:3)\nprint(acc)'],
		['on.exit', 'x <- 1\nf <- function() { on.exit(x <<- 5); 2 }\nf()\nprint(x)'],
		['repeat break promise', 'f <- function(a) { repeat { if(a > 0) break }; 3 }\nx <- 0\nr <- f(x <- 1)\nprint(x)'],
		['recursion global', 'cnt <- 0\nf <- function(n) { cnt <<- cnt + 1; if(n > 0) f(n - 1) }\nf(3)\nprint(cnt)'],
		['assign dynamic', 'nm <- paste0("v", 1)\nassign(nm, 42)\nprint(v1)'],
		['get dynamic', 'v2 <- 7\nnm <- "v2"\nprint(get(nm))'],
		['environment(fn)$var', 'mk <- function() { s <- 1; function() s }\nf <- mk()\nenvironment(f)$s <- 9\nprint(f())'],
		['replacement user fn', '`second<-` <- function(x, value) { x[2] <- value; x }\nv <- c(1, 2, 3)\nsecond(v) <- 10\nprint(v)'],
		['names<-', 'v <- 1:2\nnames(v) <- c("a", "b")\nprint(names(v))'],
		['attr<-', 'v <- 1\nattr(v, "u") <- "m"\nprint(attr(v, "u"))'],
		['switch fallthrough', 'k <- "b"\nr <- switch(k, a = , b = 2, 3)\nprint(r)'],
		['do.call list args', 'f <- function(a, b) a - b\nargs <- list(b = 1, a = 5)\nprint(do.call(f, args))'],
		['Map closure global', 'tot <- 0\nMap(function(x, y) tot <<- tot + x * y, 1:2, 3:4)\nprint(tot)'],
		['vapply side effect', 'cnt <- 0\nvapply(1:3, function(i) { cnt <<- cnt + i; 0 }, numeric(1))\nprint(cnt)'],
		['tryCatch finally', 'x <- 1\ntryCatch(stop("e"), error = function(e) x <<- 2, finally = x <<- x * 10)\nprint(x)'],
		['Recall', 'f <- function(n) if(n <= 1) 1 else n * Recall(n - 1)\nprint(f(4))'],
		['sys.function', 'f <- function(n) if(n <= 1) 1 else n * sys.function()(n - 1)\nprint(f(4))'],
		['eval in env', 'e <- new.env()\neval(quote(z <- 3), e)\nprint(e$z)'],
		['evalq local', 'z <- 1\nevalq(z <- 4, globalenv())\nprint(z)'],
		['lazy default uses later local', 'f <- function(a = b) { b <- 5; a }\nprint(f())'],
		['promise forced once', 'cnt <- 0\nf <- function(x) { x; x; x }\nf({ cnt <<- cnt + 1 })\nprint(cnt)'],
		['missing arg', 'f <- function(a) if(missing(a)) "none" else a\nprint(f())'],
		['ellipsis forward', 'g <- function(...) h(...)\nh <- function(a, b) a * b\nprint(g(b = 3, a = 2))'],
		['nargs', 'f <- function(...) nargs()\nprint(f(1, 2, 3))'],
		['match.arg', 'f <- function(t = c("x", "y")) match.arg(t)\nprint(f())'],
		['seed in tryCatch', 'tryCatch(set.seed(2), error = function(e) NULL)\nprint(runif(1))'],
		['options restore', 'op <- options(digits = 3)\noptions(op)\nprint(pi)'],
		['global via assign envir', 'f <- function() assign("g1", 8, envir = globalenv())\nf()\nprint(g1)'],
		['sapply closure draws', 'set.seed(4)\ninvisible(sapply(1:2, function(i) runif(1)))\nprint(runif(1))'],
		['conditional seed in fn', 'f <- function(s) if(s) set.seed(1)\nf(TRUE)\nprint(runif(1))'],
		['while counter', 'i <- 0\nwhile(i < 3) i <- i + 1\nprint(i)'],
		['for over list modify', 'l <- list(1, 2)\nfor(j in seq_along(l)) l[[j]] <- l[[j]] * 2\nprint(l[[2]])'],
		['S3 NextMethod', 'print.a <- function(x, ...) { cat("a "); NextMethod() }\nprint.b <- function(x, ...) cat("b\\n")\nobj <- structure(1, class = c("a", "b"))\nprint(obj)'],
		['R5 like env obj', 'Counter <- function() { self <- environment(); n <- 0; inc <- function() n <<- n + 1; self }\nc1 <- Counter()\nc1$inc()\nprint(c1$n)'],
	]));
	describe('ambient state', () => check([
		['reading .Random.seed', 'set.seed(1)\nprint(.Random.seed[3])'],
		['exists .Random.seed after a draw', 'x <- runif(1)\nprint(exists(".Random.seed"))'],
		['restoring a saved .Random.seed', 'set.seed(1)\ns <- .Random.seed\nx <- runif(1)\n.Random.seed <- s\nprint(runif(1))'],
		['restoring a saved .Random.seed via assign', 'set.seed(1)\ns <- .Random.seed\nx <- runif(1)\nassign(".Random.seed", s, envir = globalenv())\nprint(runif(1))'],
		['RNGkind', 'RNGkind("Wichmann-Hill")\nset.seed(1)\nprint(runif(1))'],
		['RNGkind sample.kind', 'RNGkind(sample.kind = "Rounding")\nset.seed(1)\nprint(sample(10, 1))'],
		['set.seed kind persists', 'set.seed(1, kind = "Marsaglia-Multicarry")\nx <- runif(1)\nset.seed(1)\nprint(runif(1))'],
		['Vectorize', 'set.seed(1)\ng <- Vectorize(runif)\ng(1)\nprint(runif(1))'],
		['Vectorize of a function without effects', 'set.seed(1)\ng <- Vectorize(function(x) x + 1)\ng(1)\nprint(runif(1))', 'g(1)'],
		['Negate', 'set.seed(1)\ng <- Negate(function(x) runif(1) > 2)\ng(1)\nprint(runif(1))'],
		['Negate of a built-in without effects', 'set.seed(1)\ng <- Negate(is.null)\ng(1)\nprint(runif(1))', 'g(1)'],
		['factory over a built-in parameter', 'set.seed(1)\nmk <- function(f) function() f(1)\nh <- mk(runif)\nh()\nprint(runif(1))'],
		['factory over a built-in without effects', 'set.seed(1)\nmk <- function(f) function() f(1)\nh <- mk(sqrt)\nh()\nprint(runif(1))', 'h()'],
		['factory over a closure parameter', 'set.seed(1)\nmk <- function(f) function() f()\nh <- mk(function() runif(1))\nh()\nprint(runif(1))'],
		['factory over options', 'mk <- function(f) function() f(digits = 3)\nh <- mk(options)\nh()\nprint(pi)'],
		['factory over writeLines', 'p <- tempfile()\nmk <- function(f) function() f("w", p)\nh <- mk(writeLines)\nh()\nprint(readLines(p))'],
		['factory over a built-in writing no file', 'p <- tempfile()\nwriteLines("a", p)\nmk <- function(f) function() f("w")\nh <- mk(nchar)\nh()\nprint(readLines(p))', 'h()'],
		['withr::local_seed in a function', 'f <- function() { withr::local_seed(3); runif(1) }\nset.seed(1)\nf()\nprint(runif(1))'],
		['delayedAssign draw', 'set.seed(1)\ndelayedAssign("dd", runif(1))\ndd\nprint(runif(1))'],
		['delayedAssign never forced', 'set.seed(1)\ndelayedAssign("dd", runif(1))\nee <- 2\nee\nprint(runif(1))', 'delayedAssign'],
		['delayedAssign options', 'delayedAssign("dd", options(digits = 3))\ndd\nprint(pi)'],
		['delayedAssign options never forced', 'delayedAssign("dd", options(digits = 3))\nprint(pi)', 'delayedAssign'],
		['body<-', 'set.seed(1)\nf <- function() 1\nbody(f) <- quote(runif(1))\nf()\nprint(runif(1))'],
		['S3 method draws', 'set.seed(1)\nfoo <- function(x) UseMethod("foo")\nfoo.default <- function(x) runif(1)\nfoo(1)\nprint(runif(1))'],
		['S3 method sets options', 'foo <- function(x) UseMethod("foo")\nfoo.default <- function(x) options(digits = 3)\nfoo(1)\nprint(pi)'],
		['auto-printing method draws', 'set.seed(1)\nprint.zz <- function(x, ...) { runif(1); invisible(x) }\nx <- structure(1, class = "zz")\nx\nprint(runif(1))'],
		['finalizer draws', 'set.seed(1)\ne <- new.env()\nreg.finalizer(e, function(e) runif(1))\nrm(e)\ninvisible(gc())\nprint(runif(1))'],
		['finalizer never registered', 'set.seed(1)\ne <- new.env()\nf <- function(e) runif(1)\nrm(e)\ninvisible(gc())\nprint(runif(1))', 'gc'],
		['writeLines to a connection then close', 'p <- tempfile()\ncon <- file(p, "w")\nwriteLines("c", con)\nclose(con)\nprint(readLines(p))'],
		['append connection', 'p <- tempfile()\nwriteLines("x", p)\ncon <- file(p, "a")\nwriteLines("y", con)\nclose(con)\nprint(readLines(p)[2])'],
		['flush connection', 'p <- tempfile()\ncon <- file(p, "w")\nwriteLines("y", con)\nflush(con)\nprint(readLines(p))'],
		['sink to a connection', 'p <- tempfile()\nzz <- file(p, "w")\nsink(zz)\ncat("s\\n")\nsink()\nclose(zz)\nprint(readLines(p))'],
		['capture.output to a file', 'p <- tempfile()\ncapture.output(print(5), file = p)\nprint(readLines(p))'],
		['dput dget', 'p <- tempfile()\ndput(3, file = p)\nprint(dget(p))'],
		['file.exists after a write', 'p <- file.path(tempdir(), "e.txt")\nwriteLines("x", p)\nprint(file.exists(p))'],
		['file.size after a write', 'p <- tempfile()\nwriteLines("abc", p)\nprint(file.size(p))'],
		['file.info after a write', 'p <- tempfile()\nwriteLines("abc", p)\nprint(file.info(p)$size)'],
		['source of a file written in a function', 'p <- tempfile()\nf <- function() writeLines("zz <- 3", p)\nf()\nsource(p)\nprint(zz)'],
		['warn 2 aborts an assignment in try', 'options(warn = 2)\nx <- 1\ntry(x <- as.numeric("a"), silent = TRUE)\nprint(x)'],
		['warn 2 aborts a loop in try', 'options(warn = 2)\nn <- 0\ntry(for(i in 1:3) { n <- n + 1; log(-1) }, silent = TRUE)\nprint(n)'],
		['warn 2 aborts a super-assignment', 'options(warn = 2)\nx <- 1\nf <- function() { log(-1); x <<- 2 }\ntry(f(), silent = TRUE)\nprint(x)'],
		['warn 2 set in a function aborts', 'x <- 1\nf <- function() options(warn = 2)\nf()\ntry({ log(-1); x <- 5 }, silent = TRUE)\nprint(x)'],
		['stop in a called function aborts try', 'x <- 1\nf <- function() stop("s")\ntry({ f(); x <- 2 }, silent = TRUE)\nprint(x)'],
	]));
	describe('realistic scripts', () => check([
		['seed lost: rng in loop in fn', 'set.seed(1)\nf <- function() { for(i in 1) y <- runif(1); 0 }\nf()\nprint(runif(1))'],
		['seed lost: realistic markov chain', 'states <- c("sunny", "cloudy", "rainy")\nP <- matrix(c(0.7, 0.2, 0.1,\n              0.3, 0.4, 0.3,\n              0.2, 0.3, 0.5), nrow = 3, byrow = TRUE, dimnames = list(states, states))\nsimulate_chain <- function(P, start, n_steps) {\n  path <- character(n_steps)\n  path[1] <- start\n  for (t in 2:n_steps) {\n    path[t] <- sample(colnames(P), 1, prob = P[path[t - 1], ])\n  }\n  path\n}\nset.seed(123)\nchain <- simulate_chain(P, "sunny", 200)\ncat("@@", capture.output(print(table(chain))), sep = "\\n")'],
		['kept call misses its global read', 'lg <- character()\nf <- function(b) { on.exit(lg <<- c(lg, "c")); b }\nf(1)\nprint(2)'],
		['kept call misses its global read: realistic', 'attempts <- 0\nflaky <- function(fail_until = 3) {\n  attempts <<- attempts + 1\n  if (attempts < fail_until) stop("transient failure ", attempts)\n  "ok"\n}\nretry <- function(f, times = 5, ...) {\n  last_err <- NULL\n  for (i in seq_len(times)) {\n    res <- tryCatch(f(...), error = function(e) { last_err <<- e; NULL })\n    if (!is.null(res)) return(list(value = res, tries = i))\n  }\n  stop(last_err)\n}\nr1 <- retry(flaky)\ncleanup_log <- character()\nwith_resource <- function(name, body) {\n  cleanup_log <<- c(cleanup_log, paste("open", name))\n  on.exit(cleanup_log <<- c(cleanup_log, paste("close", name)), add = TRUE)\n  body\n}\nv1 <- with_resource("db", 42)\nv2 <- tryCatch(with_resource("file", stop("boom")), error = function(e) -1)\ncat("@@", capture.output(print(v2)), sep = "\\n")'],
		['cat append in fn', 'tf <- tempfile()\ncat("a\\n", file = tf)\nw <- function(s) cat(s, "\\n", file = tf, append = TRUE)\nw("b")\nprint(length(readLines(tf)))'],
		['writeLines to connection', 'tf <- tempfile()\ncon <- file(tf, open = "w")\nwriteLines("x", con)\nclose(con)\nprint(readLines(tf))'],
		['sink to textConnection', 'rc <- textConnection("buf", "w")\nsink(rc)\ncat("hi\\n")\nsink()\nclose(rc)\nprint(buf)'],
		['file report: realistic', 'out_dir <- tempfile("report")\ndir.create(out_dir)\nreport <- file.path(out_dir, "report.txt")\ndata(mtcars)\ncat("# Report\\n", file = report)\nwrite_section <- function(title, lines, file = report) {\n  cat("##", title, "\\n", file = file, append = TRUE)\n  for (l in lines) cat("-", l, "\\n", file = file, append = TRUE)\n}\nwrite_section("Overview", c(paste("rows:", nrow(mtcars)), paste("cols:", ncol(mtcars))))\nby_cyl <- tapply(mtcars$mpg, mtcars$cyl, mean)\nwrite_section("MPG by cyl", sprintf("%s: %.2f", names(by_cyl), by_cyl))\nlog_file <- file.path(out_dir, "log.txt")\nsink(log_file)\nprint(summary(mtcars$hp))\ncat("done\\n")\nsink()\ncon <- file(file.path(out_dir, "stream.txt"), open = "w")\nfor (g in sort(unique(mtcars$gear))) {\n  writeLines(sprintf("gear=%d n=%d", g, sum(mtcars$gear == g)), con)\n}\nclose(con)\nstream <- readLines(file.path(out_dir, "stream.txt"))\ncon2 <- file(file.path(out_dir, "stream.txt"), open = "a")\nwriteLines("gear=99 n=0", con2)\nclose(con2)\ntxt <- readLines(report)\nheaders <- grep("^##", txt, value = TRUE)\ncat("@@", capture.output(print(headers)), sep = "\\n")'],
		['env object method mutation', 'mk <- function() { self <- new.env(); self$v <- 0; self$inc <- function(x) self$v <- self$v + x; self }\no <- mk()\no$inc(5)\nprint(o$v)'],
		['env object method mutation: realistic account', 'Account <- function(owner, balance = 0) {\n  self <- new.env()\n  self$owner <- owner\n  self$balance <- balance\n  self$history <- numeric()\n  self$deposit <- function(x) {\n    self$balance <- self$balance + x\n    self$history <- c(self$history, x)\n    invisible(self)\n  }\n  self$withdraw <- function(x) {\n    if (x > self$balance) stop("insufficient funds")\n    self$balance <- self$balance - x\n    self$history <- c(self$history, -x)\n    invisible(self)\n  }\n  class(self) <- "Account"\n  self\n}\nacc <- Account("ana", 100)\nacc$deposit(50)\nacc$withdraw(30)\ncat("@@", capture.output(print(acc$balance)), sep = "\\n")'],
		['env param default mutation', 'e <- new.env()\ne$reg <- list()\nreg <- function(k, v, env = e) env$reg[[k]] <- v\nreg("a", 1)\nprint(e$reg$a)'],
		['env param default mutation: realistic registry', 'pkg_env <- new.env()\npkg_env$registry <- list()\npkg_env$calls <- 0L\nregister <- function(name, fun, env = pkg_env) {\n  env$registry[[name]] <- fun\n  invisible(name)\n}\ndispatch <- function(name, ...) {\n  pkg_env$calls <- pkg_env$calls + 1L\n  f <- pkg_env$registry[[name]]\n  if (is.null(f)) stop("no handler: ", name)\n  f(...)\n}\nregister("sum", function(...) sum(...))\nregister("cat", function(..., sep = "") paste(..., sep = sep))\ncat("@@", capture.output(print(dispatch("sum", 1, 2, 3))), sep = "\\n")'],
		['closure state via environment(fn)', 'mk <- function() { n <- 0; function() { n <<- n + 1; 0 } }\nh <- mk()\nh()\nprint(environment(h)$n)'],
		['closure state via environment(fn): realistic hook', 'pkg_env <- new.env()\npkg_env$registry <- list()\npkg_env$calls <- 0L\nregister <- function(name, fun, env = pkg_env) {\n  env$registry[[name]] <- fun\n  invisible(name)\n}\ndispatch <- function(name, ...) {\n  pkg_env$calls <- pkg_env$calls + 1L\n  f <- pkg_env$registry[[name]]\n  if (is.null(f)) stop("no handler: ", name)\n  f(...)\n}\nregister("sum", function(...) sum(...))\nregister("cat", function(..., sep = "") paste(..., sep = sep))\nmake_hook <- function() {\n  calls <- 0\n  hook <- function() { calls <<- calls + 1; sys.function() }\n  hook\n}\nh <- make_hook()\nh2 <- h()\nh2()\ncat("@@", capture.output(print(environment(h)$calls)), sep = "\\n")'],
		['closure state via environment(fn): hook handed out but not called', 'make_hook <- function() {\n  calls <- 0\n  hook <- function() { calls <<- calls + 1; sys.function() }\n  hook\n}\nh <- make_hook()\nh2 <- h()\ncat("@@", capture.output(print(environment(h)$calls)), sep = "\\n")', 'h2'],
		['function passed to factory loses body', 'memo <- function(f) function(n) f(n)\nsq <- function(n) n^2\nm <- memo(sq)\nprint(m(4))'],
		['function passed to factory loses body: realistic memo', 'make_memo <- function(f) {\n  cache <- new.env(parent = emptyenv())\n  hits <- 0\n  function(n) {\n    key <- as.character(n)\n    if (exists(key, envir = cache, inherits = FALSE)) {\n      hits <<- hits + 1\n      return(get(key, envir = cache))\n    }\n    val <- f(n)\n    assign(key, val, envir = cache)\n    val\n  }\n}\nslow_sq <- function(n) { Sys.sleep(0); n^2 }\nmsq <- make_memo(slow_sq)\na <- msq(4)\nb <- msq(4)\nc3 <- msq(5)\ncat("@@", capture.output(print(c(a, b, c3))), sep = "\\n")'],
		['S3 validation in tryCatch: realistic', 'new_money <- function(amount = double(), currency = "EUR") {\n  stopifnot(is.double(amount))\n  structure(list(amount = amount, currency = currency), class = "money")\n}\nvalidate_money <- function(x) {\n  if (any(x$amount < 0)) stop("negative amount", call. = FALSE)\n  if (!x$currency %in% c("EUR", "USD")) stop("unknown currency")\n  x\n}\nmoney <- function(amount, currency = "EUR") {\n  validate_money(new_money(as.double(amount), currency))\n}\nformat.money <- function(x, digits = 2, ...) {\n  paste(formatC(x$amount, format = "f", digits = digits), x$currency)\n}\nprint.money <- function(x, ...) {\n  cat("<money>", format(x, ...), "\\n")\n  invisible(x)\n}\nsummary.money <- function(object, ...) {\n  structure(list(total = sum(object$amount), n = length(object$amount), currency = object$currency),\n            class = "summary.money")\n}\nprint.summary.money <- function(x, ...) {\n  cat("Total:", x$total, x$currency, "over", x$n, "\\n")\n}\n"+.money" <- function(e1, e2) {\n  if (e1$currency != e2$currency) stop("currency mismatch")\n  money(e1$amount + e2$amount, e1$currency)\n}\nlength.money <- function(x) length(x$amount)\nwallet <- money(c(1.5, 2.25, 10))\nmore <- money(c(1, 1, 1))\nboth <- wallet + more\nbad <- tryCatch(money(-1), error = function(e) conditionMessage(e))\nmixed <- tryCatch(wallet + money(1, "USD"), error = function(e) "mismatch")\ncat("@@", capture.output(print(mixed)), sep = "\\n")'],
	]));
	describe('counterexamples', () => check([
		['UseMethod reconstructed as its argument', 'gen <- function(x) UseMethod("gen")\ngen.default <- function(x) cnt <<- 1\ngen(1)\nprint(cnt)'],
		['S3 method redefined after the call', 'gen <- function(x) UseMethod("gen")\ngen.a <- function(x) "1"\nr <- gen(structure(1, class = "a"))\ngen.a <- function(x) "2"\nprint(r)'],
		['user method of a built-in generic', 'summary.zz <- function(object, ...) { cnt <<- 1; 0 }\nsummary(structure(1, class = "zz"))\nprint(cnt)'],
		['user format method with prior value', 'cnt <- 0\nformat.zz <- function(x, ...) { cnt <<- cnt + 1; "zz" }\nformat(structure(1, class = "zz"))\nprint(cnt)'],
		['closure from local', 'counter <- local({ i <- 0; function() { i <<- i + 1; i } })\ncounter()\nprint(counter())'],
		['closures in a list called in a for loop', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nL <- list(mk())\nfor(f in L) f()\nprint(L[[1]]())'],
		['closures in a list called via lapply', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nL <- list(mk())\ninvisible(lapply(L, function(g) g()))\nprint(L[[1]]())'],
		['with calls a closure of the environment', 'o <- local({ n <- 0; inc <- function() n <<- 1; environment() })\nwith(o, inc())\nprint(o$n)'],
		['with calls a built-in only', 'o <- local({ n <- 0; environment() })\nwith(o, sum(1))\nprint(o$n)', 'with'],
		['active binding setter', 'v <- 0\nmakeActiveBinding("ab", function(val) v <<- val, environment())\nab <- 4\nprint(v)'],
		['assignment to another name than the active binding', 'v <- 0\nmakeActiveBinding("ab", function(val) v <<- val, environment())\ncd <- 4\nprint(v)', 'cd <- 4'],
		['assign into sys.frame(-1)', 'f <- function() { v <- 1; g <- function() assign("v", 2, envir = sys.frame(-1)); g(); v }\nprint(f())'],
		['assign into the own frame leaves the global one', 'v <- 1\nf <- function() { v <- 5; assign("v", 2, envir = environment()); v }\nx <- f()\nprint(v)', 'x <-'],
		['delayedAssign writes a variable when forced', 'delayedAssign("p", {x <<- 2})\nx <- 1\np\nprint(x)'],
		['delayedAssign forces a closure writing a variable', 'f <- function() { x <<- 2; 0 }\ndelayedAssign("p", f())\nx <- 1\np\nprint(x)'],
		['delayedAssign forces a closure writing another variable', 'f <- function() { y <<- 2; 0 }\ndelayedAssign("p", f())\nx <- 1\np\nprint(x)', 'delayedAssign'],
		['closure returned by sys.function called within a function', 'make_hook <- function() {\n  calls <- 0\n  hook <- function() { calls <<- calls + 1; sys.function() }\n  hook\n}\nh <- make_hook()\nrun <- function() { h2 <- h(); h2(); 0 }\nrun()\nprint(environment(h)$calls)'],
		['closure returned by a call of a factory result within a function', 'n <- 0\nmk <- function() { f <- function() { n <<- n + 1; sys.function() }; f }\nrun <- function() { g <- mk()(); g() }\nrun()\nprint(n)'],
		['closure returned within a function but not called', 'n <- 0\nmk <- function() { f <- function() { n <<- n + 1; sys.function() }; f }\nrun <- function() { g <- mk()(); 0 }\nrun()\nprint(n)', 'g <-'],
	]));
	/* the last element states whether the shipped signature database is on, as it is outside the tests */
	describe.sequential('real-world scripts', () => {
		for(const [name, code, criterion, sigdb] of [
			['setRefClass contains a class registered by name', 'setRefClass("A", fields = list(a = "numeric"))\nB <- setRefClass("B", contains = "A")\nprint(B$className)', '3@print', false],
			['setRefClass new of a subclass', 'A <- setRefClass("A", fields = list(a = "numeric"))\nB <- setRefClass("B", contains = "A")\nb <- B$new(a = 3)\nprint(b$a)', '4@print', false],
			['uncalled ggplot body and a later library', 'f <- 1\ng <- function() ggplot()\nprint(f)\nlibrary(ggplot2)', '3@print', true],
			['uncalled theme body and a later library', 'f <- 1\ng <- function() theme_classic()\ncat(f, "\\n")\nlibrary(ggplot2)', '3@cat', true],
		] as const) {
			assertSliceMatchesR(parser, name, code, { criterion, whole: true, sigdb });
		}
	});
	describe('domains', () => {
		const sec = (s: string) => decorateLabelContext(label(s, ['name-normal', 'function-calls']), ['dataflow']);
		const keeps = (name: string, code: string, criterion: SlicingCriterion, expected: { has?: readonly string[], lacks?: readonly string[] }) => assertSliceKeeps(sec(name), parser, code, criterion, expected);
		const adder = 'adder <- function(n) function(x) x + n\nadd1 <- adder(1)\nr <- Reduce(`+`, lapply(1:3, add1))\nprint(r)';
		keeps('domains:hof the closure argument and its factory call are kept', adder, '4@print', { has: ['adder <- function(n) function(x) x + n', 'add1 <- adder(1)', 'lapply(1:3, add1)'] });
		keeps('domains:hof a second closure of the factory is not needed', 'adder <- function(n) function(x) x + n\nadd1 <- adder(1)\nadd2 <- adder(2)\nprint(add1(5))', '4@print', { has: ['add1 <- adder(1)'], lacks: ['add2'] });
		keeps('domains:hof the promise of the factory argument sees the later value', 'adder <- function(n) function(x) x + n\nk <- 1\nadd <- adder(k)\nk <- 100\nprint(add(1))', '5@print', { has: ['k <- 100', 'add <- adder(k)'] });
		keeps('domains:hof the promise of the factory argument does not see the overwritten value', 'adder <- function(n) function(x) x + n\nk <- 1\nadd <- adder(k)\nk <- 100\nprint(add(1))', '5@print', { lacks: ['k <- 1\n'] });
		const factoryOf = (between: string, use = 'print(add(1))') => `adder <- function(n) function(x) x + n\nk <- 1\nadd <- adder(k)\n${between}\n${use}`;
		keeps('domains:hof a promise forced before the overwrite keeps the old value', factoryOf('add(1)\nk <- 100'), '6@print', { has: ['k <- 1\n'] });
		keeps('domains:hof a conditional overwrite keeps the old value', factoryOf('if(runif(1) > 2) k <- 100'), '5@print', { has: ['k <- 1\n'] });
		keeps('domains:hof a closure called through an earlier function stays conservative', factoryOf('g <- function() add(1)\nk <- 100', 'print(g())'), '6@print', { has: ['k <- 1\n'] });
		keeps('domains:hof a closure aliased before the overwrite stays conservative', factoryOf('h <- add\nk <- 100', 'print(h(1))'), '6@print', { has: ['k <- 1\n'] });
		const plus = 'assign("+", function(a, b) a - b)\n2 + 3';
		assertCallTargets(sec('domains:reflection a rebound plus calls the new function'), parser, plus, '2@+', { reaches: ['1@function'] });
		keeps('domains:reflection the rebinding is part of the slice', plus, '2@+', { has: ['assign("+"'] });
		keeps('domains:reflection an unrelated rebinding is not', 'assign("-", function(a, b) a + b)\n2 + 3', '2@+', { lacks: ['assign'] });
		keeps('domains:reflection a rebinding through eval is part of the slice', 'eval(parse(text = "`+` <- function(a, b) a - b"))\n2 + 3', '2@+', { has: ['eval(parse'] });
		keeps('domains:reflection body replacement is part of the slice', 'f <- function(a, b) a + b\nbody(f) <- quote(a - b)\nf(2, 3)', '3@f', { has: ['body(f) <- quote(a - b)'] });
		keeps('domains:reflection a rebinding in a function body stays there', 'g <- function() {\n  assign("+", function(a, b) a - b)\n  2 + 3\n}\nprint(2 + 3)', '5@print', { lacks: ['assign'] });
		keeps('vector: the length bound is part of the slice', 'n <- 4L\nx <- 1:n\nprint(x)', '3@print', { has: ['n <- 4L'] });
		const attr = 'x <- 1:6\ndim(x) <- c(2, 3)\nclass(x) <- "myclass"\ne <- structure(1:6, dim = c(2, 3), class = "myclass")\nprint(dim(x))\nprint(e)';
		keeps('attr: the replacement sets the attribute', attr, '5@print', { has: ['x <- 1 : 6', 'dim(x) <- c(2, 3)'], lacks: ['structure'] });
		keeps('attr: structure sets them in one call', attr, '6@print', { has: ['structure'], lacks: ['dim(x) <-', 'class(x) <-'] });
		const shape = 'df <- data.frame(id = 2:3, points = c(4, 6))\nscore <- 42\nwith(df, {\n  print(score)\n})';
		keeps('shape: a name in with may be a column or the variable', shape, '4@print', { has: ['df <- data.frame', 'score <- 42'] });
		const matrix = 'm <- matrix(1:6, nrow = 2)\nr <- t(m) %*% m\nprint(r)';
		keeps('matrix: the product reads the matrix', matrix, '3@print', { has: ['m <- matrix(1:6, nrow = 2)'] });
		keeps('order: a cell run again reads the run before', 'x <- 1\nx <- x * 2\nprint(x)', '3@print', { has: ['x <- 1', 'x <- x * 2'] });
		const graphics = 'df <- data.frame(age = 20:59, income = 2 * (20:59), name = paste0("p", 1:40))\nplot(df$age, df$income)\nw <- par("pin")[1]\nn <- floor(w / strwidth("label", "inches"))\ntext(df$age[1:n], df$income[1:n], df$name[1:n])';
		keeps('state: the width depends on the device the plot opened', graphics, '4@n', { has: ['plot(df$age, df$income)', 'w <- par("pin")[1]'] });
		const noisy = 'noisy <- function(x) {\n  set.seed(1)\n  x + rnorm(1)\n}\nr <- runif(1)\na <- noisy(r)\nb <- noisy(runif(1))';
		keeps('state: the seed set in the function is part of the slice', noisy, '7@b', { has: ['set.seed(1)', 'rnorm(1)'] });
		const io = 'write.csv(iris, "data.csv")\ndf <- read.csv("data.csv")';
		keeps('io: reading a file reads what was written to it', io, '2@df', { has: ['write.csv(iris, "data.csv")'] });
		keeps('io: a file written later is not read', 'df <- read.csv("data.csv")\nwrite.csv(iris, "data.csv")', '1@df', { lacks: ['write.csv'] });
		const validity = 'x <- rnorm(20)\ny <- rnorm(20)\nt.test(x, y)';
		keeps('validity: the test reads both samples', validity, '3@t.test', { has: ['x <- rnorm(20)', 'y <- rnorm(20)'] });
		const pdf = 'name <- readline("File for the plot: ")\npdf(name)\nplot(1:10)\ndev.off()';
		keeps('security: closing the device keeps the plot on it', pdf, '4@dev.off', { has: ['pdf(name)', 'plot(1:10)'] });
	});
}));

describe('Primer', { concurrent: false }, withShell(shell => {
	assumeLoadedPackages('dplyr');
	const sec = (s: string) => label(s, ['name-normal', 'function-calls']);
	function assertReaches(code: string, target: SlicingCriterion, expected: boolean) {
		describe(code, () => {
			test.each([shell, new TreeSitterExecutor()])('reaches %s', async parser => {
				const result = await createDataflowPipeline(parser, { context: contextFromInput(code) }).allRemainingSteps();
				const cfg = extractCfg(result.dataflow);
				assert.strictEqual(canReach(cfg.graph, cfg.entryPoints, SlicingCriterion.parse(target, result.normalize.idMap)), expected);
			});
		});
	}
	describe('values: growing vectors', () => {
		assertSliced(sec('primer:values x[5] <- 1'), shell, 'x <- 1\nx[5] <- 1\nprint(x)', ['3@print'], 'x <- 1\nx[5] <- 1\nprint(x)');
		assertSliced(sec('primer:values NULL turns into vector'), shell, 'g <- NULL\ng[1] <- 1\nprint(g)', ['3@print'], 'g <- NULL\ng[1] <- 1\nprint(g)');
	});
	describe('promises: default argument side effects', () => {
		const f = 'f <- function(x = {\n  x <- 1\n  2\n}) { x * 2 }\n';
		const g = 'g <- function(x = {\n  x <- 1\n  2\n}) { x + x }\n';
		assertSliced(sec('primer:promises f()'), shell, f + 'r <- f()\nprint(r)', ['6@print'], 'f <- function(x={x <- 1; 2}) x * 2\nr <- f()\nprint(r)', { expectedOutput: '[1] 4', expectedSliceOutput: '[1] 4' });
		assertSliced(sec('primer:promises g()'), shell, g + 'r <- g()\nprint(r)', ['6@print'], 'g <- function(x={x <- 1; 2}) x + x\nr <- g()\nprint(r)', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
		assertSliced(sec('primer:promises unforced default is not needed'), shell, 'k <- function(x = {\n  x <- 1\n  2\n}) { 3 }\nr <- k()\nprint(r)', ['6@print'], 'k <- function(x={x <- 1; 2}) 3\nr <- k()\nprint(r)', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
	});
	describe('env: assign into the caller', () => {
		const code = 'f <- function() {\n    var_name <- "x"\n    assign(var_name, 42, envir = parent.frame())\n}\nf()\nprint(x)';
		assertSliced(sec('primer:env assign parent.frame'), shell, code, ['6@print'], 'f <- function() {\n        var_name <- "x"\n        assign(var_name, 42, envir = parent.frame())\n    }\nf()\nprint(x)', { expectedOutput: '[1] 42', expectedSliceOutput: '[1] 42' });
		assertDataflow(sec('primer:env use of x reads the assign'), shell, code, emptyGraph().reads('6@x', '3@var_name'),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true });
	});
	describe('nse', () => {
		assertSliced(sec('primer:nse subset and with'), shell, 'df <- data.frame(x = c(-1, 2))\nsubset(df, x > 0)\nwith(df, mean(x))', ['3@with'], 'df <- data.frame(x = c(-1, 2))\nwith(df, mean(x))');
		assertSliced(sec('primer:nse subset'), shell, 'df <- data.frame(x = c(-1, 2))\nsubset(df, x > 0)\nwith(df, mean(x))', ['2@subset'], 'df <- data.frame(x = c(-1, 2))\nsubset(df, x > 0)');
	});
	describe('reflection', () => {
		const code = 'f <- function(x = {\n  x <- 2\n  1\n}) x + x\nf()\nformals(f) <- alist(x = 5)\nbody(f)    <- quote(x <<- x + x)\nf()\neval(parse(text = "`<-` <- `*`"))\nx <- 2\nprint(x)';
		/* after `eval(parse(...))`, `x <- 2` multiplies instead of assigning, so only the call of the rewritten `f` sets `x` */
		assertSliced(sec('primer:reflection session'), shell, code, ['11@print'],
			'f <- function(x={x <- 2; 1}) x + x\nformals(f) <- alist(x = 5)\nbody(f) <- quote(x <<- x + x)\nf()\nprint(x)',
			{ expectedOutput: '[1] 3\n[1] 20\n[1] 10', expectedSliceOutput: '[1] 10' });
	});
	describe('redefining control flow', () => {
		const code = '`if` <- function(cond, true, false) {\n  force(true)\n  force(false)\n}\nif(x > 0) { print("positive")\n} else { print("non-positive") }';
		assertDataflow(sec('primer:reflection redefined if is a call of the user function'), shell, code,
			emptyGraph().calls('5@if', '1@function'),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true });
		/* reading `true` forces the promise just as `force(true)` does */
		assertSliced(sec('primer:reflection redefined if keeps the definition'), shell, code, ['6@print'],
			'`if` <- function(cond, true, false) {\n        true\n        force(false)\n    }\nif(x > 0) { print("positive") } else\n{ print("non-positive") }',
			{ expectedOutput: '[1] "positive"\n[1] "non-positive"', expectedSliceOutput: '[1] "positive"\n[1] "non-positive"' });
	});
	describe('oop', () => {
		const code = 'x <- "hello"\nprint(x)\nprint.character <- function(...) 42\nprint(x)';
		assertSliced(sec('primer:oop S3 method added later'), shell, code, ['4@print'], 'x <- "hello"\nprint.character <- function(...) 42\nprint(x)', { expectedOutput: '[1] "hello"\n[1] 42', expectedSliceOutput: '[1] 42' });
		assertSliced(sec('primer:oop S3 method not yet defined'), shell, code, ['2@print'], 'x <- "hello"\nprint(x)');
	});
	describe('control: warn option', () => {
		/* running the slices sets the option in the shared session */
		afterAll(() => shell.sendCommand('options(warn = 0)'));
		const code = 'f <- function() {\n  n <- as.integer("a")\n  "after"\n}\nf()\noptions(warn = 2)\nr <- tryCatch(f(), error = function(e) "aborted")\nprint(r)';
		assertSliced(sec('primer:control warn option'), shell, code, ['8@print'],
			'f <- function() {\n        as.integer("a")\n        "after"\n    }\noptions(warn = 2)\nr <- tryCatch(f(), error = function(e) "aborted")\nprint(r)',
			{ expectedOutput: '[1] "after"\n[1] "aborted"', expectedSliceOutput: '[1] "aborted"' });
		const f = 'f <- function() {\n  n <- as.integer("a")\n  "after"\n}\n';
		const fn = 'f <- function() {\n        as.integer("a")\n        "after"\n    }\n';
		const tc = (block = 'f()') => `r <- tryCatch(${block}, error = function(e) "aborted")\nprint(r)`;
		/* the slice keeps what may warn exactly when `warn` may be 2 or more */
		for(const [label, setup, criterion, sliced, block, output] of [
			['warn 1', 'options(warn = 1)\n', '7@print', 'f <- function() "after"\noptions(warn = 1)\n', 'f()', '[1] "after"'],
			['suppressWarnings', 'options(warn = 2)\n', '7@print', 'f <- function() "after"\noptions(warn = 2)\n', 'suppressWarnings(f())', '[1] "after"'],
			['muffled', 'options(warn = 2)\n', '7@print', 'f <- function() "after"\noptions(warn = 2)\n', 'withCallingHandlers(f(), warning = function(w) invokeRestart("muffleWarning"))', '[1] "after"'],
			['muffled in braces', 'options(warn = 2)\n', '7@print', 'f <- function() "after"\noptions(warn = 2)\n', 'withCallingHandlers(f(), warning = function(w) { invokeRestart("muffleWarning") })', '[1] "after"'],
			['not muffled', 'options(warn = 2)\n', '7@print', fn + 'options(warn = 2)\n', 'withCallingHandlers(f(), warning = function(w) 1)', '[1] "aborted"'],
			['muffled messages only', 'options(warn = 2)\n', '7@print', fn + 'options(warn = 2)\n', 'withCallingHandlers(f(), message = function(m) invokeRestart("muffleMessage"))', '[1] "aborted"'],
			['branch', 'if(runif(1) < 2) options(warn = 2)\n', '7@print', fn + 'if(runif(1) < 2) options(warn = 2)\n', 'f()', '[1] "aborted"'],
			['in function', 'g <- function() options(warn = 2)\ng()\n', '8@print', fn + 'g <- function() options(warn = 2)\ng()\n', 'f()', '[1] "aborted"'],
			['restore', 'options(warn = 0)\nop <- options(warn = 2)\noptions(op)\n', '9@print', fn + 'options(warn = 0)\nop <- options(warn = 2)\noptions(op)\n', 'f()', '[1] "after"'],
		] as const) {
			assertSliced(sec(`primer:control warn option ${label}`), shell, f + setup + tc(block), [criterion], sliced + tc(block), { expectedSliceOutput: output });
		}
		assertSliced(sec('primer:control warn option warning'), shell, 'options(warn = 2)\nr <- tryCatch(warning("w"), error = function(e) "aborted")\nprint(r)', ['3@print'], 'options(warn = 2)\nr <- tryCatch(warning("w"), error = function(e) "aborted")\nprint(r)', { expectedSliceOutput: '[1] "aborted"' });
		assertSliced(sec('primer:control warn option try'), shell, f + 'options(warn = 2)\nr <- try(f(), silent = TRUE)\nprint(class(r))', ['7@print'], fn + 'options(warn = 2)\nr <- try(f(), silent = TRUE)\nprint(class(r))', { expectedSliceOutput: '[1] "try-error"' });
	});
	describe('control: return in a promise', () => {
		const h = 'h <- function() {\n  g(return("h early"))\n  "h end"\n}\n';
		const forcing = 'g <- function(a) {\n  a\n  "g end"\n}\n' + h + 'r <- h()\nprint(r)';
		const lazy = 'g <- function(a) {\n  "g end"\n}\n' + h + 'r <- h()\nprint(r)';
		/* the `a` that forces the promise is what makes `h` return early, so the slice keeps it */
		assertSliced(sec('primer:control forcing return'), shell, forcing, ['10@print'], 'g <- function(a) {\n        a\n        "g end"\n    }\nh <- function() {\n        g(return("h early"))\n        "h end"\n    }\nr <- h()\nprint(r)', { expectedOutput: '[1] "h early"', expectedSliceOutput: '[1] "h early"' });
		assertSliced(sec('primer:control not forcing return'), shell, lazy, ['9@print'],
			'g <- function(a) "g end"\nh <- function() {\n        g(return("h early"))\n        "h end"\n    }\nr <- h()\nprint(r)',
			{ expectedOutput: '[1] "h end"', expectedSliceOutput: '[1] "h end"' });
		assertReaches(forcing, '7@"h end"', false);
		assertReaches(lazy, '6@"h end"', true);
		assertHappensBefore(shell, lazy, '5@g', '6@"h end"', Ternary.Always, false);
	});
	describe('state', () => {
		assertSliced(sec('primer:state set.seed'), shell, 'set.seed(1)\nrunif(1)\nr <- runif(1)\nprint(r)', ['4@print'], 'set.seed(1)\nrunif(1)\nr <- runif(1)\nprint(r)', { expectedOutput: '[1] 0.2655087\n[1] 0.3721239', expectedSliceOutput: '[1] 0.2655087\n[1] 0.3721239' });
		assertSliced(sec('primer:state graphics device'), shell, 'plot(1:10)\npoints(10:1)', ['2@points'], 'plot(1:10)\npoints(10:1)');
	});
	describe('intertwine', () => {
		const factor = 'x <- 1:3\nclass(x)  <- "factor"\nlevels(x) <- c("a", "b", "c")\nprint(typeof(x))\nprint(class(x))';
		assertSliced(sec('intertwine factor class'), shell, factor, ['5@print'], 'x <- 1 : 3\nclass(x) <- "factor"\nlevels(x) <- c("a", "b", "c")\nprint(class(x))');
		assertSliced(sec('intertwine factor typeof'), shell, factor, ['4@print'], 'x <- 1 : 3\nclass(x) <- "factor"\nlevels(x) <- c("a", "b", "c")\nprint(typeof(x))');
		const col = 'df <- data.frame(a = 1, b = 2)\nflag <- runif(1) > 0.5\ncol <- if(flag) "a" else "b"\nr <- df[[col]]';
		assertSliced(sec('intertwine dynamic column'), shell, col, ['4@r'], 'df <- data.frame(a = 1, b = 2)\nflag <- runif(1) > 0.5\ncol <- if(flag) "a" else\n    "b"\nr <- df[[col]]');
		const fn = 'flag <- runif(1) > 0.5\nmethod <- if(flag) "sum" else "max"\nfn <- get(method)\nfn(1)';
		assertSliced(sec('intertwine dynamic function'), shell, fn, ['3@fn'], 'flag <- runif(1) > 0.5\nmethod <- if(flag) "sum" else\n    "max"\nfn <- get(method)');
	});
	describe('abstract interpretation: pipeline', () => {
		const code = 'df <- data.frame(id = 1:4, score = 1:4)\ndf2 <- df |> filter(score > 2) |>\n  mutate(lvl = score^2) |> select(-score)\ndf2$lvl';
		assertSliced(sec('ai:shape pipeline'), shell, code, ['4@df2'], 'df <- data.frame(id = 1:4, score = 1:4)\ndf2 <- df |> filter(score > 2) |> mutate(lvl = score^2) |> select(-score)\ndf2', { minRVersion: MIN_VERSION_PIPE });
	});
	describe('cycle figure', () => {
		const code = 'avg <- function(df, col, n = nrow(df)) {\n  if(anyNA(df))\n    df <- na.omit(df)\n  sum(df[[col]]) / n\n}\ndf <- data.frame(a = c(1, NA, 3))\nr <- avg(df, "a")\nprint(r)';
		assertSliced(sec('cycle:avg'), shell, code, ['8@print'], 'avg <- function(df, col, n=nrow(df)) {\n        if(anyNA(df)) df <- na.omit(df)\n        sum(df[[col]]) / n\n    }\ndf <- data.frame(a = c(1, NA, 3))\nr <- avg(df, "a")\nprint(r)', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		assertDataflow(sec('cycle:avg lazy n sees na.omit definition'), shell, code,
			emptyGraph().reads('1@[2]df', '1@[1]df').reads('1@[2]df', '3@[1]df'),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true });
	});
}));
