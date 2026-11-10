import { assert, describe, test } from 'vitest';
import path from 'path';
import { withShell, withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { queryCase, runQuery } from '../_helper/query';
import { RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FunctionGuards } from '../../../src/dataflow/fn/guards/function-guards';
import type { FormalClaim } from '../../../src/dataflow/fn/guards/guard-claims';
import { ArgProp } from '../../../src/dataflow/environments/built-in-props';
import { FunctionSemantics } from '../../../src/dataflow/fn/function-semantics';
import { InspectFnGuardsQueryDefinition } from '../../../src/queries/catalog/inspect-fn-guards-query/inspect-fn-guards-query-format';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { RBaseGuards } from '../../../src/data/r-base-guards.generated';
import { builtInGuards, reasonsOf } from '../../../src/dataflow/fn/guards/built-in-guards';
import { claimWords, returnConditions, returnWords } from '../../../src/dataflow/fn/guards/guard-claims';
import { FlowrConfig } from '../../../src/config';
import { RValueType } from '../../../src/dataflow/environments/guard-facts';
import { BuiltInProcName } from '../../../src/dataflow/environments/built-in-proc-name';

/** The programs to check against R as well, with what the query made of them. */
const Checked: { readonly code: string, readonly guards: FunctionGuards | undefined }[] = [];

/** What the query says about `f`, which is the last definition of the program. */
async function guardsOfF(parser: KnownParser, code: string, config?: FlowrConfig): Promise<FunctionGuards | undefined> {
	const { result, analyzer } = await runQuery(parser, code, { type: 'inspect-fn-guards' }, config);
	const definitions = (await analyzer.dataflow()).graph.vertexIdsOfType(VertexType.FunctionDefinition).filter(NodeId.isWritten);
	return result.guards[Math.max(...definitions.map(Number))];
}

describe('Inspect Function Guards Query', withTreeSitter(parser => {
	/** Compares what `f` asks of its calls, and what of that fails before any side effect (all of it, if left out). */
	function guards(code: string, requires: string, pure = requires) {
		test(label(code, ['name-normal'], ['other']), async() => {
			const found = await guardsOfF(parser, code);
			Checked.push({ code, guards: found });
			assert.strictEqual(found?.requires ?? '', requires, 'requires');
			assert.strictEqual(found?.pure ?? '', pure, 'pure');
		});
	}

	/** Compares what is claimed about the formals of `f`, leaving out what is not given. */
	function claims(code: string, expected: Readonly<Record<string, FormalClaim>>, required?: readonly string[]) {
		test(label(`claims of ${code}`, ['name-normal'], ['other']), async() => {
			const found = await guardsOfF(parser, code);
			Checked.push({ code, guards: found });
			assert.deepStrictEqual(found?.formals ?? {}, expected);
			if(required !== undefined) {
				assert.deepStrictEqual(found?.required ?? [], required);
			}
		});
	}

	/** Compares what is claimed about the value `f` returns, and the formal it hands back unchanged. */
	function returns(code: string, expected: FormalClaim | undefined, passes?: string) {
		test(label(`returns of ${code}`, ['name-normal'], ['other']), async() => {
			const found = await guardsOfF(parser, code);
			Checked.push({ code, guards: found });
			assert.deepStrictEqual(found?.returns, expected);
			assert.strictEqual(found?.passes, passes);
		});
	}

	/* the guards as they are commonly written */
	guards('f <- function(x) { if(!is.numeric(x)) stop("must be numeric"); x }', 'is.numeric(x)');
	guards('f <- function(x) { stopifnot(is.numeric(x), x > 0); x }', 'is.numeric(x) && (!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x > 0)');
	guards('f <- function(x) { stopifnot("must" = is.character(x)); stopifnot(exprs = { length(x) == 1; nchar(x) > 0 }); x }', 'is.character(x) && length(x) == 1 && all(nchar(x) > 0)');

	/* what an earlier return skips, and what a branch asks only of itself */
	guards('f <- function(x, a) { if(a) return(1); if(!is.numeric(x)) stop("a"); x }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a) && (as.logical(unclass(a)) || is.numeric(x))');
	guards('f <- function(x, a) { if(a) { if(is.null(x)) stop("n") } else { stop("b") }; 1 }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a) && !is.null(x) && as.logical(unclass(a))');
	guards('f <- function(x) { for(i in x) { if(is.null(x)) stop("n") }; 1 }', '!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x)');

	/* boolean structure */
	guards('f <- function(x) { if(is.null(x) || length(x) != 1) stop("a"); 2 }', '!is.null(x) && length(x) == 1');
	guards('f <- function(x) { if(!is.null(x) && x < 0) stop("a"); 2 }', '(is.null(x) || !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && (is.null(x) || x >= 0)');
	guards('f <- function(x) { is.numeric(x) || stop("a"); 2 }', 'is.numeric(x)');
	guards('f <- function(x) { is.numeric(x) && stop("a"); 2 }', '!is.numeric(x)');
	guards('f <- function(x) { if(is.numeric(x)) 1 else stop("no") }', 'is.numeric(x)');
	guards('f <- function(x) { if(any(x < 0)) stop("no"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x >= 0)');
	guards('f <- function(x) { if(!all(x > 0)) stop("no"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x > 0)');
	guards('f <- function(x) { stopifnot(!any(is.na(x))); 1 }', 'all(!is.na(x))');
	guards('f <- function(x) { stopifnot(x > 0 | x < -1); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x > 0 | x < -1)');
	guards('f <- function(x) { stopifnot(x > 0 & x < 5); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x > 0) && all(x < 5)');
	guards('f <- function(x) { if(isTRUE(x)) 1 else stop("x") }', 'isTRUE(x)');
	guards('f <- function(x) { if(isFALSE(is.numeric(x))) stop("x"); 1 }', '!isFALSE(is.numeric(x))');
	guards('f <- function(x) { if(x) stop("x"); 1 }', 'length(x) >= 1 && length(x) <= 1 && !is.na(x) && !as.logical(unclass(x))');
	guards('f <- function(x) { stopifnot(x); 1 }', 'all(x)');

	/* what a formal holds by the time of the guard */
	guards('f <- function(x) { x <- as.character(x); if(!is.character(x)) stop("x"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && is.character(as.character(x))');
	guards('f <- function(x) { y <- x; if(!is.numeric(y)) stop("x"); 1 }', 'is.numeric(x)');
	guards('f <- function(x) { n <- length(x); if(n != 1) stop("x"); 1 }', 'length(x) == 1');
	guards('f <- function(x) { x <- x + 1; if(x < 0) stop("x"); 1 }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)) && x + 1 >= 0');
	guards('f <- function(x) { x[1] <- 0; if(x < 0) stop("x"); 1 }', '!is.function(x) && !is.environment(x) && !is.symbol(x) || is.object(x)');
	guards('f <- function(x, c) { if(c) x <- 1; if(!is.numeric(x)) stop("n"); 1 }', 'length(c) >= 1 && length(c) <= 1 && !is.na(c) && (as.logical(unclass(c)) || is.numeric(x))');

	/* values from a set */
	guards('f <- function(x = c("a", "b")) { x <- match.arg(x); x }', 'succeeds(match.arg(x, c("a", "b")))');
	guards('f <- function(x) { match.arg(x, c("alpha", "beta")); 1 }', 'succeeds(match.arg(x, c("alpha", "beta")))');
	guards('f <- function(x = c("a", "b")) { match.arg(x, several.ok = TRUE); 1 }', 'succeeds(match.arg(x, several.ok = TRUE))');
	guards('f <- function(x = c("a", "b")) { x <- rlang::arg_match(x); x }', 'succeeds(rlang::arg_match(x, c("a", "b")))');
	guards('f <- function(x) { rlang::arg_match0(x, c("a", "b")); 1 }', 'succeeds(rlang::arg_match0(x, c("a", "b")))');
	guards('f <- function(x) { if(!(x %in% c("a", "b"))) stop("n"); 1 }', 'x %in% c("a", "b")');
	guards('f <- function(x) { if(x != "a" && x != "b") stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && (x == "a" || x == "b")');
	guards('f <- function(x) { if(!is.element(x, c("a", "b"))) stop("n"); 1 }', 'is.element(x, c("a", "b"))');
	guards('f <- function(x) { switch(x, a = 1, b = 2, stop("no")) }', 'length(x) == 1 && !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) && !is.pairlist(x) && (!is.character(x) || x %in% c("a", "b"))');
	guards('f <- function(x) { switch(x, a = , b = 2, stop("no")) }', 'length(x) == 1 && !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) && !is.pairlist(x) && (!is.character(x) || x %in% c("a", "b"))');
	guards('f <- function(x) { switch(x, a = stop("no"), b = 2) }', 'length(x) == 1 && !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) && !is.pairlist(x) && (!is.character(x) || !x %in% "a")');
	guards('f <- function(x) { switch(x, a = return(1), b = 2); if(is.null(x)) stop("n"); 1 }', 'length(x) == 1 && !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) && !is.pairlist(x)');

	/* presence */
	guards('f <- function(x) { if(missing(x)) stop("gimme"); 1 }', '!missing(x)');
	guards('f <- function(x = 1) { if(!missing(x) && !is.numeric(x)) stop("n"); 1 }', 'missing(x) || is.numeric(x)');
	guards('f <- function(x) { if(missing(x)) x <- 1; force(x); 1 }', '');
	guards('f <- function(x) { force(x); 1 }', '');

	/* types and classes */
	guards('f <- function(x) { if(!inherits(x, "data.frame")) stop("n"); 1 }', 'inherits(x, "data.frame")');
	guards('f <- function(x) { if(!inherits(x, c("foo", "data.frame"))) stop("n"); 1 }', 'inherits(x, c("foo", "data.frame"))');
	guards('f <- function(x) { if(class(x) != "foo") stop("n"); 1 }', 'class(x) == "foo"');
	guards('f <- function(x) { if(typeof(x) != "double") stop("n"); 1 }', 'typeof(x) == "double"');
	guards('f <- function(x) { if(!(typeof(x) %in% c("double", "integer"))) stop("n"); 1 }', 'typeof(x) %in% c("double", "integer")');
	guards('f <- function(x) { if(mode(x) != "numeric") stop("n"); 1 }', 'mode(x) == "numeric"');
	guards('f <- function(x) { if(is.numeric(x) || is.character(x)) 1 else stop("n") }', 'is.numeric(x) || is.character(x)');
	guards('f <- function(x) { if(!is.data.frame(x)) stop("n"); 1 }', 'is.data.frame(x)');
	guards('f <- function(x) { if(!is.function(x)) stop("n"); x(); 1 }', 'is.function(x)');
	guards('f <- function(x) { if(nrow(x) < 1) stop("n"); 1 }', 'nrow(x) >= 1');
	guards('f <- function(x) { if(nchar(x) == 0) stop("n"); 1 }', 'nchar(x) != 0');
	guards('f <- function(x) { if(1 > x) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && 1 <= x');
	guards('f <- function(x) { if(length(x) == 0) stop("n"); 1 }', 'length(x) != 0');
	guards('f <- function(x) { if(length(x) > 3) stop("n"); 1 }', 'length(x) <= 3');
	guards('f <- function(x) { if(identical(x, "a")) 1 else stop("no") }', 'identical(x, "a")');

	/* what R fails on by itself */
	guards('f <- function(x) { x + 1 }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)');
	guards('f <- function(x, y) { x + y }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x) || is.object(y)) && (is.null(dim(x)) || is.null(dim(y)) || length(x) == length(y) || is.object(x) || is.object(y)) && (!is.null(dim(x)) || is.call(x) || is.null(dim(y)) || length(y) <= 1 || length(x) <= length(y) || is.object(x) || is.object(y)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y) || is.object(x)) && (is.null(dim(y)) || is.null(dim(x)) || length(y) == length(x) || is.object(y) || is.object(x)) && (!is.null(dim(y)) || is.call(y) || is.null(dim(x)) || length(x) <= 1 || length(y) <= length(x) || is.object(y) || is.object(x))');
	guards('f <- function(x) { -x + 1L }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)');
	guards('f <- function(x) { x > 1 }', '!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)');
	guards('f <- function(x) { !x }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.raw(x) || length(x) == 0 || is.object(x)');
	guards('f <- function(x) { x && TRUE }', '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1');
	guards('f <- function(x) { TRUE || x }', '');
	guards('f <- function(x) { FALSE || x }', '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1');
	guards('f <- function(x) { if(x) 1 else 2 }', 'length(x) >= 1 && length(x) <= 1 && !is.na(x)');
	guards('f <- function(x) { sum(x) }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)');
	guards('f <- function(x, y) { sum(x, y, 1) }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y))');
	guards('f <- function(x) { sqrt(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && !identical(oldClass(x), "difftime") && (is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x))');
	guards('f <- function(x) { log(x) }', '');
	guards('f <- function(x) { round(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && (is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x))');
	guards('f <- function(x) { trunc(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && (is.numeric(x) || is.logical(x) || is.object(x))');
	guards('f <- function(x) { floor(x) + ceiling(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && (is.numeric(x) || is.logical(x) || is.object(x))');
	guards('f <- function(x) { sign(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && (is.numeric(x) || is.logical(x) || is.object(x))');
	guards('f <- function(x) { gamma(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && !identical(oldClass(x), "difftime") && (is.numeric(x) || is.logical(x) || is.object(x))');
	guards('f <- function(x) { cos(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && !identical(oldClass(x), "difftime") && (is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x))');
	guards('f <- function(x) { cumsum(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && !identical(oldClass(x), "difftime") && (!is.function(x) && !is.environment(x) && !is.language(x) || is.object(x))');
	guards('f <- function(x) { cummax(x) }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && !identical(oldClass(x), "difftime") && (!is.function(x) && !is.environment(x) && !is.language(x) || is.object(x)) && (!is.complex(x) || length(x) == 0 || is.object(x))');
	guards('f <- function(x) { if(trunc(x) != x) stop("whole"); 1 }', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && (is.numeric(x) || is.logical(x) || is.object(x)) && (!is.function(x) && !is.environment(x) || is.object(x) || is.object(trunc(x))) && trunc(x) == x');
	guards('f <- function(x) { x$a }', 'is.null(x) || is.recursive(x) && !is.function(x) || is.object(x)');
	guards('f <- function(x) { x$a <- 1; x }', '!is.function(x) && !is.symbol(x) || is.object(x)');
	guards('f <- function(x) { x[1] }', '!is.function(x) && !is.environment(x) && !is.symbol(x) || is.object(x)');
	guards('f <- function(x) { x[[1]] }', '!is.function(x) && !is.symbol(x) || is.object(x)');
	guards('f <- function(x) { strsplit(x, "") }', 'is.character(x)');
	guards('f <- function(x) { startsWith(x, "a") }', 'is.character(x)');
	guards('f <- function(x) { basename(x) }', 'is.character(x)');
	guards('f <- function(x) { file.exists(x) }', 'is.character(x)');
	guards('f <- function(x) { which(x) }', 'is.logical(x)');
	guards('f <- function(x) { sprintf(x) }', 'is.character(x)');
	guards('f <- function(x) { do.call(sum, x) }', 'is.list(x)');
	guards('f <- function(x) { apply(x, 1, sum) }', '!is.null(dim(x))');
	guards('f <- function(x) { new.env(parent = x) }', 'is.environment(x)');
	guards('f <- function(x) { assign(x, 1); 1 }', '');

	/* what has to be callable, a function of the same name letting everything through */
	guards('f <- function(FUN) { FUN(1) }', 'is.function(FUN) || exists("FUN", mode = "function")');
	guards('f <- function(c) { c(1) }', '');
	guards('f <- function(FUN) { lapply(1:2, FUN) }', 'is.function(FUN) || is.character(FUN) && exists(FUN, mode = "function") || is.symbol(FUN) || exists("FUN", mode = "function")');
	guards('f <- function(FUN) { sapply(list(), FUN) }', 'is.function(FUN) || is.character(FUN) && exists(FUN, mode = "function") || is.symbol(FUN) || exists("FUN", mode = "function")');
	guards('f <- function(c) { lapply(1:2, c) }', '');
	guards('f <- function(what) { do.call(what, list()) }', 'is.function(what) || is.character(what) && exists(what, mode = "function") || is.symbol(what) || exists("what", mode = "function")');
	guards('f <- function(FUN) { match.fun(FUN) }', 'is.function(FUN) || is.character(FUN) && exists(FUN, mode = "function") || is.symbol(FUN) || exists("FUN", mode = "function")');
	guards('f <- function(FUN) { Reduce(FUN, 1:3) }', '');

	/* names spelled out at run time */
	guards('fn_a <- function() 1\nf <- function(x) { do.call(paste0("fn_", x), list()) }', 'exists(paste0("fn_", x), mode = "function")');
	guards('fn_a <- function() 1\nf <- function(x) { get(paste0("fn_", x), mode = "function")() }', 'exists(paste0("fn_", x), mode = "function")');
	guards('fn_a <- function() 1\nf <- function(x) { h <- match.fun(paste0("fn_", x)); h() }', 'exists(paste0("fn_", x), mode = "function")');
	guards('sum2 <- 1\nf <- function(x) { get(x); 1 }', '(is.character(x) || is.symbol(x)) && exists(x)');

	/* what is inherited from what is called for sure */
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { g(x) }', 'is.numeric(x)');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { h <- g(x); 1 }', 'is.numeric(x)');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x, a) { if(a) g(x); 1 }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a) && (!as.logical(unclass(a)) || is.numeric(x))');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { g(as.character(x)); 1 }', 'is.numeric(as.character(x))');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { tryCatch(g(x), error = function(e) 1); 1 }', '');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { try(g(x), silent = TRUE); 1 }', '');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { k <- function() g(x); 1 }', '');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { identity(g(x)); 1 }', 'is.numeric(x)');
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { lz <- function(a) 1; lz(g(x)); 1 }', '');
	guards('g <- function(y = 1) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { g(); 1 }', '');
	guards('g <- function(a, y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x) { g(y = x, a = 1); 1 }', 'is.numeric(x)');
	guards('g <- function(y, ...) { if(!is.numeric(y)) stop("y"); y }; f <- function(...) { g(...); 1 }', '');
	guards('g <- function(y) { if(missing(y)) stop("y"); 1 }; f <- function(x) { g(x); 1 }', '!missing(x)');
	guards('g <- function(y) { if(missing(y)) stop("y"); 1 }; f <- function(x) { g(); 1 }', 'FALSE');
	guards('g <- function(y) { if(y > 0) { h2(y) }; 1 }; h2 <- function(z) { stopifnot(is.numeric(z)); 1 }; f <- function(x) { g(x); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && (x <= 0 || is.numeric(x))');

	/* predicates are seen through */
	guards('is_pos <- function(v) is.numeric(v) && v > 0; f <- function(x) { if(!is_pos(x)) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && is.numeric(x) && x > 0');
	guards('is_pos <- function(v) { return(is.numeric(v)) }; f <- function(x) { stopifnot(is_pos(x)); 1 }', 'is.numeric(x)');

	/* recursion has to end */
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); g(y) }; f <- function(x) { 1 }', '');
	guards('g <- function(y) if(is.null(y)) y else g(NULL); f <- function(x) { g(x); 1 }', '');
	guards('g <- function(y = c("u", "v")) { y <- match.arg(y); y }; f <- function(x) { g(x); 1 }', 'succeeds(match.arg(x, c("u", "v")))');

	/* redefinitions */
	guards('is.numeric <- function(x) TRUE; f <- function(x) { if(!is.numeric(x)) stop("n"); 1 }', '');
	guards('stop <- function(...) NULL; f <- function(x) { if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { stop <- function(...) 1; if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(is.numeric) { if(!is.numeric(1)) stop("n"); 1 }', '');

	/* what does not end in a failure, or may not be reached */
	guards('f <- function(x) { if(is.null(x)) warning("w"); 1 }', '');
	guards('f <- function(x) { tryCatch({ if(is.null(x)) stop("w") }, error = function(e) 1); 2 }', '');
	guards('f <- function(x) { tryCatch({ return(1) }, error = function(e) 1); if(is.null(x)) stop("a"); 2 }', '');
	guards('f <- function(x) { withCallingHandlers({ if(is.null(x)) stop("w") }, warning = function(e) 1); 2 }', '');
	guards('f <- function(x) { lapply(1:2, function(i) { if(is.null(x)) stop("w") }); 2 }', '');
	guards('f <- function(x) { lapply(list(), function(i) stop("w")); 2 }', '');
	guards('f <- function(x) { k <- function() stop("n"); if(is.null(x)) 1 else 2 }', '');
	guards('f <- function(x) { while(is.null(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { repeat { if(is.null(x)) stop("n"); break }; 1 }', '');
	guards('f <- function(x) { for(i in 1:2) { if(i == 1) next; return(1) }; if(is.null(x)) stop("n"); 1 }', '');

	/* ways through */
	guards('f <- function(x, y) { if(is.null(y)) return(1) else if(is.null(x)) stop("n"); 2 }', 'is.null(y) || !is.null(x)');
	guards('f <- function(x, y) { if(is.null(y)) { return(1) } else { 2 }; if(is.null(x)) stop("n"); 3 }', 'is.null(y) || !is.null(x)');
	guards('f <- function(x, y) { if(is.null(y)) return(1); if(is.null(x)) return(2); stop("always") }', 'is.null(y) || is.null(x)');
	guards('f <- function(x) { stop("always") }', 'FALSE');
	guards('f <- function(x) { 1; if(FALSE) stop("never"); 2 }', '');
	guards('f <- function(x) { if(TRUE) stop("always") }', 'FALSE');

	/* what comes with an effect */
	guards('f <- function(x) { on.exit(print(1)); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x, y = stop("miss")) { if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x, y = is.null(x)) { if(y) stop("n"); 1 }', 'length(y) >= 1 && length(y) <= 1 && !is.na(y) && !as.logical(unclass(y))');
	guards('f <- function(x) { eval(quote(x <- 1)); if(is.null(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { if(!requireNamespace("rlang", quietly = TRUE)) stop("n"); 1 }', '');
	guards('LIM <- 3; f <- function(x) { if(x > LIM) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && x <= 3');
	guards('f <- function(x) { x |> is.null() |> isFALSE() |> stopifnot(); 1 }', '');
	guards('f <- function(x) { if(is.null(x)) stop("n") else if(!is.numeric(x)) stop("m"); 1 }', '!is.null(x) && is.numeric(x)');
	guards('f <- function(x, y) { if(length(x) != length(y)) stop("n"); 1 }', 'length(x) == length(y)');
	guards('f <- function(x) { if(x$a > 1) stop("n"); 1 }', '(is.null(x) || is.recursive(x) && !is.function(x) || is.object(x)) && x$a <= 1');
	guards('f <- function(x) { if(is.na(x)) stop("n"); 1 }', '!is.na(x)');
	guards('f <- function(x) { if(anyNA(x)) stop("n"); 1 }', '!anyNA(x)');
	guards('f <- function(x) { if(!is.numeric(x)) { message("oops"); stop("n") }; 1 }', 'is.numeric(x)', '');

	/* packages providing checks */
	guards('f <- function(x) { checkmate::assert_numeric(x); 1 }', 'succeeds(checkmate::assert_numeric(x))');
	guards('f <- function(x) { checkmate::assert_string(x); 1 }', 'succeeds(checkmate::assert_string(x))');
	guards('f <- function(x) { checkmate::assert_flag(x, na.ok = TRUE); 1 }', 'succeeds(checkmate::assert_flag(x, na.ok = TRUE))');
	guards('f <- function(x) { checkmate::assertNumber(x, null.ok = TRUE); 1 }', 'succeeds(checkmate::assertNumber(x, null.ok = TRUE))');
	guards('f <- function(x) { c <- checkmate::makeAssertCollection(); checkmate::assert_numeric(x, add = c); 1 }', '');
	guards('f <- function(x) { checkmate::assert_choice(x, c("a", "b")); 1 }', 'succeeds(checkmate::assert_choice(x, c("a", "b")))');
	guards('f <- function(x) { checkmate::assert_function(x); 1 }', 'succeeds(checkmate::assert_function(x))');
	guards('f <- function(x) { checkmate::assert_data_frame(x); 1 }', 'succeeds(checkmate::assert_data_frame(x))');
	guards('f <- function(x) { assertthat::assert_that(is.numeric(x), msg = "n"); 1 }', 'is.numeric(x)');
	guards('library(assertthat); f <- function(x) { assert_that(is.character(x), length(x) == 1); 1 }', 'is.character(x) && length(x) == 1');
	guards('f <- function(x) { if(!rlang::is_string(x)) stop("n"); 1 }', 'rlang::is_string(x)');
	guards('f <- function(x) { if(!rlang::is_bool(x)) rlang::abort("n"); 1 }', 'rlang::is_bool(x)');

	/* dispatch */
	guards('g <- function(x) UseMethod("g"); g.foo <- function(x) 1; f <- function(x) { g(x); 2 }', 'succeeds(UseMethod("g", x))');
	guards('g <- function(x) UseMethod("g"); g.default <- function(x) 1; f <- function(x) { g(x); 2 }', '');

	/* counterexamples: a frame written to behind the back of the dataflow */
	guards('f <- function(x) { assign("x", 1); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { assign("x", "a", envir = environment()); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { e <- environment(); e$x <- "a"; if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { e <- environment(); assign("x", "a", envir = e); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { list2env(list(x = "a"), envir = environment()); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { local(x <<- "a"); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { h <- function() x <<- "a"; h(); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { eval(parse(text = "x <- \'a\'")); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { evalq(x <- "a"); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { delayedAssign("x", "a"); if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { rm(x); if(!exists("x", inherits = FALSE)) 1 else stop("n") }', '');
	guards('f <- function(x) { h <- function() assign("x", "a", envir = parent.frame()); h(); if(!is.character(x)) stop("n"); 1 }', '');

	/* counterexamples: overwriting formals */
	guards('f <- function(x) { for(x in "a") 1; if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { x = "a"; if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { "a" -> x; if(!is.character(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { x <- 1; if(FALSE) x <- 2; if(!is.numeric(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { names(x) <- "a"; if(is.null(names(x))) stop("n"); 1 }', '');
	guards('f <- function(x, y) { y <- x; x <- "a"; if(!is.numeric(y)) stop("n"); 1 }', 'is.numeric(x)');
	guards('f <- function(x, y) { n <- length(x); x <- 1:5; if(n != 1) stop("n"); 1 }', 'length(x) == 1');

	/* counterexamples: odd places for a guard */
	guards('f <- function(x) { if(is.numeric(x <- "a")) stop("n"); 1 }', '');
	guards('f <- function(x) { if(!is.numeric(x)) return(0) else stop("n"); 1 }', '!is.numeric(x)');
	guards('f <- function(x) { y <- if(is.null(x)) stop("n") else 1; y }', '!is.null(x)');
	guards('f <- function(x) { y <- print(if(is.null(x)) stop("n") else 1); y }', '!is.null(x)');
	guards('f <- function(x) { list(a = if(is.null(x)) stop("n")); 1 }', '');
	guards('f <- function(x) { invisible(stopifnot(is.numeric(x))); 1 }', 'is.numeric(x)');
	guards('f <- function(x) { suppressWarnings(stopifnot(is.numeric(x))); 1 }', 'is.numeric(x)');
	guards('f <- function(x) { suppressWarnings({ if(is.null(x)) stop("n") }); 1 }', '!is.null(x)');
	guards('f <- function(x) { (if(is.null(x)) stop("n")); 1 }', '!is.null(x)');
	guards('f <- function(x) { { { if(is.null(x)) stop("n") } }; 1 }', '!is.null(x)');

	/* counterexamples: code that does not run */
	guards('f <- function(x) { function() stopifnot(is.null(x)); 1 }', '');
	guards('f <- function(x) { quote(stopifnot(is.null(x))); 1 }', '');
	guards('f <- function(x) { substitute(stopifnot(is.null(x))); 1 }', '');
	guards('f <- function(x) { bquote(stopifnot(is.null(x))); 1 }', '');
	guards('f <- function(x) { expression(stopifnot(is.null(x))); 1 }', '');
	guards('f <- function(x) { lz <- function(a) if(FALSE) a; lz(stopifnot(is.null(x))); 1 }', '');
	guards('f <- function(x) { if(FALSE && stop("n")) 1; 1 }', '');
	guards('f <- function(x) { if(TRUE || stop("n")) 1; 1 }', '');
	guards('f <- function(x) { ifelse(is.null(x), stop("n"), 1); 1 }', '');
	guards('f <- function(x) { vapply(x, function(i) { stopifnot(is.numeric(i)); 1 }, 1); 1 }', '');
	guards('f <- function(x) { Recall; 1 }', '');

	/* counterexamples: stopifnot on its own terms */
	guards('f <- function(x) { stopifnot(); 1 }', '');
	guards('f <- function(x) { stopifnot(TRUE, is.null(x)); 1 }', 'is.null(x)');
	guards('f <- function(x) { stopifnot(is.null(x), local = TRUE); 1 }', '');
	guards('f <- function(x) { stopifnot(NULL); 1 }', '');
	guards('f <- function(x) { stopifnot(c(a = is.null(x))); 1 }', 'all(c(a = is.null(x)))');
	guards('f <- function(x) { stopifnot(all.equal(x, 1)); 1 }', 'all(all.equal(x, 1))');
	guards('f <- function(x) { if(is.null(x)) { return(invisible(NULL)) }; if(!is.numeric(x)) stop("n"); 1 }', 'is.null(x) || is.numeric(x)');
	guards('f <- function(x, y) { if(!missing(y)) { if(!is.numeric(y)) stop("n") }; 1 }', 'missing(y) || is.numeric(y)');
	guards('f <- function(x, y = NULL) { if(!is.null(y) && !is.numeric(y)) stop("n"); 1 }', 'is.null(y) || is.numeric(y)');
	guards('f <- function(x, ...) { stopifnot(...length() > 0); 1 }', '');
	guards('f <- function(...) { args <- list(...); stopifnot(length(args) > 0); 1 }', '');
	guards('f <- function(x, ...) { if(nargs() > 3) stop("n"); 1 }', '');
	guards('f <- function(x) { UseMethod("f") }; f.default <- function(x) 1', '');
	guards('f <- function(x) { x <- unclass(x); stopifnot(is.numeric(x)); 1 }', 'is.numeric(unclass(x))');
	guards('f <- function(x) { stopifnot(is.numeric(y <- x)); y }', '');
	guards('f <- function(x) { h <- function(a = stop("h")) 1; h(); 1 }', '');
	guards('f <- function(x) { h <- function(a = stop("h")) a; h(); 1 }', '');
	guards('f <- function(x) { g2 <- function(u) if(u) stop("g"); g2(x) ; 1 }', 'length(x) >= 1 && length(x) <= 1 && !is.na(x) && !as.logical(unclass(x))');

	/* truthiness and comparisons */
	guards('f <- function(x) { if(length(x)) stop("n"); 1 }', '!length(x)');
	guards('f <- function(x) { if(!length(x)) stop("n"); 1 }', 'length(x)');
	guards('f <- function(x) { if(nchar(x)) stop("n"); 1 }', '!nchar(x)');
	guards('f <- function(x) { if(!nzchar(x)) stop("n"); 1 }', '!is.function(x) && !is.environment(x) && nzchar(x)');
	guards('f <- function(x) { if(x == "a") stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x != "a"');
	guards('f <- function(x) { if(x != "a") stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x == "a"');
	guards('f <- function(x) { if(x == 1) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x != 1');
	guards('f <- function(x) { if(!is.na(x) && x > 1) stop("n"); 1 }', '(is.na(x) || !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && (is.na(x) || x <= 1)');
	guards('f <- function(x) { if(xor(is.null(x), is.numeric(x))) stop("n"); 1 }', '!xor(is.null(x), is.numeric(x))');
	guards('f <- function(x) { if(is.numeric(x) & x > 1) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && (!is.numeric(x) || x <= 1)');
	guards('f <- function(x) { if(is.numeric(x) | is.character(x)) 1 else stop("n") }', 'is.numeric(x) || is.character(x)');
	guards('f <- function(x) { stopifnot(is.numeric(x) || is.character(x)); 1 }', 'is.numeric(x) || is.character(x)');
	guards('f <- function(x) { stopifnot(is.numeric(x) && length(x) == 1); 1 }', 'is.numeric(x) && length(x) == 1');
	guards('f <- function(x) { stopifnot(x %in% c(1, 2)); 1 }', 'all(x %in% c(1, 2))');
	guards('f <- function(x) { stopifnot(length(x) > 0, all(x %in% c("a", "b"))); 1 }', 'length(x) > 0 && all(x %in% c("a", "b"))');
	guards('f <- function(x) { if(any(!x %in% c("a", "b"))) stop("n"); 1 }', 'all(x %in% c("a", "b"))');
	guards('f <- function(x) { if(!all(x %in% c("a", "b"))) stop("n"); 1 }', 'all(x %in% c("a", "b"))');
	guards('f <- function(x) { if(any(c(TRUE, x))) stop("n"); 1 }', 'all(!c(TRUE, x))');
	guards('f <- function(x) { if(any(x, na.rm = TRUE)) stop("n"); 1 }', '(!is.function(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && !any(x, na.rm = TRUE)');
	guards('f <- function(x) { if(isTRUE(all.equal(x, 1))) stop("n"); 1 }', '!isTRUE(all.equal(x, 1))');

	/* class checks that say nothing or little */
	guards('f <- function(x) { if(inherits(x, "foo")) stop("n"); 1 }', '!inherits(x, "foo")');
	guards('f <- function(x) { if(inherits(x, what = "foo", which = TRUE)) stop("n"); 1 }', '!inherits(x, what = "foo", which = TRUE)');
	guards('f <- function(x) { if(!inherits(x, "foo", which = TRUE)) stop("n"); 1 }', 'inherits(x, "foo", which = TRUE)');
	guards('f <- function(x) { if(!is(x, "numeric")) stop("n"); 1 }', 'is(x, "numeric")');
	guards('f <- function(x) { if(!methods::is(x, "numeric")) stop("n"); 1 }', 'is(x, "numeric")');
	guards('f <- function(x) { if(class(x)[1] != "foo") stop("n"); 1 }', 'class(x)[1] == "foo"');
	guards('f <- function(x) { if(!("foo" %in% class(x))) stop("n"); 1 }', '"foo" %in% class(x)');
	guards('f <- function(x) { if(!("a" %in% x)) stop("n"); 1 }', '"a" %in% x');
	guards('f <- function(x) { if(length(x) != 1L) stop("n"); 1 }', 'length(x) == 1L');
	guards('f <- function(x) { if(length(x) < 1.5) stop("n"); 1 }', 'length(x) >= 1.5');
	guards('f <- function(x) { if(NROW(x) < 2) stop("n"); 1 }', 'NROW(x) >= 2');
	guards('f <- function(x) { if(x > 1 || x < -1) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && x <= 1 && x >= -1');
	guards('f <- function(x) { if(-1 > x) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && -1 <= x');
	guards('f <- function(x) { if(x > 5) return(1); if(x < 0) stop("n"); 2 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && (x > 5 || x >= 0)');
	guards('f <- function(x) { s <- "a"; if(x != s) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x == "a"');
	guards('f <- function(x) { v <- c("a", "b"); if(!(x %in% v)) stop("n"); 1 }', 'x %in% c("a", "b")');

	/* a default is no restriction */
	guards('f <- function(x, choices = c("a", "b")) { if(!(x %in% choices)) stop("n"); 1 }', 'x %in% choices');
	guards('f <- function(x) { if(x |> is.null()) stop("n"); 1 }', '!is.null(x)');
	guards('f <- function(x) { x |> is.null(); if(is.list(x)) stop("n"); 1 }', '!is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', '!is.null(...names()) || is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(y = x, ...) }', 'is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(...) { g(...) }', '');
	guards('f <- function(x) { if(!is.finite(x)) stop("n"); 1 }', '(is.atomic(x) || is.null(x) || is.object(x)) && is.finite(x)');
	guards('f <- function(x) { if(is.na(x)) stop("n"); 1 }', '!is.na(x)');
	guards('f <- function(x) { if(is.na(x)) return(1); 2 }', '');
	guards('f <- function(x) { with(list(x = 1), stopifnot(is.character(x))); 1 }', '');
	guards('f <- function(x) { within(data.frame(x = 1), if(is.character(x)) stop("n")); 1 }', '');
	guards('f <- function(x) { transform(data.frame(x = 1), y = if(is.numeric(x)) stop("n")); 1 }', '');
	guards('f <- function(x) { subset(data.frame(x = 1), is.character(x) || stop("n")); 1 }', '');
	guards('f <- function(x) { system.time(if(is.null(x)) stop("n")); 1 }', '');
	guards('f <- function(x) { sapply(1, function(x) stopifnot(is.character(x))); 1 }', '');
	guards('g <- function() stop("a"); f <- function(x) { if(is.null(x)) g(); 1 }', '!is.null(x)');
	guards('g <- function() stop("a"); f <- function(x) { g(); 1 }', 'FALSE');
	guards('f <- function(x) { inner <- function() stopifnot(is.numeric(x)); inner(); 1 }', 'is.numeric(x)');
	guards('f <- function(x) { inner <- function() stopifnot(is.numeric(x)); x <- "a"; inner(); 1 }', '');
	guards('f <- function(x) { inner <- function() stopifnot(is.numeric(x)); x <- 1; inner(); 1 }', '');
	guards('f <- function(x, a) { inner <- function() stopifnot(is.numeric(x)); if(a) x <- 1; inner(); 1 }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a)');
	guards('f <- function(x) { inner <- function(x) stopifnot(is.numeric(x)); inner(1); 1 }', '');
	guards('y <- 1; g <- function() stopifnot(is.numeric(y)); f <- function(y) { g(); 1 }', '');
	guards('g <- function(y) { stopifnot(is.list(y)); y }; h <- function(k, x) k(x); h(g, list()); f <- function(k, x) { k(x) }; f(g, list())', 'is.function(k) || exists("k", mode = "function")');
	guards('g <- function(y) { stopifnot(is.list(y)); y }; f <- function(k, x) { inner <- function() k(x); inner(); 1 }; f(g, list())', '');
	guards('g <- function(y) { stopifnot(is.list(y)); y }; f <- function(k, x) { if(FALSE) k(1); is_l <- k; is_l(x); 1 }; f(g, list())', '');
	guards('g <- function(y) { is.list(y) }; f <- function(k, x) { if(!k(x)) stop("n"); 1 }; f(g, list())', '(is.function(k) || exists("k", mode = "function")) && k(x)', 'is.function(k) || exists("k", mode = "function")');
	guards('g <- function(o) UseMethod(paste0("g")); g.foo <- function(o) 1; f <- function(x) { g(x); 2 }', 'succeeds(UseMethod("g", x))');
	guards('g <- function(o) UseMethod("g"); g.default <- (function(o) 1); f <- function(x) { g(x); 2 }', '');
	guards('g <- function(o) UseMethod("g"); g.default <<- function(o) 1; f <- function(x) { g(x); 2 }', '');
	guards('g <- function(o) UseMethod("g"); g.default <- { function(o) 1 }; f <- function(x) { g(x); 2 }', '');
	guards('LIM <- 3; LIM <- 4; f <- function(x) { if(x > LIM) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && x <= 4');
	guards('f <- function(x) { if(x > LIM) stop("n"); 1 }; LIM <- 3', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && x <= 3');
	guards('f <- function(x) { if(x > LIM) stop("n"); 1 }; if(FALSE) LIM <- 3', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x) || is.object(LIM)) && x <= LIM');
	guards('g <- function(y) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', 'is.list(x)');
	guards('g <- function(a, b) { stopifnot(is.list(a), is.character(b)); a }; f <- function(x, z, ...) { g(x, z, ...) }', 'is.list(x) && is.character(z)');
	guards('g <- function(a, b = 1) { stopifnot(is.list(a), is.numeric(b)); a }; f <- function(x, ...) { g(x, ...) }', '!is.null(...names()) || is.list(x)');
	guards('g <- function(y, ...) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', '!is.null(...names()) || is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(..., x) }', '');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v) { h(v) }', 'is.list(v)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v, ...) { h(v, ...) }', '');
	guards('g <- function(y) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v) { h(v) }', 'is.list(v)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(z = 2, x, ...) }', 'is.list(x)');
	guards('g <- function(y, z) { if(!is.list(y)) stop("n"); y }; f <- function(x, ...) { k <- function() g(x, ...); k() }', '');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v) { h(v, q = 1) }', '');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v) { h(v) }', 'is.list(v)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v) { h(v, y = list()) }', '');
	guards('f <- function(x = 1L) { stopifnot(is.character(x)); x }', 'is.character(x)');
	guards('f <- function(x) { stopifnot(length(x) > 0.5); 1 }', 'length(x) > 0.5');
	guards('f <- function(x) { stopifnot(length(x) < 1.5); 1 }', 'length(x) < 1.5');
	guards('f <- function(x) { stopifnot(length(x) >= 1.5); 1 }', 'length(x) >= 1.5');
	guards('f <- function(x) { stopifnot(length(x) <= 1.5); 1 }', 'length(x) <= 1.5');
	guards('f <- function(x) { stopifnot(nchar(x) > 0.5); 1 }', 'all(nchar(x) > 0.5)');
	guards('f <- function(x) { stopifnot(nrow(x) > 0); 1 }', 'all(nrow(x) > 0)');
	guards('f <- function(x, y) { stopifnot(xor(x, y)); 1 }', 'all(xor(x, y))');
	guards('g <- function(x, m) { if(is.matrix(x)) stopifnot(is.numeric(m) || is.null(m)); x }; f <- function(x) g(x, "a")', '!is.matrix(x)');
	guards('g <- function(x, m) { stopifnot(is.object(m) || is.vector(m)); x }; f <- function(x) g(x, 2L)', '');
	guards('g <- function(x, m) { stopifnot(is.atomic(m), !is.null(x)); x }; f <- function(x) g(x, NULL)', 'FALSE');
	guards('f <- function(x) { stopifnot(x %in% 1:3); x }', 'all(x %in% 1:3)');
	guards('f <- function(x) { stopifnot(x == 1:2); x }', '(!is.function(x) && !is.environment(x) || is.object(x) || is.object(1:2)) && all(x == 1:2)');
	guards('f <- function(x) { stopifnot(x %in% -(1:3)); x }', 'all(x %in% -(1:3))');
	guards('f <- function(x) { stopifnot(x > 0, x > 5); x }', '(!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x > 0) && all(x > 5)');
	guards('f <- function(x) { stopifnot(is.numeric(x), x > 5); x }', 'is.numeric(x) && (!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && all(x > 5)');
	guards('f <- function(x) { stopifnot(x == TRUE); x }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x == TRUE)');
	guards('f <- function(x) { stopifnot(is.logical(x), x == TRUE); x }', 'is.logical(x) && all(x == TRUE)');
	guards('f <- function(x) { stopifnot(x == 1); x }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x == 1)');
	guards('f <- function(x) { stopifnot(is.integer(x), x == 1); x }', 'is.integer(x) && all(x == 1)');
	guards('f <- function(`my x`) { stopifnot(is.numeric(`my x`)); 1 }', 'is.numeric(`my x`)');
	guards('f <- function(x) { stopifnot(isTRUE(all.equal(x, 1))); x }', 'isTRUE(all.equal(x, 1))');

	/* what comes with an effect */
	guards('f <- function(x) { on.exit(return(5)); stopifnot(is.numeric(x)); 1 }', '');

	/* what comes with an effect */
	guards('f <- function(x) { on.exit({ if(TRUE) return(7) }); stopifnot(is.numeric(x)); 1 }', '');
	guards('f <- function(x) { do.call(on.exit, list(quote(return(9)))); stopifnot(is.numeric(x)); 1 }', '');

	/* what comes with an effect */
	guards('f <- function(x) { on.exit(print("done")); stopifnot(is.numeric(x)); 1 }', 'is.numeric(x)', '');
	guards('f <- function(x) { stopifnot(is.environment(x)); 1 }', 'is.environment(x)');
	guards('f <- function(x) { if(is.environment(x)) stop("e"); 1 }', '!is.environment(x)');
	guards('f <- function(x) { stopifnot(inherits(x, "function")); 1 }', 'inherits(x, "function")');
	guards('f <- function(x) { if(is.integer(x)) stop("a"); 1 }', '!is.integer(x)');
	guards('f <- function(x) { if(any(x)) stop("a"); 1 }', '(!is.function(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && !any(x)');
	guards('f <- function(x) { stopifnot(!x); 1 }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.raw(x) || length(x) == 0 || is.object(x)) && all(!x)');
	guards('f <- function(x) { stopifnot(exists("x")); 1 }', 'exists("x")');
	guards('f <- function(x) { if(!(exists("x"))) stop("a"); 1 }', 'exists("x")');
	guards('f <- function(x) { `!` <- function(a) a; if(!is.numeric(x)) stop("a"); 1 }', '');
	guards('f <- function(x) { `>` <- function(a, b) TRUE; stopifnot(x > 0); 1 }', '');
	guards('f <- function(x) { `(` <- function(a) TRUE; stopifnot((is.numeric(x))); 1 }', '');
	guards('f <- function(x, a) { if(a) is.numeric <- function(y) TRUE; stopifnot(is.numeric(x)); 1 }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a)');
	guards('f <- function(x, return) { if(is.null(x)) return(1); stopifnot(is.numeric(x)); 1 }', 'is.null(x) || is.numeric(x)', '');
	guards('f <- function(x, stop) { if(is.null(x)) stop("a"); 1 }', '');
	guards('f <- function(x) { if(is.null(x)) stop("a"); stopifnot(!is.integer(x)); 1 }', '!is.null(x) && !is.integer(x)');
	guards('f <- function(x, g) { Reduce(g, x) }', '');
	guards('f <- function(x, g) { Filter(g, x) }', 'is.function(g) || is.character(g) && exists(g, mode = "function") || is.symbol(g) || exists("g", mode = "function")');
	guards('f <- function(x) { if(is.numeric(x) && length(x) == 1L && x > 0) x <- 1; x }', '!is.numeric(x) || length(x) != 1L || !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)');
	guards('f <- function(x, m) { if(is.numeric(x) && length(x) == 1L && x > 0) x <- seq_len(x); n <- length(x); if(n < m) stop("n < m"); 1 }', '(!is.numeric(x) || length(x) != 1L || !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && (!is.numeric(x) || length(x) != 1L || x <= 0 || is.atomic(x) && !is.raw(x) && length(x) >= 1) && (is.numeric(x) && length(x) == 1L && x > 0 || !is.function(m) && !is.environment(m) && !is.symbol(m) && !is.call(m) || is.object(m) || is.object(length(x))) && (is.numeric(x) && length(x) == 1L && x > 0 || length(x) >= m)');
	guards('f <- function(x) { if(is.null(x)) x <- 1; stopifnot(is.numeric(x)); x }', 'is.null(x) || is.numeric(x)');
	guards('f <- function(x, y) { if(y) x <- "a"; if(!is.character(x)) stop("c"); x }', 'length(y) >= 1 && length(y) <= 1 && !is.na(y) && (as.logical(unclass(y)) || is.character(x))');
	guards('f <- function(x) { if(is.character(x)) x <- nchar(x); for(i in 1:2) x <- x + 1; stopifnot(x > 0); x }', '');
	guards('f <- function(x, s) { if(is.numeric(x)) x <- seq_len(x); if(s) { if(is.factor(x)) x <- as.integer(x) }; x[1] }', '(!is.numeric(x) || is.atomic(x) && !is.raw(x) && length(x) >= 1) && (is.numeric(x) || as.logical(unclass(s)) || !is.function(x) && !is.environment(x) && !is.symbol(x) || is.object(x)) && length(s) >= 1 && length(s) <= 1 && !is.na(s)');
	guards('f <- function(x, a, b) { if(a) x <- 1; if(b) x <- "z"; stopifnot(is.character(x)); x }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a) && (as.logical(unclass(a)) || as.logical(unclass(b)) || is.character(x)) && length(b) >= 1 && length(b) <= 1 && !is.na(b)');
	guards('f <- function(FUN, extra) { if(missing(extra)) FUN(1) else FUN(1, extra) }', 'is.function(FUN) || exists("FUN", mode = "function")');
	guards('f <- function(x, ...) UseMethod("f"); f.default <- function(x, center = TRUE) { stopifnot(is.numeric(x)); x }; f.foo <- function(x, ...) 1', '');
	guards('f <- function(x) UseMethod("f"); f.default <- function(x) { stopifnot(is.numeric(x)); x }; f.character <- function(x) { if(length(x) != 1) stop("one"); 1 }', 'length(x) == 1');
	guards('f <- function(x) UseMethod("f"); f.matrix <- function(x) { stopifnot(nrow(x) > 1); 1 }; f.default <- function(x) { stopifnot(is.numeric(x)); 1 }', 'is.numeric(x)');
	guards('f <- function(x, y = 1) UseMethod("f"); f.default <- function(x, y = 2) { stopifnot(y > 1); 1 }', '(!is.function(y) && !is.environment(y) && !is.symbol(y) && !is.call(y) || is.object(y)) && all(y > 1)');
	guards('f <- function(x) { x <- 1; UseMethod("f") }; f.default <- function(x) { stopifnot(is.character(x)); 1 }', 'is.character(x)');
	guards('g <- function(x) UseMethod("g"); g.default <- function(x) { stopifnot(is.numeric(x)); x }; f <- function(z) g(z)', 'is.object(z) || is.numeric(z)');
	guards('g <- function(x, y) UseMethod("g"); g.default <- function(x, y) { stopifnot(is.numeric(y)); 1 }; g.foo <- function(x, y) 1; f <- function(z) g(1, z)', 'is.numeric(z)');
	guards('g <- function(x, y) UseMethod("g"); g.default <- function(x, y) { stopifnot(is.numeric(y)); 1 }; g.foo <- function(x, y) NextMethod(); g.bar <- function(x, y) 2; f <- function(z) g(structure(1, class = "foo"), z)', 'is.numeric(z)');
	guards('Ops.foo <- function(e1, e2) { stopifnot(is.numeric(unclass(e2))); 1 }; f <- function(x, y) x + y', '(!identical(oldClass(x), "foo") || is.object(y) || is.numeric(unclass(y))) && (!identical(oldClass(y), "foo") || is.object(x) || is.numeric(unclass(y))) && (is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x) || is.object(y)) && (is.null(dim(x)) || is.null(dim(y)) || length(x) == length(y) || is.object(x) || is.object(y)) && (!is.null(dim(x)) || is.call(x) || is.null(dim(y)) || length(y) <= 1 || length(x) <= length(y) || is.object(x) || is.object(y)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y) || is.object(x)) && (is.null(dim(y)) || is.null(dim(x)) || length(y) == length(x) || is.object(y) || is.object(x)) && (!is.null(dim(y)) || is.call(y) || is.null(dim(x)) || length(x) <= 1 || length(y) <= length(x) || is.object(y) || is.object(x))');
	guards('`+.foo` <- function(e1, e2) 1; Ops.foo <- function(e1, e2) stop("no"); f <- function(x, y) x + y', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x) || is.object(y)) && (is.null(dim(x)) || is.null(dim(y)) || length(x) == length(y) || is.object(x) || is.object(y)) && (!is.null(dim(x)) || is.call(x) || is.null(dim(y)) || length(y) <= 1 || length(x) <= length(y) || is.object(x) || is.object(y)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y) || is.object(x)) && (is.null(dim(y)) || is.null(dim(x)) || length(y) == length(x) || is.object(y) || is.object(x)) && (!is.null(dim(y)) || is.call(y) || is.null(dim(x)) || length(x) <= 1 || length(y) <= length(x) || is.object(y) || is.object(x))');
	guards('Math.foo <- function(x, ...) { if(length(x) > 1) stop("one"); 1 }; f <- function(x, d) round(d, x)', '(!identical(oldClass(d), "foo") || length(d) <= 1) && !identical(oldClass(d), "factor") && !identical(oldClass(d), c("ordered", "factor")) && (is.numeric(d) || is.logical(d) || is.complex(d) || is.object(d))');

	/* the primitives of the language: replacement functions, accessors, and what decides control flow */
	guards('f <- function(x, v) { names(x) <- v; x }', '(is.object(x) || is.null(v) || !is.null(x) && !is.function(x) && !is.environment(x) && !is.symbol(x)) && (is.object(x) || !is.function(v) && !is.environment(v)) && (is.object(x) || is.null(v) || length(v) <= length(x))');
	guards('f <- function(x, d) { dim(x) <- d; x }', '(is.object(x) || is.null(d) || is.atomic(x) || is.list(x) || is.expression(x)) && (is.object(x) || is.null(d) || is.atomic(d)) && (is.object(x) || is.null(d) || length(d) >= 1) && (is.object(x) || !anyNA(d)) && (is.object(x) || is.null(d) || prod(as.integer(d)) == length(x))');
	guards('f <- function(x, w, v) { attr(x, w) <- v; x }', '(is.null(v) || !is.null(x) && !is.symbol(x) && !is.primitive(x)) && is.character(w) && length(w) == 1 && !is.na(w) && nchar(w) >= 1');
	guards('f <- function(x, w) { attr(x, w) }', 'is.character(w) && length(w) == 1');
	guards('f <- function(x, v) { oldClass(x) <- v; x }', '(length(v) == 0 || !is.null(x) && !is.symbol(x) && !is.primitive(x)) && (is.character(v) || length(v) == 0)');
	guards('f <- function(x, v) { class(x) <- v; x }', '(is.null(v) || !is.null(x)) && (length(v) == 0 || !is.symbol(x) && !is.primitive(x)) && !is.function(v) && !is.environment(v)');
	guards('f <- function(x, v) { levels(x) <- v; x }', 'is.object(x) || is.null(v) || !is.null(x) && !is.symbol(x) && !is.primitive(x)');
	guards('f <- function(x, n) { length(x) <- n; x }', '(is.object(x) || !is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x)) && (is.object(x) || length(n) == 1) && (is.object(x) || is.numeric(n) || is.character(n) || is.object(n)) && (is.object(x) || !is.na(n)) && (is.object(x) || !is.numeric(n) || n > -1)');
	guards('f <- function(x, v) { dimnames(x) <- v; x }', '(is.object(x) || is.null(v) || !is.null(dim(x))) && (is.object(x) || is.null(v) || is.list(v))');
	guards('f <- function(x, v) { attributes(x) <- v; x }', '(length(v) == 0 || !is.symbol(x) && !is.primitive(x)) && (is.null(v) || is.list(v) && !is.pairlist(v))');
	guards('f <- function(g, e) { environment(g) <- e; g }', '(is.null(e) || !is.null(g) && !is.symbol(g)) && (is.environment(e) || is.null(e))');
	guards('f <- function(x, m) { storage.mode(x) <- m; x }', 'is.character(m) && length(m) >= 1');
	guards('f <- function(x, i) { x[[i]] <- 1; x }', '!is.function(x) && !is.symbol(x) || is.object(x)');
	guards('f <- function(x, d) { `dim<-`(x, d) }', '(is.object(x) || is.null(d) || is.atomic(x) || is.list(x) || is.expression(x)) && (is.object(x) || is.null(d) || is.atomic(d)) && (is.object(x) || is.null(d) || length(d) >= 1) && (is.object(x) || !anyNA(d)) && (is.object(x) || is.null(d) || prod(as.integer(d)) == length(x))');
	guards('f <- function(n, ...) { ...elt(n) }', '(is.numeric(n) || is.logical(n) || is.object(n)) && length(n) == 1 && !is.na(n) && n >= 1 && trunc(n) <= ...length()');
	guards('f <- function(e) { switch(e, a = 1, 2) }', 'length(e) == 1 && !is.function(e) && !is.environment(e) && !is.symbol(e) && !is.call(e) && !is.pairlist(e)');
	guards('f <- function(s) { for(i in s) NULL; 1 }', '!is.function(s) && !is.environment(s) && !is.symbol(s) && !is.call(s)');
	guards('f <- function(a, b) { a:b }', 'length(a) >= 1 && (is.numeric(a) || is.logical(a) || is.complex(a) || is.character(a) || is.object(a)) && length(b) >= 1 && (is.numeric(b) || is.logical(b) || is.complex(b) || is.character(b) || is.object(b))');
	guards('f <- function(nm) { call(nm) }', 'is.character(nm) && length(nm) == 1 && (is.na(nm) || nchar(nm) >= 1)');
	guards('f <- function(x) { as.call(x) }', '(is.list(x) || is.call(x) || is.expression(x)) && length(x) >= 1');
	guards('f <- function(x) { .subset2(x, 1) }', '!is.function(x) && !is.symbol(x)');
	guards('f <- function(x) { .subset(x, 1) }', '!is.function(x) && !is.environment(x) && !is.symbol(x)');
	guards('f <- function(x) { as.environment(x) }', '');
	guards('f <- function(x) { pos.to.env(x) }', 'length(x) >= 1 && !anyNA(x)');
	guards('f <- function(FUN, y) { forceAndCall(1, FUN, y) }', 'is.function(FUN)');
	guards('f <- function(e) { substitute(x, e) }', 'is.null(e) || is.environment(e) || is.list(e)');
	guards('f <- function(a) { on.exit(NULL, add = a); 1 }', 'length(a) >= 1');
	guards('f <- function(name) { .Primitive(name) }', 'is.character(name) && length(name) == 1');
	guards('f <- function(x) { unCfillPOSIXlt(x) }', 'is.list(x) && length(unclass(x)) >= 9');
	guards('f <- function(a, b) a %*% b', '(is.numeric(a) || is.logical(a) || is.complex(a) || is.object(a) || is.object(b)) && (!is.matrix(a) || !is.matrix(b) || ncol(a) == nrow(b) || is.object(a) || is.object(b)) && (is.numeric(b) || is.logical(b) || is.complex(b) || is.object(b) || is.object(a))');
	guards('f <- function(a, b) crossprod(a, b)', '(is.numeric(a) || is.logical(a) || is.complex(a) || is.object(a) || is.object(b)) && (!is.matrix(a) || !is.matrix(b) || nrow(a) == nrow(b) || is.object(a) || is.object(b)) && (is.numeric(b) || is.logical(b) || is.complex(b) || is.null(b) || is.object(b) || is.object(a))');
	guards('f <- function(a, b) tcrossprod(a, b)', '(is.numeric(a) || is.logical(a) || is.complex(a) || is.object(a) || is.object(b)) && (!is.matrix(a) || !is.matrix(b) || ncol(a) == ncol(b) || is.object(a) || is.object(b)) && (is.numeric(b) || is.logical(b) || is.complex(b) || is.null(b) || is.object(b) || is.object(a))');
	guards('f <- function(x, y) x == y', '(!is.function(x) && !is.environment(x) || is.object(x) || is.object(y)) && (is.null(dim(x)) || is.null(dim(y)) || length(x) == length(y) || is.object(x) || is.object(y)) && (!is.null(dim(x)) || is.call(x) || is.null(dim(y)) || length(y) <= 1 || length(x) <= length(y) || is.object(x) || is.object(y)) && (!is.function(y) && !is.environment(y) || is.object(y) || is.object(x)) && (is.null(dim(y)) || is.null(dim(x)) || length(y) == length(x) || is.object(y) || is.object(x)) && (!is.null(dim(y)) || is.call(y) || is.null(dim(x)) || length(x) <= 1 || length(y) <= length(x) || is.object(y) || is.object(x))');
	guards('f <- function(x, y) x & y', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.raw(x) || is.null(x) || is.object(x) || is.object(y)) && (is.null(dim(x)) || is.null(dim(y)) || length(x) == length(y) || is.object(x) || is.object(y)) && (!is.null(dim(x)) || is.call(x) || is.null(dim(y)) || length(y) <= 1 || length(x) <= length(y) || is.object(x) || is.object(y)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.raw(y) || is.null(y) || is.object(y) || is.object(x)) && (is.null(dim(y)) || is.null(dim(x)) || length(y) == length(x) || is.object(y) || is.object(x)) && (!is.null(dim(y)) || is.call(y) || is.null(dim(x)) || length(x) <= 1 || length(y) <= length(x) || is.object(y) || is.object(x))');
	guards('f <- function(x, y) { if(x && y) 1 else 2 }', '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1 && (!as.logical(unclass(x)) || is.logical(y) || is.numeric(y) || is.complex(y) || is.object(y)) && (!as.logical(unclass(x)) || length(y) <= 1)');
	guards('f <- function(x, y) { if(x || y) 1 else 2 }', '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1 && (as.logical(unclass(x)) || is.logical(y) || is.numeric(y) || is.complex(y) || is.object(y)) && (as.logical(unclass(x)) || length(y) <= 1)');
	guards('f <- function(x) seq_len(x)', 'is.atomic(x) && !is.raw(x) && length(x) >= 1');
	guards('f <- function(x) enc2utf8(x)', 'is.character(x)');
	guards('f <- function(x) is.finite(x)', 'is.atomic(x) || is.null(x) || is.object(x)');
	guards('f <- function(x) as.call(x)', '(is.list(x) || is.call(x) || is.expression(x)) && length(x) >= 1');
	guards('f <- function(x) Re(x)', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x)');
	guards('f <- function(x) xtfrm(x)', '!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) && !is.raw(x) || is.object(x)');
	guards('f <- function(x) is.single(x)', 'FALSE');
	guards('f <- function(x) max(x)', 'is.numeric(x) || is.logical(x) || is.character(x) || is.null(x) || is.object(x)');
	guards('f <- function(x) nzchar(x)', '!is.function(x) && !is.environment(x)');
	guards('f <- function(x) sin(x)', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && !identical(oldClass(x), "difftime") && (is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x))');
	guards('f <- function(x) trunc(x)', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && (is.numeric(x) || is.logical(x) || is.object(x))');
	guards('f <- function(x) abs(x)', '!identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor")) && !identical(oldClass(x), "Date") && !identical(oldClass(x), c("POSIXct", "POSIXt")) && !identical(oldClass(x), c("POSIXlt", "POSIXt")) && (is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x))');
	guards('f <- function(x, y) x * y', '(!identical(oldClass(x), "difftime") || is.object(y) || !inherits(x, "difftime") || !inherits(y, "difftime")) && (!identical(oldClass(y), "difftime") || is.object(x) || !inherits(x, "difftime") || !inherits(y, "difftime")) && (is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x) || is.object(y)) && (is.null(dim(x)) || is.null(dim(y)) || length(x) == length(y) || is.object(x) || is.object(y)) && (!is.null(dim(x)) || is.call(x) || is.null(dim(y)) || length(y) <= 1 || length(x) <= length(y) || is.object(x) || is.object(y)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y) || is.object(x)) && (is.null(dim(y)) || is.null(dim(x)) || length(y) == length(x) || is.object(y) || is.object(x)) && (!is.null(dim(y)) || is.call(y) || is.null(dim(x)) || length(x) <= 1 || length(y) <= length(x) || is.object(y) || is.object(x))');
	guards('f <- function(x) !x', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.raw(x) || length(x) == 0 || is.object(x)');
	guards('f <- function(x, n) { if(ncol(x) != nrow(n)) stop("dims"); 1 }', 'ncol(x) == nrow(n)');
	guards('f <- function(x) { if(nlevels(x) < 2) stop("levels"); 1 }', 'nlevels(x) >= 2');

	/* what is claimed about the formals */
	const AnythingBut = (...not: readonly string[]) => ['NULL', 'logical', 'integer', 'double', 'complex', 'character', 'raw', 'list', 'pairlist', 'function', 'environment', 'symbol', 'language', 'expression', 'other'].filter(t => !not.includes(t));
	claims('f <- function(x) { if(!is.integer(x)) stop("n"); x }', { x: { types: ['integer'] } }, ['x']);
	claims('f <- function(x) { stopifnot(is.numeric(x)); x }', { x: { unclassedTypes: ['integer', 'double'] } }, ['x']);
	claims('f <- function(x) { if(is.null(x)) stop("n"); x }', { x: { types: AnythingBut('NULL') } }, ['x']);
	claims('f <- function(x) { if(is.numeric(x)) stop("n"); 1 }', {}, ['x']);
	claims('f <- function(x) { if(is.numeric(x) || is.character(x)) x else stop("n") }', { x: { unclassedTypes: ['integer', 'double', 'character'] } }, ['x']);
	claims('f <- function(x) { if(!is.data.frame(x)) stop("n"); 1 }', { x: { types: ['list'], unclassedTypes: [] } }, ['x']);
	claims('f <- function(x) { x + 1 }', { x: { unclassedTypes: ['NULL', 'logical', 'integer', 'double', 'complex'] } }, ['x']);
	claims('f <- function(x) { strsplit(x, "") }', { x: { types: ['character'] } }, ['x']);
	claims('f <- function(x) { if(!is.numeric(x)) stop("n"); x + 1 }', { x: { unclassedTypes: ['integer', 'double'] } }, ['x']);
	claims('f <- function(mode = c("fast", "slow")) { mode <- match.arg(mode); mode }', { mode: { types: ['NULL', 'character'], values: ['fast', 'slow'], partial: true } }, []);
	claims('f <- function(x) { if(!(x %in% c("a", "b"))) stop("n"); x }', { x: { values: ['a', 'b'] } }, ['x']);

	test('every condition a function checks itself is reported per formal', async() => {
		const code = 'f <- function(x, y) { stopifnot(is.numeric(x), x > 0, x %% 2 == 0); if(y < x) stop("n"); x + y }';
		const guards = await guardsOfF(parser, code);
		assert.deepStrictEqual(guards?.conditions, { x: ['is.numeric(x)', 'all(x > 0)', 'all(x %% 2 == 0)', 'y >= x'], y: ['y >= x'] });
	});

	test('what functions of R ask for', async() => {
		const { result } = await runQuery(parser, 'x', { type: 'inspect-fn-guards', builtIns: ['stats::cor', 'base::strsplit', 'base::sort', 'utils::combn', 'not::known', 'nonsense'] });
		const { builtIns = {} } = result;
		assert.deepStrictEqual(Object.keys(builtIns), ['stats::cor', 'base::strsplit', 'base::sort', 'utils::combn']);
		assert.deepStrictEqual(builtIns['stats::cor'].formals?.method.values, ['pearson', 'kendall', 'spearman']);
		assert.deepStrictEqual(builtIns['base::strsplit'].formals, { x: { types: ['character'] } });
		assert.deepStrictEqual(builtIns['base::sort'].formals?.decreasing.types, ['logical']);
		assert.deepStrictEqual(builtIns['utils::combn'].formals?.m.bounds, { length: [1, 1], value: [0, null] });
		assert.deepStrictEqual(claimWords(builtIns['utils::combn'].formals?.m ?? {}), ['integer or double, unless classed', 'length = 1', 'value >= 0']);
	});

	test('a relation between formals', async() => {
		const guards = await guardsOfF(parser, 'f <- function(x, m) { if(is.numeric(x) && length(x) == 1L && x > 0) x <- seq_len(x); n <- length(x); if(n < m) stop("n < m"); stopifnot(m <= 10, length(x) > m || m == 0); 1 }');
		assert.deepStrictEqual(guards?.relations.map(({ holds, formals, unless }) => ({ holds, formals, unless })), [
			{ holds: 'length(x) >= m', formals: ['x', 'm'], unless: 'is.numeric(x) && length(x) == 1L && x > 0' },
			{ holds: 'length(x) > m', formals: ['x', 'm'], unless: 'is.numeric(x) && length(x) == 1L && x > 0 || !is.function(m) && !is.environment(m) || is.object(m)' },
			{ holds: 'length(x) > m', formals: ['x', 'm'], unless: 'is.numeric(x) && length(x) == 1L && x > 0 || m == 0' }
		]);
		assert.deepStrictEqual(guards?.relations[0].unlessClaim, { formal: 'x', claim: { unclassedTypes: ['integer', 'double'], bounds: { length: [1, 1], value: [0, null] } } });
	});

	test('a claim that holds unless another formal lets the call through', async() => {
		const guards = await guardsOfF(parser, 'f <- function(package, character.only) { if(!missing(package)) stopifnot(is.logical(character.only)); 1 }');
		assert.deepStrictEqual(guards?.conditional, [{ formal: 'character.only', claim: { types: ['logical'] }, unless: 'missing(package)' }]);
	});

	test('a configuration teaches what a function checks', async() => {
		const code = 'f <- function(x) { stopifnot(is_text(x)); x }';
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.semantics.environment.overwriteBuiltIns.definitions = [{ type:      'function', names:     ['is_text'], processor: BuiltInProcName.DefaultReadAllArgs,
				config:    { guards: { is_text: { predicate: { yes: RValueType.Character, exact: true } } } } }];
		});
		const taught = await guardsOfF(parser, code, config);
		const plain = await guardsOfF(parser, code);
		assert.deepStrictEqual(taught?.formals?.x?.types, ['character']);
		assert.isUndefined(plain?.formals?.x?.types);
	});

	test('what R fails on by itself goes by the R version analyzed for', async() => {
		const inVersion = (version: string) => FlowrConfig.amend(FlowrConfig.default(), c => {
			c.solver.sigdb.assumedRVersion = version;
		});
		const condition = 'f <- function(x) { if(x) 1 else 2 }';
		assert.strictEqual((await guardsOfF(parser, condition, inVersion('4.1.3')))?.requires, 'length(x) >= 1 && (length(x) >= 2 || !is.na(x))');
		assert.strictEqual((await guardsOfF(parser, condition, inVersion('4.2.0')))?.requires, 'length(x) >= 1 && length(x) <= 1 && !is.na(x)');
		const operand = 'f <- function(x) { x && TRUE }';
		assert.strictEqual((await guardsOfF(parser, operand, inVersion('4.2.3')))?.requires, 'is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)');
		assert.strictEqual((await guardsOfF(parser, operand, inVersion('4.3.0')))?.requires, '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1');
		const atomic = 'f <- function(x) { if(!is.atomic(x)) stop("a"); x }';
		assert.deepStrictEqual((await guardsOfF(parser, atomic, inVersion('4.3.3')))?.formals.x?.types, ['NULL', 'logical', 'integer', 'double', 'complex', 'character', 'raw']);
		assert.deepStrictEqual((await guardsOfF(parser, atomic, inVersion('4.4.0')))?.formals.x?.types, ['logical', 'integer', 'double', 'complex', 'character', 'raw']);
	});

	test('a branch on a formal tells its cases apart', async() => {
		const guards = await guardsOfF(parser, 'f <- function(x, center = TRUE) { if(is.logical(center)) { if(center) 1 } else { if(length(center) != ncol(x)) stop("len"); 2 } }');
		const [logical, other] = guards?.formals.center?.cases ?? [];
		assert.strictEqual(logical?.when, 'is.logical(center)');
		assert.deepStrictEqual(logical?.claim, { types: ['logical'], bounds: { length: [1, 1] }, notNA: true });
		assert.strictEqual(other?.when, '!is.logical(center)');
		assert.deepStrictEqual(other?.relations?.map(r => r.holds), ['length(center) == ncol(x)']);
		assert.include(claimWords(guards?.formals.center ?? {}).join(', '), 'if is.logical(center): logical, length = 1, not NA');
	});

	test('a generic takes what its default method asks of a value without a class', async() => {
		const guards = await guardsOfF(parser, 'g <- function(x, ...) UseMethod("g"); g.default <- function(x, k = 1) { stopifnot(is.numeric(x)); x }; g.foo <- function(x, ...) 1; f <- function(y) g(y)');
		assert.strictEqual(guards?.requires, 'is.object(y) || is.numeric(y)');
		assert.deepStrictEqual(guards?.formals.y, { unclassedTypes: ['integer', 'double'] });
	});

	test('the table of the base packages relates generics and methods', () => {
		assert.include(FunctionSemantics.builtInGuards('scale', 'base')?.requires, 'is.object(x) ||');
		assert.include(RBaseGuards.base.scale?.methods ?? [], 'base::scale.default');
		assert.deepStrictEqual(RBaseGuards.base['scale.default']?.methodOf, { generic: 'base::scale', class: 'default' });
		assert.strictEqual(RBaseGuards.base.scale?.dispatches, 'x');
	});

	test('an operator takes the class of its other operand into account', async() => {
		const { result } = await runQuery(parser, 'x', { type: 'inspect-fn-guards', builtIns: ['+', 'stats::strsplit', 'foo::strsplit'] });
		assert.deepStrictEqual(Object.keys(result.builtIns ?? {}), ['+']);
		assert.include(result.builtIns?.['+'].requires, 'is.object(e2)');
	});

	test('the table of the base packages takes nothing from a default', () => {
		/* each of these only has a default of that type, and takes others just as well */
		for(const [pkg, name, formal] of [['utils', 'head', 'n'], ['base', 'round', 'digits'], ['base', 'paste', 'sep'], ['base', 'nchar', 'type'], ['base', 'seq_len', 'length.out']]) {
			assert.isUndefined(RBaseGuards[pkg]?.[name]?.formals?.[formal]?.types, `${pkg}::${name}`);
		}
	});

	/* a default states what happens without an argument, nothing about the arguments a call may give */
	claims('f <- function(x = 1) { x }', {}, []);
	claims('f <- function(x = 1L) { print(x); 2 }', {}, []);
	claims('f <- function(x = "a") { paste(x) }', {}, []);
	claims('f <- function(x = c("a", "b")) { list(x) }', {}, []);
	claims('f <- function(x = TRUE, n = 5L) { list(x, n) }', {}, []);
	claims('f <- function(n = 5L) { if(!is.numeric(n)) stop("n"); n }', { n: { unclassedTypes: ['integer', 'double'] } }, []);
	claims('f <- function(x = 1L) { stopifnot(is.character(x)); x }', { x: { types: ['character'] } }, []);
	claims('f <- function(x = NULL) { if(is.null(x)) 1 else x }', {}, []);

	/* a wrapper handing on its dots */
	/* a name reaches a formal behind the dots only spelled out in full, so here it ends up in the dots */
	claims('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ..., yy = 1) { g(x, ...) }; f <- function(v) { h(v, y = list()) }', {}, []);
	/* the dots a closure hands on are the ones of whoever holds them */
	claims('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { k <- function() g(x, ...); k() }', {}, []);
	claims('g <- function(y) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', { x: { types: ['list', 'pairlist'] } }, ['x']);
	claims('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', {}, []);
	claims('g <- function(y, ...) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', {}, []);
	claims('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(z = 2, x, ...) }', { x: { types: ['list', 'pairlist'] } }, ['x']);
	claims('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; h <- function(x, ...) { g(x, ...) }; f <- function(v) { h(v) }', { v: { types: ['list', 'pairlist'] } }, []);
	claims('f <- function(x) { if(x != "a" && x != "b") stop("n"); x }', { x: { unclassedTypes: AnythingBut('function', 'environment'), values: ['a', 'b'] } }, ['x']);
	claims('f <- function(x) { switch(x, a = 1, b = 2, stop("no")) }', { x: { types: ['logical', 'integer', 'double', 'complex', 'character', 'raw', 'list', 'expression', 'other'], values: ['a', 'b'], bounds: { length: [1, 1] } } }, ['x']);
	claims('f <- function(x, y = 1) { stopifnot(x > 0, x <= 5, length(y) == 1L); x }', { x: { unclassedTypes: AnythingBut('function', 'environment', 'symbol', 'language') }, y: { bounds: { length: [1, 1] } } }, ['x']);
	claims('f <- function(x) { stopifnot(is.numeric(x), x > 0, x <= 5); x }', { x: { unclassedTypes: ['integer', 'double'], bounds: { value: [0, 5] } } }, ['x']);
	claims('f <- function(x) { if(length(x) == 0) stop("n"); x }', { x: { bounds: { length: [1, null] } } }, ['x']);
	claims('f <- function(x) { if(nrow(x) > 3) stop("n"); x }', { x: { bounds: { nrow: [null, 3] } } }, ['x']);
	claims('f <- function(x) { if(!inherits(x, c("a", "b"))) stop("n"); x }', { x: { classes: ['a', 'b'] } }, ['x']);
	claims('f <- function(x) { if(class(x) != "a") stop("n"); x }', { x: { classes: ['a'] } }, ['x']);
	claims('f <- function(x) { if(typeof(x) != "closure") stop("n"); x }', { x: { types: ['function'] } }, ['x']);
	claims('f <- function(x) { if(!isTRUE(x)) stop("n"); x }', { x: { types: ['logical'], bounds: { length: [1, 1] } } }, ['x']);
	claims('f <- function(FUN) { FUN(1) }', { FUN: { callable: true } }, []);
	claims('f <- function(FUN, x) { lapply(x, FUN) }', { FUN: { callable: true } }, []);
	claims('f <- function(x) { if(!is.function(x)) stop("n"); x() }', { x: { types: ['function'], callable: true } }, ['x']);
	claims('fn_a <- function() 1\nfn_b <- function() 2\nvalue <- 1\nf <- function(x) { do.call(paste0("fn_", x), list()) }', {
		x: { resolves: [{ expression: 'paste0("fn_", x)', prefix: 'fn_', suffix: '', candidates: ['a', 'b'] }] }
	}, ['x']);
	claims('fn_a <- function() 1\nf <- function(x) { get(sprintf("fn_%s", x), mode = "function")() }', {
		x: { resolves: [{ expression: 'sprintf("fn_%s", x)', prefix: 'fn_', suffix: '', candidates: ['a'] }] }
	}, ['x']);
	claims('a_end <- function() 1\nf <- function(x) { match.fun(paste(x, "end", sep = "_")) }', {
		x: { resolves: [{ expression: 'paste(x, "end", sep = "_")', prefix: '', suffix: '_end', candidates: ['a'] }] }
	}, ['x']);
	claims('f <- function(x) { if(!exists(paste0("f_", x), mode = "function")) stop("n"); 1 }', { x: { resolves: [{ expression: 'paste0("f_", x)', prefix: 'f_', suffix: '' }] } }, ['x']);
	claims('g <- function(o) UseMethod("g"); g.foo <- function(o) 1; g.bar <- function(o) 2; f <- function(x) { g(x) }', {
		x: { resolves: [{ expression: 'paste0("g", ".", class(x))', prefix: 'g.', suffix: '', candidates: ['foo', 'bar'] }] }
	}, []);
	claims('g <- function(y) { stopifnot(is.character(y)); y }; h <- function(z) g(z); f <- function(x) { h(x) }', { x: { types: ['character'] } }, ['x']);
	claims('g <- function(a, b = c("u", "v")) { b <- match.arg(b); a }; f <- function(x, y) { g(y, x) }', { x: { types: ['NULL', 'character'], values: ['u', 'v'], partial: true } }, ['y']);
	claims('g <- function(y) y; f <- function(x) { g(x) }', {}, ['x']);
	claims('g <- function(y) 1; f <- function(x) { g(x) }', {}, []);
	claims('f <- function(x) { if(FALSE) x; 1 }', {}, []);
	claims('f <- function(x) { if(anyNA(x)) stop("n"); 1 }', { x: { notNA: true } }, ['x']);
	/* a bound between whole numbers lands on the next whole one, not a step past the bound */
	claims('f <- function(x) { stopifnot(length(x) > 0); 1 }', { x: { bounds: { length: [1, null] } } }, ['x']);
	claims('f <- function(x) { stopifnot(length(x) > 0.5); 1 }', { x: { bounds: { length: [1, null] } } }, ['x']);
	claims('f <- function(x) { stopifnot(length(x) < 1.5); 1 }', { x: { bounds: { length: [null, 1] } } }, ['x']);
	claims('f <- function(x) { stopifnot(length(x) >= 1.5); 1 }', { x: { bounds: { length: [2, null] } } }, ['x']);
	claims('f <- function(x) { stopifnot(length(x) <= 1.5); 1 }', { x: { bounds: { length: [null, 1] } } }, ['x']);
	claims('f <- function(x) { stopifnot(nchar(x) > 0.5); 1 }', { x: { bounds: { nchar: [1, null] } } }, ['x']);
	/* without dimensions it is `NULL`, of which `stopifnot` asks nothing */
	claims('f <- function(x) { stopifnot(nrow(x) > 0); 1 }', {}, ['x']);
	claims('f <- function(x) { if(nrow(x) > 0) 1 else stop("n") }', { x: { bounds: { nrow: [1, null] } } }, ['x']);
	claims('f <- function(x) { stopifnot(!is.na(x)); 1 }', { x: { notNA: true } }, ['x']);
	claims('f <- function(x) { stopifnot(is.finite(x)); 1 }', { x: { unclassedTypes: ['NULL', 'logical', 'integer', 'double', 'complex', 'character', 'raw'], notNA: true } }, ['x']);
	claims('f <- function(x = 1) { if(missing(x)) stop("n"); 1 }', {}, ['x']);
	claims('f <- function(x) { rlang::check_required(x); 1 }', {}, ['x']);
	claims('g <- function(y) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(y = x, ...) }', { x: { types: ['list', 'pairlist'] } }, ['x']);
	claims('g <- function(y, z) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', {}, []);
	claims('f <- function(x, y) { if(x) y; 1 }', { x: { bounds: { length: [1, 1] }, notNA: true } }, ['x']);
	claims('f <- function(x = 1) { force(x) }', {}, []);

	/* what two branches ask together, resolved */
	guards('f <- function(FUN, extra) { if(missing(extra)) return(FUN(1)); FUN(1, extra) }', 'is.function(FUN) || exists("FUN", mode = "function")', '');
	guards('f <- function(x, y) { if(is.null(y)) { if(!is.numeric(x)) stop("n") } else if(!is.numeric(x)) stop("m"); 1 }', 'is.numeric(x)');

	/* what is claimed about the value a call returns */
	const OneTruth = { types: ['logical'], bounds: { length: [1, 1] }, notNA: true } as const;
	returns('f <- function(x) { stopifnot(is.numeric(x)); x }', { unclassedTypes: ['integer', 'double'] }, 'x');
	returns('f <- function(x) { if(!is.character(x)) stop("n"); x }', { types: ['character'] }, 'x');
	returns('f <- function(x) { stopifnot(is.numeric(x), length(x) == 1, x > 0); x }', { unclassedTypes: ['integer', 'double'], bounds: { length: [1, 1], value: [0, null] } }, 'x');
	returns('f <- function(x) { if(!inherits(x, "foo")) stop("n"); invisible(x) }', { classes: ['foo'] }, 'x');
	returns('f <- function(x) { stopifnot(is.numeric(x)); y <- x; return(invisible(y)) }', { unclassedTypes: ['integer', 'double'] }, 'x');
	returns('g <- function(y) y; f <- function(x) { g(x) }', undefined, 'x');
	returns('f <- function(x) { if(is.numeric(x)) x else "a" }', { unclassedTypes: ['integer', 'double', 'character'] });
	returns('f <- function(x) { if(is.numeric(x)) { x } else { if(is.character(x)) x else NULL } }', { unclassedTypes: ['NULL', 'integer', 'double', 'character'] });
	returns('f <- function(x) { if(missing(x)) "none" else if(is.character(x)) x else stop("n") }', { types: ['character'] });
	/* an `if` without an `else` returns `NULL` when not taken */
	returns('f <- function(x) { if(is.numeric(x)) 1L }', { types: ['NULL', 'integer'], bounds: { length: [0, 1] } });
	returns('f <- function(x) { if(x > 1) return(TRUE); length(x) }', { types: ['logical', 'integer', 'double'], bounds: { length: [1, 1] }, notNA: true });
	/* a method of `as.character` for the class of `x` returns what it likes */
	returns('f <- function(x) { if(is.null(x)) return(NULL); as.character(x) }', undefined);
	returns('f <- function(x) { is.numeric(x) }', OneTruth);
	returns('f <- function(x) { identical(x, 1) }', OneTruth);
	returns('f <- function(x) { any(x) }', undefined);
	returns('f <- function(x) { typeof(x) }', { types: ['character'], bounds: { length: [1, 1] }, notNA: true });
	returns('f <- function(x) { nchar(x) }', { types: ['integer'] });
	returns('f <- function(x) { nrow(x) }', { types: ['NULL', 'integer'], whole: true });
	returns('f <- function(x) { stopifnot(is.character(x)); toupper(x) }', { types: ['character'] });
	returns('f <- function(x) { paste0("a", x) }', { types: ['character'] });
	returns('f <- function(x) { x <- as.integer(x); x }', undefined);
	returns('f <- function(x) { list(x) }', { types: ['list'] });
	returns('f <- function(x) { c(1, 2L) }', { types: ['double'], values: [1, 2], bounds: { length: [2, 2], value: [1, 2] }, notNA: true, whole: true });
	returns('f <- function(x) { c("a", NA) }', { types: ['character'], bounds: { length: [2, 2] } });
	returns('f <- function(x) { c() }', { types: ['NULL'], bounds: { length: [0, 0] } });
	returns('f <- function(x) { NA }', { types: ['logical'], bounds: { length: [1, 1] } });
	returns('f <- function(x) { 1i }', { types: ['complex'], bounds: { length: [1, 1] }, notNA: true });
	/* a value that may be another, and ways out flowR does not see through */
	returns('f <- function(x) { stopifnot(is.numeric(x)); x[1] <- "a"; x }', undefined);
	returns('f <- function(x) { if(is.numeric(x)) x <- "a"; x }', undefined);
	returns('f <- function(x) { y <- 1; if(x) y <- "a"; y }', undefined);
	returns('f <- function(x) { inherits(x, "a", TRUE) }', undefined);
	returns('f <- function(x) { if(x) print(1) else 2 }', undefined);
	returns('f <- function(x) { switch(x, a = 1, 2) }', undefined);
	returns('f <- function(x) { for(i in x) return(i); 1 }', undefined);
	returns('f <- function(x) { tryCatch(return(1), error = function(e) 2); "a" }', undefined);
	returns('f <- function(x) { on.exit(return(1)); stopifnot(is.character(x)); x }', undefined);
	returns('f <- function(x) { e <- environment(); assign("x", 1, envir = e); x }', undefined);
	returns('f.default <- function(x) 1; f <- function(x) UseMethod("f")', undefined);
	returns('f <- function(x) { if(is.null(x)) stop("n") else stop("m") }', undefined);
	returns('f <- function(x, type = "chars") .Internal(nchar(x, type, FALSE, NA))', { types: ['integer'] });
	test(label('a reason reads in words and shows the failing code briefly', ['name-normal'], ['other']), async() => {
		const { result, idMap } = await runQuery(parser, 'g <- function(z) { if(!is.list(z)) stop("needs a list"); z }\nf <- function(x, type = c("a", "b"), y) { type <- match.arg(type); if(y) 1; g(x) }', { type: 'inspect-fn-guards' });
		const [, ofF] = Object.values(result.guards);
		const reasons = reasonsOf(ofF.clauses, idMap, name => name === 'g' ? 'mine' : undefined);
		assert.deepStrictEqual(reasons.map(r => [r.reads, r.brief, r.via, r.formals]), [
			['type pmatches {"a", "b"}', undefined, undefined, ['type']],
			[undefined, 'if (y) ...', undefined, ['y']],
			[undefined, 'if (y) ...', undefined, ['y']],
			[undefined, 'if (y) ...', undefined, ['y']],
			[undefined, 'stop(...)', ['mine::g'], ['x']]
		]);
	});
	test(label('what a call returns in words and conditions', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(returnWords({ types: ['character'], bounds: { length: [1, 1] } }, 'x'), ['the value of x', 'character', 'length = 1']);
		assert.deepStrictEqual(returnConditions({ types: ['character'] }, 'x'), ['identical(result, x)', 'typeof(result) in character']);
	});

	/* what fails before any side effect, and what does not */
	guards('f <- function(x) { print(1); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { if(is.null(x)) stop("n"); print(1); if(!is.list(x)) stop("m"); 1 }', '!is.null(x) && is.list(x)', '!is.null(x)');
	guards('f <- function(x) { y <- 1; z <- y + 1; if(is.null(x)) stop("n"); z }', '!is.null(x)');
	guards('f <- function(x) { Y <<- 1; if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { if(is.null(x)) { print(1); stop("n") } else print(2); 1 }', '!is.null(x)', '');
	guards('f <- function(x, a) { if(a) print(1) else if(is.null(x)) stop("n"); 1 }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a) && (as.logical(unclass(a)) || !is.null(x))');
	guards('f <- function(x, a) { if(a) print(1); if(is.null(x)) stop("n"); 1 }', 'length(a) >= 1 && length(a) <= 1 && !is.na(a) && !is.null(x)', 'length(a) >= 1 && length(a) <= 1 && !is.na(a)');
	guards('g <- function() print(1); f <- function(x) { g(); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('g <- function() 1 + 1; f <- function(x) { g(); if(is.null(x)) stop("n"); 1 }', '!is.null(x)');
	guards('g <- function(y) { print(1); stopifnot(is.list(y)) }; f <- function(x) { g(x); 1 }', 'is.list(x)', '');
	guards('g <- function(y) { stopifnot(is.list(y)); print(1) }; f <- function(x) { g(x); if(is.null(x)) stop("n"); 1 }', 'is.list(x) && !is.null(x)', 'is.list(x)');
	guards('g <- function(y) { stopifnot(is.list(y)); 1 }; f <- function(x) { g(print(x)); 1 }', '');
	guards('f <- function(x) { unknown(); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { for(i in 1:3) print(i); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { lapply(1:2, function(i) i); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { h <- function() print(1); if(is.null(x)) stop("n"); h() }', '!is.null(x)');
	guards('f <- function(x, y = print(1)) { if(is.null(x)) stop("n"); y }', '!is.null(x)', '');
	guards('f <- function(x) { stopifnot(is.list(x), print(x) > 0) }', 'is.list(x)');
	guards('f <- function(x) { stopifnot(is.list(x)); print(x); stopifnot(length(x) > 0) }', 'is.list(x) && length(x) > 0', 'is.list(x)');
	guards('g <- function(o) UseMethod("g"); g.foo <- function(o) print(1); f <- function(x) { g(x); if(is.null(x)) stop("n"); 1 }', 'succeeds(UseMethod("g", x)) && !is.null(x)', 'succeeds(UseMethod("g", x))');

	/* what does not state anything about the input is left out, what is unknown does not make up for it */
	guards('f <- function(x) { for(i in x) if(i < 0) stop("n"); 1 }', '!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x)');
	guards('f <- function(x) { y <- unknown(x); if(y) stop("n"); 1 }', '');
	guards('f <- function(x) { if(unknown(x) && is.null(x)) stop("n"); 1 }', '!unknown(x) || !is.null(x)', '');
	guards('f <- function(x) { i <- 0; while(i < 2) i <- i + 1; if(i > 5) stop("n"); 1 }', '');

	test(label('a message written as the name of a condition is kept', ['name-normal'], ['other']), async() => {
		const found = await guardsOfF(parser, 'f <- function(x) { stopifnot("needs a list" = is.list(x), is.null(names(x))); x }');
		assert.deepStrictEqual(found?.clauses.map(c => c.message), ['needs a list', undefined]);
	});
	test(label('the conditions come in two forms', ['name-normal'], ['other']), async() => {
		const found = await guardsOfF(parser, 'f <- function(x) { if(!is.numeric(x)) stop("needs a number"); x }');
		const [clause] = found?.clauses ?? [];
		assert.strictEqual(clause.rendered, 'is.numeric(x)');
		assert.deepStrictEqual(clause.requires, { kind: 'call', fn: 'is.numeric', pkg: 'base', known: true, args: [{ value: { kind: 'formal', name: 'x' } }] });
		assert.strictEqual(clause.kind, 'explicit');
		assert.strictEqual(clause.message, 'needs a number');
	});
	test(label('a function from outside the base packages R attaches is written with its package', ['name-normal', 'accessing-exported-names'], ['other']), async() => {
		assert.strictEqual((await guardsOfF(parser, 'f <- function(x) { stopifnot(rlang::is_string(x)); 1 }'))?.requires, 'rlang::is_string(x)');
		assert.strictEqual((await guardsOfF(parser, 'f <- function(x) { if(tools::file_ext(x) != "R") stop("a"); 1 }'))?.requires, 'tools::file_ext(x) == "R"');
		assert.strictEqual((await guardsOfF(parser, 'f <- function(x) { stopifnot(utils::hasName(x, "a")); 1 }'))?.requires, 'all(hasName(x, "a"))');
		assert.strictEqual((await guardsOfF(parser, 'file_ext <- function(x) { print(x); x }\nf <- function(x) { if(file_ext(x) != "R") stop("a"); 1 }'))?.requires, 'file_ext(x) == "R"');
	});
	test(label('what the conditions call is known with its package', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(builtInGuards('trunc')?.calls, ['base::is.numeric', 'base::is.logical', 'base::is.object', 'base::!', 'base::identical', 'base::oldClass', 'base::c']);
		/* `Math.factor` fails for every member, while `trunc.Date` and `Math.difftime` let a value of theirs through */
		assert.strictEqual(builtInGuards('trunc')?.requires, '(is.numeric(x) || is.logical(x) || is.object(x)) && !identical(oldClass(x), "factor") && !identical(oldClass(x), c("ordered", "factor"))');
	});
	test(label('a primitive states relations, returns, and what it needs handed', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(builtInGuards('%*%')?.relations?.map(r => r.holds), ['ncol(x) == nrow(y)']);
		assert.deepStrictEqual(builtInGuards('crossprod')?.relations?.map(r => r.holds), ['nrow(x) == nrow(y)']);
		assert.deepStrictEqual(builtInGuards('seq_len')?.returns, { types: ['integer', 'double'], bounds: { value: [0, null] }, notNA: true, whole: true });
		assert.deepStrictEqual(builtInGuards('is.na')?.required, ['x']);
		assert.strictEqual(builtInGuards('is.single')?.requires, 'FALSE');
		/* `FALSE && "a"` never looks at the right operand */
		assert.include(builtInGuards('&&')?.requires, '!isTRUE(x) || is.logical(y)');
		/* a method of `as.integer` may return what it likes */
		assert.deepStrictEqual(builtInGuards('as.integer')?.returns, { cases: [{ when: '!is.object(x)', claim: { types: ['integer'] } }] });
	});
	test(label('a member of a group generic asks what the methods of the base packages ask', ['name-normal'], ['other']), () => {
		const sin = builtInGuards('sin')?.requires ?? '';
		for(const cls of ['"factor"', '"Date"', 'c("POSIXct", "POSIXt")', '"difftime"']) {
			assert.include(sin, `!identical(oldClass(x), ${cls})`);
		}
		assert.notInclude(sin, 'data.frame');
		assert.include(builtInGuards('abs')?.requires, '!identical(oldClass(x), "Date")');
		assert.notInclude(builtInGuards('abs')?.requires, '"difftime"');
	});
	test(label('a clause tells where it fails and through what', ['name-normal'], ['other']), async() => {
		const { result, idMap } = await runQuery(parser, 'g <- function(y) { if(!is.numeric(y)) stop("n"); y }\nf <- function(x) { g(x) }', { type: 'inspect-fn-guards' });
		const [ofG, ofF] = Object.values(result.guards);
		assert.strictEqual(RNode.lexeme(idMap.get(ofG.clauses[0].at)), 'stop("n")');
		assert.isUndefined(ofG.clauses[0].via);
		assert.strictEqual(ofF.clauses[0].at, ofG.clauses[0].at);
		assert.strictEqual(RNode.lexeme(idMap.get(ofF.clauses[0].via?.[0] as NodeId)), 'g(x)');
	});
	test(label('every formal bound by a guard shows up as an argument property', ['name-normal'], ['other']), async() => {
		const { result, idMap } = await runQuery(parser, 'f <- function(a, b = 1, c, d) { if(!is.numeric(a)) stop("n"); if(!missing(c) && is.null(c)) stop("m"); b }', { type: 'inspect-fn-props' });
		const [roles] = Object.values(result.roles);
		const bits = new Map(Object.entries(roles).map(([id, props]) => [NodeId.recoverName(Number(id), idMap), props & (ArgProp.Required | ArgProp.Guarded)]));
		assert.strictEqual(bits.get('a'), ArgProp.Required | ArgProp.Guarded);
		assert.strictEqual(bits.get('b') ?? 0, 0);
		assert.strictEqual(bits.get('c'), ArgProp.Guarded);
		assert.strictEqual(bits.get('d') ?? 0, 0);
		assert.deepStrictEqual(FunctionSemantics.call.argument.words(ArgProp.Required | ArgProp.Guarded), ['required', 'guarded']);
	});
	test(label('the properties can be asked for by name', ['name-normal'], ['other']), async() => {
		const { result } = await runQuery(parser, 'f <- function(a, b) { if(!is.numeric(a)) stop("n"); b }', { type: 'inspect-fn-props', props: ['Guarded'] });
		assert.deepStrictEqual(Object.values(result.roles).flatMap(r => Object.values(r)), [ArgProp.Guarded]);
	});

	/* what the query lets one ask for */
	const Program = 'f <- function(x, y) { if(!is.list(x)) stop("n"); print(1); y + 1 }\ng <- function(z) z';
	queryCase(parser, 'inspect-fn-guards', 'every function with anything to say', Program, ({ result }) => {
		const answers = Object.values(result.guards);
		assert.deepStrictEqual(answers.map(a => a.requires), ['is.list(x) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y))', '']);
		assert.deepStrictEqual(answers[1].required, ['z']);
	});
	async function narrowed(query: object): Promise<readonly string[]> {
		const { result } = await runQuery(parser, Program, { type: 'inspect-fn-guards', ...query } as never);
		return Object.values((result as unknown as { guards: Record<string, FunctionGuards> }).guards).flatMap(g => g.clauses.map(c => c.rendered));
	}
	test(label('narrowed down to a kind', ['name-normal'], ['other']), async() => {
		assert.deepStrictEqual(await narrowed({ kind: 'explicit' }), ['is.list(x)']);
		assert.deepStrictEqual(await narrowed({ kind: 'implicit' }), ['is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y)']);
	});
	test(label('narrowed down to clean failures', ['name-normal'], ['other']), async() => {
		assert.deepStrictEqual(await narrowed({ onlyPure: true }), ['is.list(x)']);
	});
	test(label('narrowed down to formals', ['name-normal'], ['other']), async() => {
		assert.deepStrictEqual(await narrowed({ formals: ['x'] }), ['is.list(x)']);
		assert.deepStrictEqual(await narrowed({ formals: ['nope'] }), []);
	});
	test(label('narrowed down to a definition', ['name-normal'], ['other']), async() => {
		const { result } = await runQuery(parser, Program, { type: 'inspect-fn-guards', filter: ['2@function'] });
		assert.deepStrictEqual(Object.values(result.guards).map(g => g.required), [['z']]);
	});
	test(label('the schema knows the options', ['name-normal'], ['other']), () => {
		const { schema } = InspectFnGuardsQueryDefinition;
		assert.isUndefined(schema.validate({ type: 'inspect-fn-guards', kind: 'explicit', onlyPure: true, formals: ['x'], filter: ['1@function'] }).error);
		assert.isDefined(schema.validate({ type: 'inspect-fn-guards', kind: 'nope' }).error);
	});
}));

/* everything above again, this time asking R whether what the query states is true */
describe('Guards hold in R', { sequential: true }, withShell(shell => {
	const Oracle = path.resolve('test/testfiles/guards/oracle.R').replaceAll('\\', '/');
	const toR = (value: unknown): string => {
		if(Array.isArray(value)) {
			return `${value.some(v => typeof v === 'object' && v !== null) ? 'list' : 'c'}(${value.map(toR).join(', ')})`;
		} else if(value === null) {
			return 'NA';
		} else if(typeof value === 'object') {
			return `list(${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)} = ${toR(v)}`).join(', ')})`;
		}
		return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : JSON.stringify(value);
	};
	/* the packages may not be around, what is special about them was checked when writing their entries */
	const NeedsPackage = /checkmate|assertthat|rlang/;
	test(label('no normal return breaks a claim', ['name-normal'], ['other']), async() => {
		await shell.sendCommandWithOutput(`source(${JSON.stringify(Oracle)})`);
		const broken: string[] = [];
		for(const { code, guards } of Checked) {
			if(NeedsPackage.test(code) || guards === undefined) {
				continue;
			}
			const returned = `${guards.returns === undefined ? 'NULL' : toR(guards.returns)}, ${guards.passes === undefined ? 'NULL' : JSON.stringify(guards.passes)}`;
			const command = `.guards_check(${JSON.stringify(code)}, c(${guards.clauses.map(c => JSON.stringify(c.rendered)).join(', ')}), ${toR(guards.formals)}, c(${guards.required.map(r => JSON.stringify(r)).join(', ')}), ${returned})`;
			const found = (await shell.sendCommandWithOutput(command)).filter(l => l.trim().length > 0);
			if(found.length > 0) {
				broken.push(`${code}\n  ${found.slice(0, 3).join('\n  ')}`);
			}
		}
		assert.isAbove(Checked.length, 100, 'the cases have to run first');
		assert.deepStrictEqual(broken, []);
	}, 600_000);
/* what the programs bind in the global environment must not reach the tests sharing the session */
}, true));
