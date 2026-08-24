import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { InspectFnPropsQueryDefinition } from '../../../src/queries/catalog/inspect-fn-props-query/inspect-fn-props-query-format';
import { ArgProp, ArgProps, CallProp, CallProps } from '../../../src/dataflow/environments/built-in-props';

describe('Inspect Argument Roles Query', withTreeSitter(parser => {
	/** The roles the query gives the formals of `f` for the given body, keyed by the name each is written as. */
	function testRoles(name: string, code: string, expected: Record<string, ArgProps>) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-fn-props' }]);
			const idMap = (await analyzer.normalize()).idMap;
			const found: Record<string, ArgProps> = {};
			for(const roles of Object.values(result['inspect-fn-props'].roles)) {
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

	/** What the query states about the function definitions of the program themselves, in the order it answers them. */
	function testProps(name: string, code: string, expected: readonly CallProps[]) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const found = Object.values((await analyzer.query([{ type: 'inspect-fn-props' }]))['inspect-fn-props'].props);
			/* the words make a mismatch readable, the numbers are what is compared */
			const words = (of: readonly CallProps[]) => of.map(p => CallProps.words(p).join('+'));
			assert.deepStrictEqual(words(found), words(expected));
			assert.deepStrictEqual(found, [...expected]);
		});
	}

	testRoles('a formal handed straight back', 'f <- function(x) x', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('through return', 'f <- function(x) return(x)', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('through invisible', 'f <- function(x) invisible(x)', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('through a local', 'f <- function(x) { y <- x; y }', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('a branch is not always the result', 'f <- function(x, flag) if(flag) x else NULL', { flag: ArgProp.Forced });
	testRoles('nor is a conditional return', 'f <- function(x, flag) { if(flag) return(x); NULL }', { flag: ArgProp.Forced });
	testRoles('a formal only read is not returned', 'f <- function(x) nchar(x)', { x: ArgProp.Forced | ArgProp.Shape });
	testRoles('a formal that is called', 'f <- function(xs, FUN) lapply(xs, FUN)', { xs: ArgProp.Forced | ArgProp.Value, FUN: ArgProp.Forced | ArgProp.Callee });
	testRoles('through do.call', 'f <- function(FUN, args) do.call(FUN, args)', { FUN: ArgProp.Forced | ArgProp.Callee, args: ArgProp.Forced | ArgProp.Value });
	testRoles('a formal only asked about', 'f <- function(a) missing(a)', { a: ArgProp.Presence | ArgProp.Lazy });
	testRoles('hasArg asks the same thing', 'f <- function(a) hasArg(a)', { a: ArgProp.Presence | ArgProp.Lazy });
	testRoles('match.call reaches every formal', 'f <- function(x, y) as.list(match.call())', { x: ArgProp.Nse | ArgProp.Lazy, y: ArgProp.Nse | ArgProp.Lazy });
	testRoles('a frame that escapes may hold any value', 'f <- function(x, y) as.list(environment())', { x: ArgProp.Value, y: ArgProp.Value });
	testRoles('environment(other) is another frame', 'f <- function(x, g) environment(g)', { x: ArgProp.Lazy, g: ArgProp.Forced | ArgProp.Handle });
	testRoles('sys.call keeps what the body states too', 'f <- function(x) { print(sys.call()); x }', { x: ArgProp.Forced | ArgProp.Alias | ArgProp.Nse });
	testRoles('nargs sees only that an argument was there', 'f <- function(x, y) nargs()', { x: ArgProp.Presence | ArgProp.Lazy, y: ArgProp.Presence | ArgProp.Lazy });
	testRoles('a copy modified in place is not the argument', 'f <- function(x) { x[1] <- 2; x }', { x: ArgProp.Forced });
	testRoles('nor is one an attribute was set on', 'f <- function(x) { attr(x, "a") <- 1; x }', { x: ArgProp.Forced });
	testRoles('a part taken out of it is not it either', 'f <- function(x) x$a', { x: ArgProp.Forced | ArgProp.Value });
	testRoles('a name holding the result of agreeing branches is', 'f <- function(x) { y <- if(TRUE) x else x; y }', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('a formal called under another name is still called', 'f <- function(g) { h <- g; h() }', { g: ArgProp.Forced | ArgProp.Callee });
	testRoles('print hands back what it printed', 'f <- function(x) print(x)', { x: ArgProp.Forced | ArgProp.Alias });

	testRoles('a frame followed to a name states only that name', 'f <- function(x, y) { e <- environment(); get("x", envir = e) }', { x: ArgProp.Forced | ArgProp.Alias | ArgProp.Value, y: ArgProp.Lazy });
	/* counterexamples: what the walk has to get right beyond the straightforward cases */
	testRoles('a formal overwritten before the end is not the result', 'f <- function(x) { x <- 1; x }', { x: ArgProp.Lazy });
	testRoles('nor is one overwritten on the way', 'f <- function(x) { y <- x; y <- 2; y }', { x: ArgProp.Forced });
	testRoles('branches agreeing on the formal make it the result', 'f <- function(x, c) if(c) x else x', { x: ArgProp.Alias, c: ArgProp.Forced });
	testRoles('branches disagreeing do not', 'f <- function(x, y, c) if(c) x else y', { c: ArgProp.Forced });
	testRoles('a constant condition is no condition', 'f <- function(x) if(TRUE) x', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('a quoted formal is read as written, not evaluated', 'f <- function(x) quote(x)', { x: ArgProp.Nse | ArgProp.Lazy });
	testRoles('so is a substituted one', 'f <- function(x) substitute(x)', { x: ArgProp.Nse | ArgProp.Lazy });
	testRoles('a named argument states what its own parameter does', 'f <- function(e) assign("z", 1, envir = e)', { e: ArgProp.Forced | ArgProp.Written });
	testRoles('local hands back what it was given', 'f <- function(x) local(x)', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('a caught block is evaluated but may not come back', 'f <- function(x) tryCatch(x, error = function(e) NULL)', { e: ArgProp.Lazy, x: ArgProp.Forced | ArgProp.Value });
	testRoles('a formal the body calls is a callee', 'f <- function(g) g()', { g: ArgProp.Forced | ArgProp.Callee });
	testRoles('a formal only computed with is not', 'f <- function(x) x + 1', { x: ArgProp.Forced | ArgProp.Value | ArgProp.Atomic });

	testRoles('a name it cannot follow loses the frame', 'f <- function(x, nm) { e <- environment(); get(nm, envir = e) }', { x: ArgProp.Value, nm: ArgProp.Value });


	/* what the body states about the function itself, not about one of its formals */
	testProps('a body handing back an invisible result', 'f <- function(x) invisible(x)', [CallProp.Invisible | CallProp.Strict]);
	testProps('through a return', 'f <- function(x) return(invisible(x))', [CallProp.Invisible | CallProp.Strict]);
	testProps('a value of its own is visible', 'f <- function() 1', [CallProp.Strict]);
	testProps('only one branch invisible is not enough', 'f <- function(c) if(c) invisible(1) else 2', [CallProp.Strict]);
	testProps('both branches invisible are', 'f <- function(c) if(c) invisible(1) else invisible(2)', [CallProp.Invisible | CallProp.Strict]);
	testProps('an assignment is invisible and binds a local', 'f <- function() { y <- 1 }', [CallProp.Invisible | CallProp.Strict]);
	testProps('a super-assignment reaches beyond the frame', 'f <- function() { x <<- 1 }', [CallProp.Invisible | CallProp.Scope | CallProp.Strict]);
	testProps('what its calls do it does too', 'f <- function() runif(1)', [CallProp.Random | CallProp.Strict]);
	testProps('reading a file included', 'f <- function() read.csv("a")', [CallProp.File | CallProp.Reads | CallProp.Strict]);
	testProps('throwing included', 'f <- function() stop("x")', [CallProp.Throws | CallProp.Strict]);
	testProps('a dispatching body is a generic', 'f <- function(x) UseMethod("f")', [CallProp.Generic | CallProp.Strict]);
	testProps('printing hands back invisibly', 'f <- function(x) print(x)', [CallProp.Invisible | CallProp.Prints | CallProp.Strict]);

	/* strictness, as the bits that carry it: `Forced` when every call evaluates it, `Lazy` when none can */
	testRoles('a parameter it computes with is forced', 'f <- function(x) x + 1', { x: ArgProp.Forced | ArgProp.Value | ArgProp.Atomic });
	testRoles('one it ignores is lazy', 'f <- function(x) 1', { x: ArgProp.Lazy });
	testRoles('an else-less if may hand back NULL instead', 'f <- function(x) if(runif(1) > .5) x', {});
	testRoles('an assignment forces what it stores', 'f <- function(x) { y <- x }', { x: ArgProp.Forced | ArgProp.Alias });
	testRoles('a dead branch never forces', 'f <- function(x) if(FALSE) x else 1', { x: ArgProp.Lazy });
	testRoles('a quoted parameter is not evaluated', 'f <- function(x) quote(x)', { x: ArgProp.Nse | ArgProp.Lazy });
	testRoles('the callee decides for an argument passed on', 'g <- function(y) y\nf <- function(x) g(x)', { y: ArgProp.Forced | ArgProp.Alias, x: ArgProp.Forced });
	testRoles('a callee leaving it alone makes it lazy', 'g <- function(y) 1\nf <- function(x) g(x)', { y: ArgProp.Lazy, x: ArgProp.Lazy });
	testRoles('each parameter is answered on its own', 'f <- function(x, y) x', { x: ArgProp.Forced | ArgProp.Alias, y: ArgProp.Lazy });
	testProps('a function forcing every parameter is strict', 'f <- function(x) x + 1', [CallProp.Strict]);
	testProps('one leaving a parameter alone is not', 'f <- function(x, y) x', []);

	/* counterexamples: a replacement call rebinds its target in the frame it runs in, as a plain assignment does */
	testProps('a part assigned on a local changes no scope', 'f1 <- function(x) { x$a <- 1; x }', [CallProp.Strict]);
	testProps('nor does setting names', 'f <- function(x) { names(x) <- "n"; x }', [CallProp.Strict]);
	testProps('nor any of the other replacements', 'f <- function(x) { x[1] <- 1; attr(x, "k") <- 1; class(x) <- "a"; levels(x) <- 1; x }', [CallProp.Strict]);
	testProps('a super-assigning replacement does', 'f <- function(x) { names(x) <<- "n"; x }', [CallProp.Scope | CallProp.Strict]);
	testProps('so does a super-assignment of the formal', 'f <- function(x) { x <<- 5; 1 }', [CallProp.Scope]);
	testProps('and attaching a package', 'f <- function(x) { library(stats); x }', [CallProp.Scope | CallProp.Strict]);

	/* the formals of the same bodies, so a fix to one half cannot quietly move the other */
	testRoles('a default keeps the other formals apart', 'f <- function(x, y = 2) x', { x: ArgProp.Forced | ArgProp.Alias, y: ArgProp.Lazy });
	testRoles('a deparsed formal is read as written', 'f1 <- function(x) deparse(substitute(x))', { x: ArgProp.Nse | ArgProp.Lazy });
	testRoles('a formal only asked to be there', 'f2 <- function(x) if (missing(x)) 1 else 2', { x: ArgProp.Presence | ArgProp.Lazy });

	test(label('the filter narrows the definitions', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('f <- function(x) x\ng <- function(y) 1');
		const result = await analyzer.query([{ type: 'inspect-fn-props', filter: ['2@function'] }]);
		assert.deepStrictEqual(Object.values(result['inspect-fn-props'].roles).flatMap(r => Object.values(r)), [ArgProp.Lazy]);
	});

	/* the options narrow what is inferred and what comes back */
	test(label('only the formals, or only the function', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('f <- function(x) invisible(x)');
		const args = await analyzer.query([{ type: 'inspect-fn-props', only: 'arguments' }]);
		assert.deepStrictEqual(args['inspect-fn-props'].props, {});
		assert.isNotEmpty(args['inspect-fn-props'].roles);
		const fn = await analyzer.query([{ type: 'inspect-fn-props', only: 'function' }]);
		assert.deepStrictEqual(fn['inspect-fn-props'].roles, {});
		assert.deepStrictEqual(Object.values(fn['inspect-fn-props'].props), [CallProp.Invisible | CallProp.Strict]);
	});

	test(label('a named formal alone', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('f <- function(x, y) x');
		const result = await analyzer.query([{ type: 'inspect-fn-props', formals: ['y'] }]);
		assert.deepStrictEqual(Object.values(result['inspect-fn-props'].roles).flatMap(r => Object.values(r)), [ArgProp.Lazy]);
	});

	test(label('named properties alone', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('f <- function(x) invisible(x)');
		const result = await analyzer.query([{ type: 'inspect-fn-props', props: ['Alias', 'Invisible'] }]);
		assert.deepStrictEqual(Object.values(result['inspect-fn-props'].roles).flatMap(r => Object.values(r)), [ArgProp.Alias]);
		assert.deepStrictEqual(Object.values(result['inspect-fn-props'].props), [CallProp.Invisible]);
	});

	/** What the query states about each definition of the program, keyed by the definition as it is written. */
	function testEachProps(name: string, code: string, expected: Readonly<Record<string, CallProps>>) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-fn-props' }]);
			const idMap = (await analyzer.normalize()).idMap;
			const found: Record<string, CallProps> = {};
			for(const [id, props] of Object.entries(result['inspect-fn-props'].props)) {
				found[idMap.get(Number(id))?.info.fullLexeme ?? id] = props;
			}
			/* the words make a mismatch readable, the numbers are what is compared */
			const words = (of: Record<string, CallProps>) => Object.fromEntries(Object.entries(of).map(([n, p]) => [n, CallProps.words(p).join('+')]));
			assert.deepStrictEqual(words(found), words(expected));
			assert.deepStrictEqual(found, { ...expected });
		});
	}

	/* what a function calls it does too, however many calls of the program lie in between */
	testEachProps('throwing carries over a call', 'g <- function(y) stop(y)\nh <- function(z) g(z)', {
		'function(y) stop(y)': CallProp.Throws | CallProp.Strict,
		'function(z) g(z)':    CallProp.Throws | CallProp.Strict
	});
	testEachProps('and over a chain of them', 'g <- function(y) stop(y)\nh <- function(z) g(z)\ni <- function(z) h(z)', {
		'function(y) stop(y)': CallProp.Throws | CallProp.Strict,
		'function(z) g(z)':    CallProp.Throws | CallProp.Strict,
		'function(z) h(z)':    CallProp.Throws | CallProp.Strict
	});
	testEachProps('drawing at random does as well', 'k <- function() runif(1)\nm <- function() k()', {
		'function() runif(1)': CallProp.Random | CallProp.Strict,
		'function() k()':      CallProp.Random | CallProp.Strict
	});
	testEachProps('so does writing a file', 'w <- function(p) write.csv(p, "a.csv")\nv <- function(p) w(p)', {
		'function(p) write.csv(p, "a.csv")': CallProp.Invisible | CallProp.File | CallProp.Writes | CallProp.Strict,
		'function(p) w(p)':                  CallProp.Invisible | CallProp.File | CallProp.Writes | CallProp.Strict
	});
	testEachProps('a recursive definition states what it reaches', 'rec <- function(n) if(n > 0) rec(n - 1) else stop("d")', {
		'function(n) if(n > 0) rec(n - 1) else stop("d")': CallProp.Throws | CallProp.Strict
	});
	testEachProps('a call to a definition doing nothing of note adds nothing', 'pl <- function(x) x + 1\npl2 <- function(x) pl(x)', {
		'function(x) x + 1': CallProp.Strict,
		'function(x) pl(x)': CallProp.Strict
	});

	/* a query that could only answer with nothing is refused rather than run */
	describe('refused queries', () => {
		const refuse = (name: string, query: object) => test(label(name, ['name-normal'], ['other']), () => {
			assert.isDefined(InspectFnPropsQueryDefinition.schema.validate({ type: 'inspect-fn-props', ...query }).error);
		});
		const accept = (name: string, query: object) => test(label(name, ['name-normal'], ['other']), () => {
			assert.isUndefined(InspectFnPropsQueryDefinition.schema.validate({ type: 'inspect-fn-props', ...query }).error);
		});

		refuse('no formal at all', { formals: [] });
		refuse('no property at all', { props: [] });
		refuse('a property nothing states', { props: ['Nope'] });
		refuse('formals of the half that has none', { only: 'function', formals: ['x'] });
		refuse('call properties of the formals', { only: 'arguments', props: ['Invisible'] });
		refuse('argument properties of the function', { only: 'function', props: ['Alias'] });
		accept('an argument property while asking for both', { props: ['Alias'] });
		accept('nothing at all', {});
	});
}));
