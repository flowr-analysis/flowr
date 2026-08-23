import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { ArgProps } from '../../../src/dataflow/environments/built-in-props';

describe('Inspect Argument Roles Query', withTreeSitter(parser => {
	/** The roles the query gives the formals of `f`, as words, for the given body. */
	function testRoles(name: string, code: string, expected: Record<string, string>) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-arg-roles' }]);
			const idMap = (await analyzer.normalize()).idMap;
			const found: Record<string, string> = {};
			for(const roles of Object.values(result['inspect-arg-roles'].roles)) {
				for(const [formal, props] of Object.entries(roles)) {
					const named = idMap.get(Number(formal))?.lexeme ?? formal;
					found[named] = ArgProps.words(props).join('+');
				}
			}
			assert.deepStrictEqual(found, expected, JSON.stringify(result['inspect-arg-roles'].roles));
		});
	}

	testRoles('a formal handed straight back', 'f <- function(x) x', { x: 'alias' });
	testRoles('through return', 'f <- function(x) return(x)', { x: 'alias' });
	testRoles('through invisible', 'f <- function(x) invisible(x)', { x: 'forced+alias' });
	testRoles('through a local', 'f <- function(x) { y <- x; y }', { x: 'alias' });
	testRoles('a branch is not always the result', 'f <- function(x, flag) if(flag) x else NULL', {});
	testRoles('nor is a conditional return', 'f <- function(x, flag) { if(flag) return(x); NULL }', {});
	testRoles('a formal only read is not returned', 'f <- function(x) nchar(x)', { x: 'shape' });
	testRoles('a formal that is called', 'f <- function(xs, FUN) lapply(xs, FUN)', { xs: 'value', FUN: 'callee' });
	testRoles('through do.call', 'f <- function(FUN, args) do.call(FUN, args)', { FUN: 'callee', args: 'value' });
	testRoles('a formal only asked about', 'f <- function(a) missing(a)', { a: 'presence' });
	testRoles('hasArg asks the same thing', 'f <- function(a) hasArg(a)', { a: 'presence' });
	testRoles('a copy modified in place is not the argument', 'f <- function(x) { x[1] <- 2; x }', {});
	testRoles('nor is one an attribute was set on', 'f <- function(x) { attr(x, "a") <- 1; x }', {});
	testRoles('a part taken out of it is not it either', 'f <- function(x) x$a', { x: 'value' });
	testRoles('a name holding the result of agreeing branches is', 'f <- function(x) { y <- if(TRUE) x else x; y }', { x: 'alias' });
	testRoles('print hands back what it printed', 'f <- function(x) print(x)', { x: 'forced+alias' });

	/* counterexamples: what the walk has to get right beyond the straightforward cases */
	testRoles('a formal overwritten before the end is not the result', 'f <- function(x) { x <- 1; x }', {});
	testRoles('nor is one overwritten on the way', 'f <- function(x) { y <- x; y <- 2; y }', {});
	testRoles('branches agreeing on the formal make it the result', 'f <- function(x, c) if(c) x else x', { x: 'alias' });
	testRoles('branches disagreeing do not', 'f <- function(x, y, c) if(c) x else y', {});
	testRoles('a constant condition is no condition', 'f <- function(x) if(TRUE) x', { x: 'alias' });
	testRoles('a quoted formal is read as written, not evaluated', 'f <- function(x) quote(x)', { x: 'nse' });
	testRoles('so is a substituted one', 'f <- function(x) substitute(x)', { x: 'nse' });
	testRoles('a named argument states what its own parameter does', 'f <- function(e) assign("z", 1, envir = e)', { e: 'written' });
	testRoles('local hands back what it was given', 'f <- function(x) local(x)', { x: 'forced+alias' });
	testRoles('a caught block is evaluated but may not come back', 'f <- function(x) tryCatch(x, error = function(e) NULL)', { x: 'forced+value' });
	testRoles('a formal the body calls is a callee', 'f <- function(g) g()', { g: 'callee' });
	testRoles('a formal only computed with is not', 'f <- function(x) x + 1', { x: 'value+atomic' });

}));
