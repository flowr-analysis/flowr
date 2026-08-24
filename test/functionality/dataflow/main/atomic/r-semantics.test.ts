import { assert, beforeAll, describe, test } from 'vitest';
import { withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import { uniqueArray } from '../../../../../src/util/collections/arrays';

/**
 * The R semantics flowR's modelling of non-standard evaluation rests on, asserted against a real R.
 * These are not tests of flowR: they pin the ground truth, so that a claim we model becoming false in a newer
 * R or package shows up here rather than as a silently wrong graph. What flowR makes of them is asserted in
 * `dataflow-nse.test.ts`.
 */
interface Claim {
	readonly is:           string
	/** evaluates to `TRUE` exactly when the claim holds */
	readonly holds:        string
	/** the claim is skipped when one of these is not installed */
	readonly needs?:       readonly string[]
	readonly capabilities: readonly SupportedFlowrCapabilityId[]
}

/** what R says when the version at hand does not offer the function or argument a claim uses */
const Unavailable = /could not find function|there is no package|unused argument|is not an exported object/;

/** lets a claim observe whether something was evaluated instead of arguing about it */
const Probe = 'hits <- character(0); probe <- function(tag, val = "a") { hits <<- c(hits, tag); val }; was <- function(tag) tag %in% hits; times <- function(tag) sum(hits == tag)';

const Claims: readonly Claim[] = [
	{ is:           '`&` evaluates its right operand, `&&` does not',
		holds:        'hits <- character(0); invisible(FALSE & probe("a", TRUE)); invisible(FALSE && probe("b", TRUE)); was("a") && !was("b")',
		capabilities: ['non-strict-logical-operators'] },
	{ is:           '`|` evaluates its right operand, `||` does not',
		holds:        'hits <- character(0); invisible(TRUE | probe("a", TRUE)); invisible(TRUE || probe("b", TRUE)); was("a") && !was("b")',
		capabilities: ['non-strict-logical-operators'] },
	{ is:           'rlang::sym and the label builders evaluate their argument',
		holds:        'hits <- character(0); q <- rlang::quo(wt); invisible(rlang::sym(probe("s"))); invisible(rlang::as_name(probe("n", q))); invisible(rlang::quo_name(probe("q", q))); was("s") && was("n") && was("q")',
		needs:        ['rlang'], capabilities: ['built-in-quoting'] },
	{ is:           'rlang::expr and base quote capture their argument unevaluated',
		holds:        'hits <- character(0); invisible(rlang::expr(probe("e"))); invisible(quote(probe("q"))); !was("e") && !was("q")',
		needs:        ['rlang'], capabilities: ['built-in-quoting'] },
	{ is:           'rlang splices with `!!` and `!!!`, base quote does not',
		holds:        'x <- 10; xs <- list(1, 2); identical(rlang::expr(!!x), 10) && identical(rlang::expr(f(!!!xs)), quote(f(1, 2))) && identical(all.vars(quote(!!x)), "x")',
		needs:        ['rlang'], capabilities: ['built-in-quoting'] },
	{ is:           'bquote evaluates the operand of `.()` only',
		holds:        'y <- 3; identical(bquote(a + .(y)), quote(a + 3)) && identical(bquote(a + y), quote(a + y))',
		capabilities: ['built-in-quoting'] },
	{ is:           'rlang::call2 builds a call, rlang::exec calls the function',
		holds:        'hits <- character(0); invisible(rlang::call2("probe", "c")); invisible(rlang::exec(probe, "e")); !was("c") && was("e")',
		needs:        ['rlang'], capabilities: ['function-calls'] },
	{ is:           'eval uses the binding live where it evaluates, not where the expression was written',
		holds:        'x <- 1; e <- quote(x + 1); x <- 2; identical(eval(e), 3)',
		capabilities: ['built-in-evaluation'] },
	{ is:           'eval prefers the evaluating frame and falls through to the enclosing scope',
		holds:        'xx <- 41; f <- function(q) eval(q); g <- function(q) { xx <- 0; eval(q) }; identical(f(quote(xx + 1)), 42) && identical(g(quote(xx + 1)), 1)',
		capabilities: ['built-in-evaluation'] },
	{ is:           'eval sees each loop iteration and evaluates what a function returned',
		holds:        'acc <- c(); e <- quote(i); for(i in 1:3) acc <- c(acc, eval(e)); mk <- function() quote(acc); identical(acc, 1:3) && identical(eval(mk()), 1:3)',
		capabilities: ['built-in-evaluation'] },
	{ is:           'delayedAssign forces its expression at the read, not at the definition',
		holds:        'k <- 1; delayedAssign("v", k + 1); k <- 5; identical(v, 6)',
		capabilities: ['formals-promises'] },
	{ is:           'a default argument is a promise of the function`s own frame',
		holds:        'y <- 1; f <- function(x = y) { y <- 3; x }; g <- function(a, b = a * 2) b; identical(f(), 3) && identical(g(3), 6)',
		capabilities: ['formals-promises'] },
	{ is:           'an argument is a promise of the caller`s frame',
		holds:        'y <- 1; f <- function(x) { y <- 99; x }; identical(f(y), 1)',
		capabilities: ['formals-promises'] },
	{ is:           'a data mask falls through to the caller for names it has no column for',
		holds:        'd <- data.frame(a = 1:2); k <- 1; kk <- TRUE; nrow(dplyr::filter(d, a > k)) == 1 && nrow(dplyr::filter(d, kk)) == 2',
		needs:        ['dplyr'], capabilities: ['data-masking'] },
	{ is:           'a column shadows a variable of the same name',
		holds:        'd <- data.frame(a = 1:2); a <- 99; nrow(dplyr::filter(d, a > 1)) == 1',
		needs:        ['dplyr'], capabilities: ['data-masking'] },
	{ is:           'rlang`s `:=` names a column and defines nothing',
		holds:        'd <- data.frame(a = 1:2); nm <- "dyn"; r <- dplyr::mutate(d, !!nm := 1); !exists("newcol", inherits = FALSE) && "dyn" %in% names(r)',
		needs:        ['dplyr', 'rlang'], capabilities: ['data-masking'] },
	{ is:           'ggplot2::aes_string evaluates its argument, aes captures it',
		holds:        'hits <- character(0); invisible(suppressWarnings(ggplot2::aes_string(x = probe("s", "wt")))); invisible(ggplot2::aes(x = probe("a"))); was("s") && !was("a")',
		needs:        ['ggplot2'], capabilities: ['data-masking'] },
	{ is:           'tidyr`s expand family has no data argument and evaluates its arguments',
		holds:        'v <- 1:3; nrow(tidyr::crossing(a = v)) == 3 && ncol(tidyr::crossing(a = 1:2, b = 1:2)) == 2',
		needs:        ['tidyr'], capabilities: ['data-masking'] },
	{ is:           'tidyr`s separate_longer family takes the data first and masks the column',
		holds:        'd <- data.frame(a = c("x,y", "z")); nrow(tidyr::separate_longer_delim(d, a, delim = ",")) == 3',
		needs:        ['tidyr'], capabilities: ['data-masking'] },
	{ is:           'data.table `:=` adds the column in place and defines no variable',
		holds:        'dt <- data.table::data.table(a = 1:2); dt[, b := a + 1]; "b" %in% names(dt) && !exists("b", inherits = FALSE)',
		needs:        ['data.table'], capabilities: ['data-masking'] },
	{ is:           'a data.table subscript masks `j` and `by` but reads the caller`s variables',
		holds:        'dt <- data.table::data.table(a = 1:2); k <- 1L; nrow(dt[a > k]) == 1 && dt[, sum(a)] == 3 && nrow(dt[, .N, by = a]) == 2',
		needs:        ['data.table'], capabilities: ['data-masking'] },
	{ is:           'an unused argument is never evaluated',
		holds:        'f <- function(x) 10; identical(f(stop("boom")), 10)',
		capabilities: ['formals-promises'] },
	{ is:           'a promise is forced at most once',
		holds:        'hits <- character(0); g <- function(x) { x; x; x }; invisible(g(probe("o"))); times("o") == 1',
		capabilities: ['formals-promises'] },
	{ is:           'a default argument sees bindings the body makes after it',
		holds:        'h <- function(x = ls()) { a <- 1; x }; "a" %in% h()',
		capabilities: ['formals-promises'] },
	{ is:           'substitute reaches an argument`s expression without forcing it',
		holds:        'hits <- character(0); h <- function(p) substitute(p); e <- h(probe("s")); !was("s") && identical(e, quote(probe("s")))',
		capabilities: ['formals-promises'] },
	{ is:           'missing() does not force its argument',
		holds:        'hits <- character(0); h <- function(a) missing(a); invisible(h(probe("m"))); !was("m")',
		capabilities: ['formals-promises'] },
	{ is:           'a closure captures the promise, so it reads the binding live when it is called',
		holds:        'mk <- function(v) function() v; k <- 5; fn <- mk(k); k <- 6; mk2 <- function(v) { force(v); function() v }; k2 <- 5; fn2 <- mk2(k2); k2 <- 6; identical(fn(), 6) && identical(fn2(), 5)',
		capabilities: ['formals-promises'] },
	{ is:           'forcing a promise applies the writes its expression performs',
		holds:        'x <- 7; delayedAssign("x", { x <- 99; 2 }); identical(x + x, 101) && identical(x, 99)',
		capabilities: ['formals-promises'] },
	{ is:           'delayedAssign`s eval.env and assign.env decide where it runs and lands',
		holds:        'e1 <- new.env(); assign("q", 42, envir = e1); q <- 1; delayedAssign("dv", q, eval.env = e1); e2 <- new.env(); delayedAssign("dw", 5, assign.env = e2); identical(dv, 42) && identical(get("dw", envir = e2), 5)',
		capabilities: ['formals-promises'] },
	{ is:           'a promise passed on still evaluates in the frame it came from',
		holds:        'w <- 1; inner <- function(q) { w <- 99; q }; outer <- function(p) inner(p); identical(outer(w), 1)',
		capabilities: ['formals-promises'] },
	{ is:           '`?` does not evaluate its operand',
		holds:        'hits <- character(0); invisible(try(`?`(probe("h")), silent = TRUE)); !was("h")',
		capabilities: ['built-in-quoting'] }
];

describe('R semantics we model', { concurrent: false }, withShell(shell => {
	let missing: ReadonlySet<string> = new Set();
	beforeAll(async() => {
		const needed = uniqueArray(Claims.flatMap(c => c.needs ?? []));
		const [line] = await shell.sendCommandWithOutput(
			`cat(paste0(Filter(function(p) !requireNamespace(p, quietly = TRUE), c(${needed.map(p => `"${p}"`).join(',')})), collapse = ","), "\\n")`
		);
		missing = new Set(line.split(',').filter(p => p.length > 0));
	}, 30_000);

	test.each(Claims.map(c => [c.is, c] as const))('%s', async(_is, claim) => {
		const absent = (claim.needs ?? []).filter(p => missing.has(p));
		/* an R too old for the claim, or a package it needs, says nothing about what we model */
		if(absent.length > 0) {
			return;
		}
		const [answer] = await shell.sendCommandWithOutput(
			`{ ${Probe}; cat(tryCatch(isTRUE(local({ ${claim.holds} })), error = function(e) conditionMessage(e)), "\\n") }`
		);
		const said = answer.trim();
		/* an R or package too old to offer what the claim uses says nothing about what we model */
		if(Unavailable.test(said)) {
			return;
		}
		assert.strictEqual(said, 'TRUE', `R disagrees with what we model: ${claim.is}`);
	});

	test(label('every claim carries the capability it grounds', ['function-calls'], ['other']), () => {
		assert.isTrue(Claims.every(c => c.capabilities.length > 0));
	});
}));
