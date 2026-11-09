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
import { claimWords } from '../../../src/dataflow/fn/guards/guard-claims';
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

	/* the guards as they are commonly written */
	guards('f <- function(x) { if(!is.numeric(x)) stop("must be numeric"); x }', 'is.numeric(x)');
	guards('f <- function(x) { stopifnot(is.numeric(x), x > 0); x }', 'is.numeric(x) && all(x > 0)');
	guards('f <- function(x) { stopifnot("must" = is.character(x)); stopifnot(exprs = { length(x) == 1; nchar(x) > 0 }); x }', 'is.character(x) && length(x) == 1 && all(nchar(x) > 0)');

	/* what an earlier return skips, and what a branch asks only of itself */
	guards('f <- function(x, a) { if(a) return(1); if(!is.numeric(x)) stop("a"); x }', 'length(a) == 1 && !is.na(a) && (as.logical(unclass(a)) || is.numeric(x))');
	guards('f <- function(x, a) { if(a) { if(is.null(x)) stop("n") } else { stop("b") }; 1 }', 'length(a) == 1 && !is.na(a) && !is.null(x) && as.logical(unclass(a))');
	guards('f <- function(x) { for(i in x) { if(is.null(x)) stop("n") }; 1 }', '');

	/* boolean structure */
	guards('f <- function(x) { if(is.null(x) || length(x) != 1) stop("a"); 2 }', '!is.null(x) && length(x) == 1');
	guards('f <- function(x) { if(!is.null(x) && x < 0) stop("a"); 2 }', '(is.null(x) || !is.function(x) && !is.environment(x) || is.object(x)) && (is.null(x) || x >= 0)');
	guards('f <- function(x) { is.numeric(x) || stop("a"); 2 }', 'is.numeric(x)');
	guards('f <- function(x) { is.numeric(x) && stop("a"); 2 }', '!is.numeric(x)');
	guards('f <- function(x) { if(is.numeric(x)) 1 else stop("no") }', 'is.numeric(x)');
	guards('f <- function(x) { if(any(x < 0)) stop("no"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x >= 0)');
	guards('f <- function(x) { if(!all(x > 0)) stop("no"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x > 0)');
	guards('f <- function(x) { stopifnot(!any(is.na(x))); 1 }', 'all(!is.na(x))');
	guards('f <- function(x) { stopifnot(x > 0 | x < -1); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x > 0 | x < -1)');
	guards('f <- function(x) { stopifnot(x > 0 & x < 5); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x > 0) && all(x < 5)');
	guards('f <- function(x) { if(isTRUE(x)) 1 else stop("x") }', 'isTRUE(x)');
	guards('f <- function(x) { if(isFALSE(is.numeric(x))) stop("x"); 1 }', '!isFALSE(is.numeric(x))');
	guards('f <- function(x) { if(x) stop("x"); 1 }', 'length(x) == 1 && !is.na(x) && !as.logical(unclass(x))');
	guards('f <- function(x) { stopifnot(x); 1 }', 'all(x)');

	/* what a formal holds by the time of the guard */
	guards('f <- function(x) { x <- as.character(x); if(!is.character(x)) stop("x"); 1 }', 'is.character(as.character(x))');
	guards('f <- function(x) { y <- x; if(!is.numeric(y)) stop("x"); 1 }', 'is.numeric(x)');
	guards('f <- function(x) { n <- length(x); if(n != 1) stop("x"); 1 }', 'length(x) == 1');
	guards('f <- function(x) { x <- x + 1; if(x < 0) stop("x"); 1 }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)) && x + 1 >= 0');
	guards('f <- function(x) { x[1] <- 0; if(x < 0) stop("x"); 1 }', '');
	guards('f <- function(x, c) { if(c) x <- 1; if(!is.numeric(x)) stop("n"); 1 }', 'length(c) == 1 && !is.na(c) && (as.logical(unclass(c)) || is.numeric(x))');

	/* values from a set */
	guards('f <- function(x = c("a", "b")) { x <- match.arg(x); x }', 'succeeds(match.arg(x, c("a", "b")))');
	guards('f <- function(x) { match.arg(x, c("alpha", "beta")); 1 }', 'succeeds(match.arg(x, c("alpha", "beta")))');
	guards('f <- function(x = c("a", "b")) { match.arg(x, several.ok = TRUE); 1 }', 'succeeds(match.arg(x, several.ok = TRUE))');
	guards('f <- function(x = c("a", "b")) { x <- rlang::arg_match(x); x }', 'succeeds(rlang::arg_match(x, c("a", "b")))');
	guards('f <- function(x) { rlang::arg_match0(x, c("a", "b")); 1 }', 'succeeds(rlang::arg_match0(x, c("a", "b")))');
	guards('f <- function(x) { if(!(x %in% c("a", "b"))) stop("n"); 1 }', 'x %in% c("a", "b")');
	guards('f <- function(x) { if(x != "a" && x != "b") stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && (x == "a" || x == "b")');
	guards('f <- function(x) { if(!is.element(x, c("a", "b"))) stop("n"); 1 }', 'is.element(x, c("a", "b"))');
	guards('f <- function(x) { switch(x, a = 1, b = 2, stop("no")) }', '!is.character(x) || x %in% c("a", "b")');
	guards('f <- function(x) { switch(x, a = , b = 2, stop("no")) }', '!is.character(x) || x %in% c("a", "b")');
	guards('f <- function(x) { switch(x, a = stop("no"), b = 2) }', '!is.character(x) || !x %in% "a"');
	guards('f <- function(x) { switch(x, a = return(1), b = 2); if(is.null(x)) stop("n"); 1 }', '');

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
	guards('f <- function(x) { if(1 > x) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && 1 <= x');
	guards('f <- function(x) { if(length(x) == 0) stop("n"); 1 }', 'length(x) != 0');
	guards('f <- function(x) { if(length(x) > 3) stop("n"); 1 }', 'length(x) <= 3');
	guards('f <- function(x) { if(identical(x, "a")) 1 else stop("no") }', 'identical(x, "a")');

	/* what R fails on by itself */
	guards('f <- function(x) { x + 1 }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)');
	guards('f <- function(x, y) { x + y }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x) || is.object(y)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y) || is.object(x))');
	guards('f <- function(x) { -x + 1L }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)');
	guards('f <- function(x) { x > 1 }', '!is.function(x) && !is.environment(x) || is.object(x)');
	guards('f <- function(x) { !x }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.raw(x) || length(x) == 0 || is.object(x)');
	guards('f <- function(x) { x && TRUE }', '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1');
	guards('f <- function(x) { TRUE || x }', '');
	guards('f <- function(x) { FALSE || x }', '(is.logical(x) || is.numeric(x) || is.complex(x) || is.object(x)) && length(x) <= 1');
	guards('f <- function(x) { if(x) 1 else 2 }', 'length(x) == 1 && !is.na(x)');
	guards('f <- function(x) { sum(x) }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)');
	guards('f <- function(x, y) { sum(x, y, 1) }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.null(x) || is.object(x)) && (is.numeric(y) || is.logical(y) || is.complex(y) || is.null(y) || is.object(y))');
	guards('f <- function(x) { sqrt(x) }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x)');
	guards('f <- function(x) { log(x) }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x)');
	guards('f <- function(x) { round(x) }', 'is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x)');
	guards('f <- function(x) { x$a }', 'is.null(x) || is.recursive(x) && !is.function(x) || is.object(x)');
	guards('f <- function(x) { x$a <- 1; x }', '');
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
	guards('g <- function(y) { if(!is.numeric(y)) stop("y"); y }; f <- function(x, a) { if(a) g(x); 1 }', 'length(a) == 1 && !is.na(a) && (!as.logical(unclass(a)) || is.numeric(x))');
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
	guards('g <- function(y) { if(y > 0) { h2(y) }; 1 }; h2 <- function(z) { stopifnot(is.numeric(z)); 1 }; f <- function(x) { g(x); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && (x <= 0 || is.numeric(x))');

	/* predicates are seen through */
	guards('is_pos <- function(v) is.numeric(v) && v > 0; f <- function(x) { if(!is_pos(x)) stop("n"); 1 }', 'is.numeric(x) && x > 0');
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
	guards('f <- function(x, y = is.null(x)) { if(y) stop("n"); 1 }', 'length(y) == 1 && !is.na(y) && !as.logical(unclass(y))');
	guards('f <- function(x) { eval(quote(x <- 1)); if(is.null(x)) stop("n"); 1 }', '');
	guards('f <- function(x) { if(!requireNamespace("rlang", quietly = TRUE)) stop("n"); 1 }', '');
	guards('LIM <- 3; f <- function(x) { if(x > LIM) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x <= 3');
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
	guards('f <- function(x) { x <- unclass(x); stopifnot(is.numeric(x)); 1 }', '');
	guards('f <- function(x) { stopifnot(is.numeric(y <- x)); y }', '');
	guards('f <- function(x) { h <- function(a = stop("h")) 1; h(); 1 }', '');
	guards('f <- function(x) { h <- function(a = stop("h")) a; h(); 1 }', '');
	guards('f <- function(x) { g2 <- function(u) if(u) stop("g"); g2(x) ; 1 }', 'length(x) == 1 && !is.na(x) && !as.logical(unclass(x))');

	/* truthiness and comparisons */
	guards('f <- function(x) { if(length(x)) stop("n"); 1 }', '!length(x)');
	guards('f <- function(x) { if(!length(x)) stop("n"); 1 }', 'length(x)');
	guards('f <- function(x) { if(nchar(x)) stop("n"); 1 }', '!nchar(x)');
	guards('f <- function(x) { if(!nzchar(x)) stop("n"); 1 }', 'nzchar(x)');
	guards('f <- function(x) { if(x == "a") stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x != "a"');
	guards('f <- function(x) { if(x != "a") stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x == "a"');
	guards('f <- function(x) { if(x == 1) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x != 1');
	guards('f <- function(x) { if(!is.na(x) && x > 1) stop("n"); 1 }', '(is.na(x) || !is.function(x) && !is.environment(x) || is.object(x)) && (is.na(x) || x <= 1)');
	guards('f <- function(x) { if(xor(is.null(x), is.numeric(x))) stop("n"); 1 }', '!xor(is.null(x), is.numeric(x))');
	guards('f <- function(x) { if(is.numeric(x) & x > 1) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && (!is.numeric(x) || x <= 1)');
	guards('f <- function(x) { if(is.numeric(x) | is.character(x)) 1 else stop("n") }', 'is.numeric(x) || is.character(x)');
	guards('f <- function(x) { stopifnot(is.numeric(x) || is.character(x)); 1 }', 'is.numeric(x) || is.character(x)');
	guards('f <- function(x) { stopifnot(is.numeric(x) && length(x) == 1); 1 }', 'is.numeric(x) && length(x) == 1');
	guards('f <- function(x) { stopifnot(x %in% c(1, 2)); 1 }', 'all(x %in% c(1, 2))');
	guards('f <- function(x) { stopifnot(length(x) > 0, all(x %in% c("a", "b"))); 1 }', 'length(x) > 0 && all(x %in% c("a", "b"))');
	guards('f <- function(x) { if(any(!x %in% c("a", "b"))) stop("n"); 1 }', 'all(x %in% c("a", "b"))');
	guards('f <- function(x) { if(!all(x %in% c("a", "b"))) stop("n"); 1 }', 'all(x %in% c("a", "b"))');
	guards('f <- function(x) { if(any(c(TRUE, x))) stop("n"); 1 }', 'all(!c(TRUE, x))');
	guards('f <- function(x) { if(any(x, na.rm = TRUE)) stop("n"); 1 }', '!any(x, na.rm = TRUE)');
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
	guards('f <- function(x) { if(x > 1 || x < -1) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x <= 1 && x >= -1');
	guards('f <- function(x) { if(-1 > x) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && -1 <= x');
	guards('f <- function(x) { if(x > 5) return(1); if(x < 0) stop("n"); 2 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && (x > 5 || x >= 0)');
	guards('f <- function(x) { s <- "a"; if(x != s) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x == "a"');
	guards('f <- function(x) { v <- c("a", "b"); if(!(x %in% v)) stop("n"); 1 }', 'x %in% c("a", "b")');

	/* a default is no restriction */
	guards('f <- function(x, choices = c("a", "b")) { if(!(x %in% choices)) stop("n"); 1 }', 'x %in% choices');
	guards('f <- function(x) { if(x |> is.null()) stop("n"); 1 }', '!is.null(x)');
	guards('f <- function(x) { x |> is.null(); if(is.list(x)) stop("n"); 1 }', '!is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', '!is.null(...names()) || is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(y = x, ...) }', 'is.list(x)');
	guards('g <- function(y, z = 1) { stopifnot(is.list(y)); y }; f <- function(...) { g(...) }', '');
	guards('f <- function(x) { if(!is.finite(x)) stop("n"); 1 }', 'is.finite(x)');
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
	guards('f <- function(x, a) { inner <- function() stopifnot(is.numeric(x)); if(a) x <- 1; inner(); 1 }', 'length(a) == 1 && !is.na(a)');
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
	guards('LIM <- 3; LIM <- 4; f <- function(x) { if(x > LIM) stop("n"); 1 }', '(!is.function(x) && !is.environment(x) || is.object(x)) && x <= 4');
	guards('f <- function(x) { if(x > LIM) stop("n"); 1 }; LIM <- 3', '(!is.function(x) && !is.environment(x) || is.object(x)) && x <= 3');
	guards('f <- function(x) { if(x > LIM) stop("n"); 1 }; if(FALSE) LIM <- 3', '(!is.function(x) && !is.environment(x) || is.object(x) || is.object(LIM)) && x <= LIM');
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
	guards('g <- function(x, m) { stopifnot(is.atomic(m), !is.null(x)); x }; f <- function(x) g(x, NULL)', '!is.null(x)');
	guards('f <- function(x) { stopifnot(x %in% 1:3); x }', 'all(x %in% 1:3)');
	guards('f <- function(x) { stopifnot(x == 1:2); x }', '(!is.function(x) && !is.environment(x) || is.object(x) || is.object(1:2)) && all(x == 1:2)');
	guards('f <- function(x) { stopifnot(x %in% -(1:3)); x }', 'all(x %in% -(1:3))');
	guards('f <- function(x) { stopifnot(x > 0, x > 5); x }', '(!is.function(x) && !is.environment(x) || is.object(x)) && all(x > 0) && all(x > 5)');
	guards('f <- function(x) { stopifnot(is.numeric(x), x > 5); x }', 'is.numeric(x) && all(x > 5)');
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
	guards('f <- function(x) { if(any(x)) stop("a"); 1 }', '!any(x)');
	guards('f <- function(x) { stopifnot(!x); 1 }', '(is.numeric(x) || is.logical(x) || is.complex(x) || is.raw(x) || length(x) == 0 || is.object(x)) && all(!x)');
	guards('f <- function(x) { stopifnot(exists("x")); 1 }', 'exists("x")');
	guards('f <- function(x) { if(!(exists("x"))) stop("a"); 1 }', 'exists("x")');
	guards('f <- function(x) { `!` <- function(a) a; if(!is.numeric(x)) stop("a"); 1 }', '');
	guards('f <- function(x) { `>` <- function(a, b) TRUE; stopifnot(x > 0); 1 }', '');
	guards('f <- function(x) { `(` <- function(a) TRUE; stopifnot((is.numeric(x))); 1 }', '');
	guards('f <- function(x, a) { if(a) is.numeric <- function(y) TRUE; stopifnot(is.numeric(x)); 1 }', 'length(a) == 1 && !is.na(a)');
	guards('f <- function(x, return) { if(is.null(x)) return(1); stopifnot(is.numeric(x)); 1 }', 'is.null(x) || is.numeric(x)', '');
	guards('f <- function(x, stop) { if(is.null(x)) stop("a"); 1 }', '');
	guards('f <- function(x) { if(is.null(x)) stop("a"); stopifnot(!is.integer(x)); 1 }', '!is.null(x) && !is.integer(x)');
	guards('f <- function(x, g) { Reduce(g, x) }', '');
	guards('f <- function(x, g) { Filter(g, x) }', 'is.function(g) || is.character(g) && exists(g, mode = "function") || is.symbol(g) || exists("g", mode = "function")');
	guards('f <- function(x) { if(is.numeric(x) && length(x) == 1L && x > 0) x <- 1; x }', '');
	guards('f <- function(x, m) { if(is.numeric(x) && length(x) == 1L && x > 0) x <- seq_len(x); n <- length(x); if(n < m) stop("n < m"); 1 }', '(is.numeric(x) && length(x) == 1L && x > 0 || !is.function(m) && !is.environment(m) || is.object(m) || is.object(length(x))) && (is.numeric(x) && length(x) == 1L && x > 0 || length(x) >= m)');
	guards('f <- function(x) { if(is.null(x)) x <- 1; stopifnot(is.numeric(x)); x }', 'is.null(x) || is.numeric(x)');
	guards('f <- function(x, y) { if(y) x <- "a"; if(!is.character(x)) stop("c"); x }', 'length(y) == 1 && !is.na(y) && (as.logical(unclass(y)) || is.character(x))');
	guards('f <- function(x) { if(is.character(x)) x <- nchar(x); for(i in 1:2) x <- x + 1; stopifnot(x > 0); x }', '');
	guards('f <- function(x, s) { if(is.numeric(x)) x <- seq_len(x); if(s) { if(is.factor(x)) x <- as.integer(x) }; x[1] }', '(is.numeric(x) || as.logical(unclass(s)) || !is.function(x) && !is.environment(x) && !is.symbol(x) || is.object(x)) && length(s) == 1 && !is.na(s)');
	guards('f <- function(x, a, b) { if(a) x <- 1; if(b) x <- "z"; stopifnot(is.character(x)); x }', 'length(a) == 1 && !is.na(a) && (as.logical(unclass(a)) || as.logical(unclass(b)) || is.character(x)) && length(b) == 1 && !is.na(b)');

	/* what is claimed about the formals */
	const AnythingBut = (...not: readonly string[]) => ['NULL', 'logical', 'integer', 'double', 'complex', 'character', 'raw', 'list', 'pairlist', 'function', 'environment', 'symbol', 'language', 'expression', 'other'].filter(t => !not.includes(t));
	claims('f <- function(x) { if(!is.integer(x)) stop("n"); x }', { x: { types: ['integer'] } }, ['x']);
	claims('f <- function(x) { stopifnot(is.numeric(x)); x }', { x: { types: ['integer', 'double'] } }, ['x']);
	claims('f <- function(x) { if(is.null(x)) stop("n"); x }', { x: { types: AnythingBut('NULL') } }, ['x']);
	claims('f <- function(x) { if(is.numeric(x)) stop("n"); 1 }', {}, ['x']);
	claims('f <- function(x) { if(is.numeric(x) || is.character(x)) x else stop("n") }', { x: { types: ['integer', 'double', 'character'] } }, ['x']);
	claims('f <- function(x) { if(!is.data.frame(x)) stop("n"); 1 }', { x: { types: ['list'], plainTypes: [] } }, ['x']);
	claims('f <- function(x) { x + 1 }', { x: { plainTypes: ['NULL', 'logical', 'integer', 'double', 'complex'] } }, ['x']);
	claims('f <- function(x) { strsplit(x, "") }', { x: { types: ['character'] } }, ['x']);
	claims('f <- function(x) { if(!is.numeric(x)) stop("n"); x + 1 }', { x: { types: ['integer', 'double'] } }, ['x']);
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
		assert.deepStrictEqual(claimWords(builtIns['utils::combn'].formals?.m ?? {}), ['integer or double', 'length = 1', 'value >= 0']);
	});

	test('a relation between formals', async() => {
		const guards = await guardsOfF(parser, 'f <- function(x, m) { if(is.numeric(x) && length(x) == 1L && x > 0) x <- seq_len(x); n <- length(x); if(n < m) stop("n < m"); stopifnot(m <= 10, length(x) > m || m == 0); 1 }');
		assert.deepStrictEqual(guards?.relations, [
			{ holds: 'length(x) >= m', formals: ['x', 'm'], unless: 'is.numeric(x) && length(x) == 1L && x > 0' },
			{ holds: 'length(x) > m', formals: ['x', 'm'], unless: 'is.numeric(x) && length(x) == 1L && x > 0 || m == 0' }
		]);
	});

	test('a configuration teaches what a function checks', async() => {
		const code = 'f <- function(x) { stopifnot(is_text(x)); x }';
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.semantics.environment.overwriteBuiltIns.definitions = [{ type: 'function', names: ['is_text'], processor: BuiltInProcName.DefaultReadAllArgs,
				config: { guards: { is_text: { predicate: { yes: RValueType.Character, exact: true } } } } }];
		});
		const taught = await guardsOfF(parser, code, config);
		const plain = await guardsOfF(parser, code);
		assert.deepStrictEqual(taught?.formals?.x?.types, ['character']);
		assert.isUndefined(plain?.formals?.x?.types);
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
	claims('f <- function(n = 5L) { if(!is.numeric(n)) stop("n"); n }', { n: { types: ['integer', 'double'] } }, []);
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
	claims('f <- function(x) { if(x != "a" && x != "b") stop("n"); x }', { x: { plainTypes: AnythingBut('function', 'environment'), values: ['a', 'b'] } }, ['x']);
	claims('f <- function(x) { switch(x, a = 1, b = 2, stop("no")) }', { x: { values: ['a', 'b'] } }, ['x']);
	claims('f <- function(x, y = 1) { stopifnot(x > 0, x <= 5, length(y) == 1L); x }', { x: { plainTypes: AnythingBut('function', 'environment') }, y: { bounds: { length: [1, 1] } } }, ['x']);
	claims('f <- function(x) { stopifnot(is.numeric(x), x > 0, x <= 5); x }', { x: { types: ['integer', 'double'], bounds: { value: [0, 5] } } }, ['x']);
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
	claims('f <- function(x) { stopifnot(is.finite(x)); 1 }', { x: { notNA: true } }, ['x']);
	claims('f <- function(x = 1) { if(missing(x)) stop("n"); 1 }', {}, ['x']);
	claims('f <- function(x) { rlang::check_required(x); 1 }', {}, ['x']);
	claims('g <- function(y) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(y = x, ...) }', { x: { types: ['list', 'pairlist'] } }, ['x']);
	claims('g <- function(y, z) { stopifnot(is.list(y)); y }; f <- function(x, ...) { g(x, ...) }', {}, []);
	claims('f <- function(x, y) { if(x) y; 1 }', { x: { bounds: { length: [1, 1] }, notNA: true } }, ['x']);
	claims('f <- function(x = 1) { force(x) }', {}, []);

	/* what fails before any side effect, and what does not */
	guards('f <- function(x) { print(1); if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { if(is.null(x)) stop("n"); print(1); if(!is.list(x)) stop("m"); 1 }', '!is.null(x) && is.list(x)', '!is.null(x)');
	guards('f <- function(x) { y <- 1; z <- y + 1; if(is.null(x)) stop("n"); z }', '!is.null(x)');
	guards('f <- function(x) { Y <<- 1; if(is.null(x)) stop("n"); 1 }', '!is.null(x)', '');
	guards('f <- function(x) { if(is.null(x)) { print(1); stop("n") } else print(2); 1 }', '!is.null(x)', '');
	guards('f <- function(x, a) { if(a) print(1) else if(is.null(x)) stop("n"); 1 }', 'length(a) == 1 && !is.na(a) && (as.logical(unclass(a)) || !is.null(x))');
	guards('f <- function(x, a) { if(a) print(1); if(is.null(x)) stop("n"); 1 }', 'length(a) == 1 && !is.na(a) && !is.null(x)', 'length(a) == 1 && !is.na(a)');
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
	guards('f <- function(x) { for(i in x) if(i < 0) stop("n"); 1 }', '');
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
		assert.deepStrictEqual(clause.requires, { kind: 'call', fn: 'is.numeric', known: true, args: [{ value: { kind: 'formal', name: 'x' } }] });
		assert.strictEqual(clause.kind, 'explicit');
		assert.strictEqual(clause.message, 'needs a number');
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
			return `c(${value.map(toR).join(', ')})`;
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
			const command = `.guards_check(${JSON.stringify(code)}, c(${guards.clauses.map(c => JSON.stringify(c.rendered)).join(', ')}), ${toR(guards.formals)}, c(${guards.required.map(r => JSON.stringify(r)).join(', ')}))`;
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
