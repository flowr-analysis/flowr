import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { ArgProp, ArgProps } from '../../../src/dataflow/environments/built-in-props';

describe('Inspect Argument Roles Query', withTreeSitter(parser => {
	/** The roles the query gives the formals of `f` for the given body, keyed by the name each is written as. */
	function testRoles(name: string, code: string, expected: Record<string, ArgProps>) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-arg-roles' }]);
			const idMap = (await analyzer.normalize()).idMap;
			const found: Record<string, ArgProps> = {};
			for(const roles of Object.values(result['inspect-arg-roles'].roles)) {
				for(const [formal, props] of Object.entries(roles)) {
					found[idMap.get(Number(formal))?.lexeme ?? formal] = props;
				}
			}
			/* the words make a mismatch readable, the numbers are what is compared */
			const words = (of: Record<string, ArgProps>) => Object.fromEntries(Object.entries(of).map(([n, p]) => [n, ArgProps.words(p).join('+')]));
			assert.deepStrictEqual(words(found), words(expected));
			assert.deepStrictEqual(found, expected);
		});
	}

	testRoles('a formal handed straight back', 'f <- function(x) x', { x: ArgProp.Alias });
	testRoles('through return', 'f <- function(x) return(x)', { x: ArgProp.Alias });
	testRoles('through invisible', 'f <- function(x) invisible(x)', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('through a local', 'f <- function(x) { y <- x; y }', { x: ArgProp.Alias });
	testRoles('a branch is not always the result', 'f <- function(x, flag) if(flag) x else NULL', {});
	testRoles('nor is a conditional return', 'f <- function(x, flag) { if(flag) return(x); NULL }', {});
	testRoles('a formal only read is not returned', 'f <- function(x) nchar(x)', { x: ArgProp.Shape });
	testRoles('a formal that is called', 'f <- function(xs, FUN) lapply(xs, FUN)', { xs: ArgProp.Value, FUN: ArgProp.Callee });
	testRoles('through do.call', 'f <- function(FUN, args) do.call(FUN, args)', { FUN: ArgProp.Callee, args: ArgProp.Value });
	testRoles('a formal only asked about', 'f <- function(a) missing(a)', { a: ArgProp.Presence });
	testRoles('hasArg asks the same thing', 'f <- function(a) hasArg(a)', { a: ArgProp.Presence });
	testRoles('match.call reaches every formal', 'f <- function(x, y) as.list(match.call())', { x: ArgProp.Nse, y: ArgProp.Nse });
	testRoles('a frame that escapes may hold any value', 'f <- function(x, y) as.list(environment())', { x: ArgProp.Value, y: ArgProp.Value });
	testRoles('environment(other) is another frame', 'f <- function(x, g) environment(g)', { g: ArgProp.Handle });
	testRoles('sys.call keeps what the body states too', 'f <- function(x) { print(sys.call()); x }', { x: ArgProp.Alias | ArgProp.Nse });
	testRoles('nargs sees only that an argument was there', 'f <- function(x, y) nargs()', { x: ArgProp.Presence, y: ArgProp.Presence });
	testRoles('a copy modified in place is not the argument', 'f <- function(x) { x[1] <- 2; x }', {});
	testRoles('nor is one an attribute was set on', 'f <- function(x) { attr(x, "a") <- 1; x }', {});
	testRoles('a part taken out of it is not it either', 'f <- function(x) x$a', { x: ArgProp.Value });
	testRoles('a name holding the result of agreeing branches is', 'f <- function(x) { y <- if(TRUE) x else x; y }', { x: ArgProp.Alias });
	testRoles('a formal called under another name is still called', 'f <- function(g) { h <- g; h() }', { g: ArgProp.Callee });
	testRoles('print hands back what it printed', 'f <- function(x) print(x)', { x: ArgProp.Forced | ArgProp.Alias });

	testRoles('a frame followed to a name states only that name', 'f <- function(x, y) { e <- environment(); get("x", envir = e) }', { x: ArgProp.Alias | ArgProp.Value });
	/* counterexamples: what the walk has to get right beyond the straightforward cases */
	testRoles('a formal overwritten before the end is not the result', 'f <- function(x) { x <- 1; x }', {});
	testRoles('nor is one overwritten on the way', 'f <- function(x) { y <- x; y <- 2; y }', {});
	testRoles('branches agreeing on the formal make it the result', 'f <- function(x, c) if(c) x else x', { x: ArgProp.Alias });
	testRoles('branches disagreeing do not', 'f <- function(x, y, c) if(c) x else y', {});
	testRoles('a constant condition is no condition', 'f <- function(x) if(TRUE) x', { x: ArgProp.Alias });
	testRoles('a quoted formal is read as written, not evaluated', 'f <- function(x) quote(x)', { x: ArgProp.Nse });
	testRoles('so is a substituted one', 'f <- function(x) substitute(x)', { x: ArgProp.Nse });
	testRoles('a named argument states what its own parameter does', 'f <- function(e) assign("z", 1, envir = e)', { e: ArgProp.Written });
	testRoles('local hands back what it was given', 'f <- function(x) local(x)', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('a caught block is evaluated but may not come back', 'f <- function(x) tryCatch(x, error = function(e) NULL)', { x: ArgProp.Forced | ArgProp.Value });
	testRoles('a formal the body calls is a callee', 'f <- function(g) g()', { g: ArgProp.Callee });
	testRoles('a formal only computed with is not', 'f <- function(x) x + 1', { x: ArgProp.Value | ArgProp.Atomic });

	testRoles('a name it cannot follow loses the frame', 'f <- function(x, nm) { e <- environment(); get(nm, envir = e) }', { x: ArgProp.Value, nm: ArgProp.Value });


}));
