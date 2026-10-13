import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { assert, beforeAll, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';

function printed(code: string): string {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cxr-'));
	try {
		return execFileSync('Rscript', ['--vanilla', '-e', code], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 1 << 24 }).trimEnd().split('\n').at(-1) ?? '';
	} catch(e) {
		return (e as { signal?: string }).signal ? 'TIMEOUT' : 'ERROR';
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
}

const cases: readonly (readonly [string, string, string?])[] = [
	['seed lost: rng in loop in fn', 'set.seed(1)\nf <- function() { for(i in 1) y <- runif(1); 0 }\nf()\nprint(runif(1))'],
	['seed lost: realistic markov chain', 'states <- c("sunny", "cloudy", "rainy")\nP <- matrix(c(0.7, 0.2, 0.1,\n              0.3, 0.4, 0.3,\n              0.2, 0.3, 0.5), nrow = 3, byrow = TRUE, dimnames = list(states, states))\nsimulate_chain <- function(P, start, n_steps) {\n  path <- character(n_steps)\n  path[1] <- start\n  for (t in 2:n_steps) {\n    path[t] <- sample(colnames(P), 1, prob = P[path[t - 1], ])\n  }\n  path\n}\nset.seed(123)\nchain <- simulate_chain(P, "sunny", 200)\ncat("@@", capture.output(print(table(chain))), sep = "\\n")'],
	['unconditional break dropped', 'for(i in 1:3) { x <- i\n  break\n}\nprint(x)'],
	['unconditional break dropped: nontermination', 'while(TRUE) { x <- 1; break }\nprint(x)'],
	['unconditional break dropped: realistic search', 'data(mtcars)\ncars <- mtcars[order(-mtcars$hp), ]\ntarget_hp <- 150\nfirst_match <- NA\nfor (i in seq_len(nrow(cars))) {\n  if (cars$hp[i] > target_hp) next\n  first_match <- rownames(cars)[i]\n  break\n}\nattempt <- 0\nrepeat {\n  attempt <- attempt + 1\n  converged <- attempt >= 1\n  break\n}\ncat("@@", capture.output(print(first_match)), sep = "\\n")'],
	['tryCatch dropped around kept call', 'lg <- character()\nf <- function(b) { lg <<- c(lg, "o"); b }\nr <- tryCatch(f(stop("x")), error = function(e) -1)\nprint(lg)'],
	['tryCatch dropped: realistic resource log', 'attempts <- 0\nflaky <- function(fail_until = 3) {\n  attempts <<- attempts + 1\n  if (attempts < fail_until) stop("transient failure ", attempts)\n  "ok"\n}\nretry <- function(f, times = 5, ...) {\n  last_err <- NULL\n  for (i in seq_len(times)) {\n    res <- tryCatch(f(...), error = function(e) { last_err <<- e; NULL })\n    if (!is.null(res)) return(list(value = res, tries = i))\n  }\n  stop(last_err)\n}\nr1 <- retry(flaky)\ncleanup_log <- character()\nwith_resource <- function(name, body) {\n  cleanup_log <<- c(cleanup_log, paste("open", name))\n  on.exit(cleanup_log <<- c(cleanup_log, paste("close", name)), add = TRUE)\n  body\n}\nv1 <- with_resource("db", 42)\nv2 <- tryCatch(with_resource("file", stop("boom")), error = function(e) -1)\ncat("@@", capture.output(print(cleanup_log)), sep = "\\n")'],
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
];

describe('Realistic scripts: soundness of slices', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});
	for(const [name, code, absent] of cases) {
		test(name, async() => {
			const lines = code.split('\n');
			const fn = /^(\w+)\(/.exec(lines[lines.length - 1])?.[1] ?? 'print';
			const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [`${lines.length}@${fn}` as SlicingCriterion] }]);
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			const whole = printed(code);
			const part = printed(slice);
			assert.strictEqual(part, whole, `the slice:\n${slice}`);
			if(absent !== undefined) {
				assert.notInclude(slice, absent, `the slice:\n${slice}`);
			}
		}, 60000);
	}
});
