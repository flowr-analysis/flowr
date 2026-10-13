import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import type { IdentifierReference } from '../../../../../src/dataflow/environments/identifier';
import { Identifier, isReferenceType, ReferenceType } from '../../../../../src/dataflow/environments/identifier';
import type { KillReference } from '../../../../../src/dataflow/info';

/** the variable-like references, as the sets also carry the called functions */
function variableNames(references: readonly IdentifierReference[]): string[] {
	const names = new Set(references
		.filter(r => r.name !== undefined && isReferenceType(r.type, ReferenceType.Unknown | ReferenceType.Variable))
		.map(r => Identifier.getName(r.name as Identifier)));
	return [...names].sort();
}

function killNames(kills: readonly KillReference[] | undefined): string[] {
	const names = new Set((kills ?? []).map(k => k.kind === 'named'
		? (k.reference.name !== undefined ? Identifier.getName(k.reference.name) : '?')
		: k.kind));
	return [...names].sort();
}

describe('References of an Expression List', withTreeSitter(parser => {
	interface ExpectedReferences {
		readonly in?:      readonly string[];
		readonly out?:     readonly string[];
		readonly unknown?: readonly string[];
		readonly kill?:    readonly string[];
	}

	function assertReferences(name: string, code: string, expected: ExpectedReferences) {
		test(name, async() => {
			const { dataflow } = await createDataflowPipeline(parser, { context: contextFromInput(code) }).allRemainingSteps();
			expect({
				in:      variableNames(dataflow.in),
				out:     variableNames(dataflow.out),
				unknown: variableNames(dataflow.unknownReferences),
				kill:    killNames(dataflow.kill)
			}).toEqual({
				in:      [...expected.in ?? []].sort(),
				out:     [...expected.out ?? []].sort(),
				unknown: [...expected.unknown ?? []].sort(),
				kill:    [...expected.kill ?? []].sort()
			});
		});
	}

	describe('Reads within called functions', () => {
		assertReferences('free variable of a called function', 'f <- function() a\nf()', { in: ['a'] });
		assertReferences('uncalled function', 'f <- function() a', {});
		assertReferences('defined before the call', 'a <- 1\nf <- function() a\nf()', { out: ['a'] });
		assertReferences('through nested and recursive calls', 'f <- function(n) if(n > 0) { g(n); f(n - 1) } else a\ng <- function(m) { k(m); b }\nk <- function(q) if(q) g(q - 1) else c1\nf(3)', { in: ['a', 'b', 'c1'] });
		assertReferences('a caller local is no binding of a global function', 'f <- function() { v <- 1; g() }\ng <- function() v\nf()', { in: ['v'] });
		assertReferences('nested definitions report once', 'outer <- function() { inner <- function() a; inner() }\nouter()', { in: ['a'] });
		assertReferences('a loaded data set', 'data("rat")', { out: ['rat'] });
		assertReferences('a parameter of a called function', 'f <- function(a) a\nf(1)', {});
		assertReferences('a local of a called function', 'f <- function() { a <- 1; a }\nf()', {});
		assertReferences('a function that is never called', 'f <- function() a\ng <- function() b\nf()', { in: ['a'] });
		assertReferences('defined after the definition but before the call', 'f <- function() a\na <- 1\nf()', { out: ['a'] });
		assertReferences('a parameter shadows the global of the same name', 'f <- function(a) a\na <- 2\nf(1)', { out: ['a'] });
		assertReferences('a local of an enclosing function binds the read of a nested one', 'f <- function() { a <- 1; g <- function() a; g() }\nf()', {});
		assertReferences('only the named data sets are defined', 'data("rat")\ny <- mouse', { in: ['mouse'], out: ['rat', 'y'] });
		assertReferences('every named data set is defined', 'data("rat", "mouse")', { out: ['mouse', 'rat'] });
	});

	describe('Plain Definitions', () => {
		assertReferences('unresolved read', 'y <- x', { in: ['x'], out: ['y'] });
		assertReferences('locally defined read', 'x <- 1\ny <- x', { out: ['x', 'y'] });
		assertReferences('redefinition', 'x <- 1\nx <- 2\ny <- x', { out: ['x', 'y'] });
		assertReferences('nested list', '{ x <- 1 }\ny <- x', { out: ['x', 'y'] });
		assertReferences('read within a function', 'x <- 1\nf <- function() { y <- x }', { out: ['x'] });
	});

	describe('Conditional Definitions', () => {
		assertReferences('definition in one branch', 'if(c) x <- 1\ny <- x', { in: ['c', 'x'], out: ['x', 'y'] });
		assertReferences('definition in every branch', 'if(c) x <- 1 else x <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('definition in every nested branch', 'if(c) { if(d) x <- 1 else x <- 2 } else x <- 3\ny <- x', { in: ['c', 'd'], out: ['x', 'y'] });
		assertReferences('conditional redefinition', 'x <- 1\nif(c) x <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('definition within a loop', 'for(i in v) x <- 1\ny <- x', { in: ['v', 'x'], out: ['i', 'x', 'y'] });
		assertReferences('definition within a loop that certainly runs', 'for(i in 1:2) x <- 1\ny <- x', { out: ['i', 'x', 'y'] });
		assertReferences('redefinition within a loop', 'x <- 1\nwhile(c) x <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
	});

	describe('Replacements', () => {
		assertReferences('without a definition', 'x$a <- x$a', { in: ['x'], out: ['x'] });
		assertReferences('nested target', 'x <- list()\nnames(x$a) <- v', { in: ['v'], out: ['x'] });
		assertReferences('one replacement', 'x <- foo()\nx$a <- x$a', { out: ['x'] });
		assertReferences('two replacements', 'x <- foo()\nx$a <- x$a\nx$b <- x$b', { out: ['x'] });
		assertReferences('conditional replacement', 'x <- 1\nif(c) x$a <- 2\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('replacement of a branched definition', 'if(c) x <- 1 else x <- 2\nx$a <- x$a\ny <- x', { in: ['c'], out: ['x', 'y'] });
	});

	describe('Removals', () => {
		assertReferences('removed definition', 'x <- 1\nrm(x)\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('conditional removal', 'x <- 1\nif(c) rm(x)\ny <- x', { in: ['c', 'x'], out: ['x', 'y'], kill: ['x'] });
		assertReferences('removal revived by a later write', 'x <- 1\nrm(x)\nx <- 2', { out: ['x'] });
		assertReferences('removal of the whole scope', 'x <- 1\nrm(list = ls())\ny <- x', { in: ['x'], out: ['y'], kill: ['all'] });
		assertReferences('whole scope removal with a later write', 'x <- 1\nrm(list = ls())\nx <- 2\nz <- x', { out: ['x', 'z'], kill: ['all'] });
		assertReferences('unresolvable removal', 'x <- 1\nrm(list = c("x"))\ny <- x', { in: ['x'], out: ['x', 'y'], kill: ['unknown'] });
		assertReferences('whole scope removal in a branch', 'x <- 1\ny <- 1\nif(c) { rm(list = ls()); y <- 2 }\nz <- x\nw <- y',
			{ in: ['c', 'x'], out: ['w', 'x', 'y', 'z'], kill: ['all'] });
		assertReferences('revived in one branch only', 'x <- 1\nrm(x)\nif(c) x <- 2\ny <- x', { in: ['c', 'x'], out: ['x', 'y'], kill: ['x'] });
		assertReferences('revived in every branch', 'x <- 1\nrm(x)\nif(c) x <- 2 else x <- 3\ny <- x', { in: ['c'], out: ['x', 'y'] });
		assertReferences('removal in every branch', 'x <- 1\nif(c) rm(x) else rm(x)\ny <- x', { in: ['c', 'x'], out: ['y'], kill: ['x'] });
		assertReferences('removal in a nested list', 'x <- 1\n{ rm(x) }\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('removal through a pipe', 'x <- 1\nx |> rm()\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('removal as a plain call argument', 'x <- 1\nidentity(rm(x))\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('removal of several definitions', 'x <- 1\ny <- 2\nrm(x, y)\nz <- x', { in: ['x'], out: ['z'], kill: ['x', 'y'] });
		assertReferences('removal in a repeat body', 'x <- 1\nrepeat { rm(x); break }\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('removal in a tryCatch block', 'x <- 1\ntryCatch(rm(x))\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('removal in a tryCatch finally', 'x <- 1\ntryCatch(1, finally = rm(x))\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		/* the loop may never run, so the removal only happens maybe */
		assertReferences('removal in a while body', 'x <- 1\nwhile(c) rm(x)\ny <- x', { in: ['c', 'x'], out: ['x', 'y'], kill: ['x'] });
		/* all verified against R 4.6: the formals after `rm`'s `...` only match by their exact name */
		assertReferences('a partial formal name lands in the dots', 'x <- 1\nrm(lis = "x")\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('a partial envir name lands in the dots', 'x <- 1\nrm(envi = "x")\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('inherits contributes no name', 'x <- 1\nrm(x, inherits = TRUE)\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		/* `pos = -1` and `envir = as.environment(pos)` are R's defaults, so they keep the removal local */
		assertReferences('the default position', 'x <- 1\nrm(x, pos = -1)\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		assertReferences('the current environment', 'x <- 1\nrm(x, envir = environment())\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		/* outside a function the global environment is the one we are analyzing */
		assertReferences('the global environment', 'x <- 1\nrm(x, envir = globalenv())\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		/* outside a function the caller frame is the global one as well */
		assertReferences('the caller frame', 'x <- 1\nrm(x, envir = parent.frame())\ny <- x', { in: ['x'], out: ['y'], kill: ['x'] });
		/* a frame we cannot identify leaves the one we are analyzing alone */
		assertReferences('an unknown environment', 'x <- 1\nrm(x, envir = e)\ny <- x', { in: ['e'], out: ['x', 'y'] });
		assertReferences('a shadowed globalenv', 'globalenv <- function() e\nx <- 1\nrm(x, envir = globalenv())\ny <- x', { in: ['e'], out: ['x', 'y'] });
		/* `rm` acts on the local frame, which never held `x` */
		assertReferences('removal within local', 'x <- 1\nlocal({ rm(x) })\ny <- x', { in: ['x'], out: ['x', 'y'] });
	});

	describe('Constructs Evaluated in the Enclosing Scope', () => {
		assertReferences('repeat body', 'repeat { x <- 1; break }\ny <- x', { out: ['x', 'y'] });
		assertReferences('while body', 'while(c) { x <- 1 }\ny <- x', { in: ['c', 'x'], out: ['x', 'y'] });
		assertReferences('tryCatch block', 'tryCatch({ x <- 1 })\ny <- x', { out: ['x', 'y'] });
		assertReferences('tryCatch finally', 'tryCatch({ x <- 1 }, finally = { w <- 2 })\ny <- x\nv <- w', { out: ['v', 'w', 'x', 'y'] });
		assertReferences('local scope', 'local({ x <- 1 })\ny <- x', { in: ['x'], out: ['y'] });
		assertReferences('local super assignment', 'local({ x <<- 1 })\ny <- x', { out: ['x', 'y'] });
		assertReferences('loop variable', 'for(i in v) x <- i\ny <- x', { in: ['v', 'x'], out: ['i', 'x', 'y'] });
		assertReferences('loop variable of a loop that certainly runs', 'for(i in 1:3) x <- i\ny <- x', { out: ['i', 'x', 'y'] });
		assertReferences('loop variable redefined in the body', 'for(i in 1:10) { i; i <- 12 }\ni', { out: ['i'] });
	});
}));
