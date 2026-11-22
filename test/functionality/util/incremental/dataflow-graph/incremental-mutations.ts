import seedrandom from 'seedrandom';
import type { IncrementalStep } from './incremental-assert';

/**
 * Top-level statements whose semantics reach beyond themselves: definitions read later, closures writing with `<<-`,
 * removals, attached packages, ambient state, early exits, sourced files, and the like. Every step of a fuzzed
 * sequence picks from these, so that a resumed analysis has to carry exactly what the full one carries.
 */
export const StatementPool: readonly string[] = [
	'x <- 1',
	'y <- x + 1',
	'x <- y * 2',
	'print(x)',
	'z <- c(x, y)',
	'f <- function(a) a + x',
	'f(2)',
	'g <- function() { x <<- x + 1 }',
	'g()',
	'h <- function(n) if(n > 0) h(n - 1) else x',
	'h(3)',
	'rm(x)',
	'if(exists("x")) x else 0',
	'library(dplyr)',
	'df <- data.frame(a = 1:3)',
	'df$b <- df$a * 2',
	'df |> filter(a > 1)',
	'l <- list(a = 1)',
	'l$a <- 3',
	'names(l) <- "b"',
	'options(digits = 3)',
	'getOption("digits")',
	'par(mfrow = c(1, 2))',
	'plot(x)',
	'if(y > 2) stop("too big")',
	'for(i in 1:3) x <- x + i',
	'while(x < 10) { x <- x + 1; if(x == 5) break }',
	'repeat { break }',
	'e <- new.env()',
	'assign("w", 5, envir = e)',
	'get("w", envir = e)',
	'assign("x", 42)',
	'local({ x <- 3; x })',
	'eval(quote(x <- 7))',
	'k <- quote(x + 1)',
	'eval(k)',
	'delayedAssign("lazy", x + 1)',
	'lazy',
	'makeActiveBinding("act", function() x, environment())',
	'act',
	'print.foo <- function(x, ...) cat("foo")',
	'structure(1, class = "foo")',
	'tryCatch(stop("e"), error = function(e) x <- 2)',
	'on.exit(print(x))',
	'invisible(x)',
	'x',
	'source("helper.R")',
	'helper_value',
	'sapply(1:3, function(i) i + x)',
	'v <- vapply(l, function(i) i, numeric(1))',
	'set.seed(1)',
	'r <- runif(1)',
	'sink("out.txt")',
	'cat("hi\\n")',
	'sink()',
	'writeLines("a", "f.txt")',
	'readLines("f.txt")',
	'x[2] <- 3',
	'attr(x, "u") <- 1',
	'stopifnot(is.numeric(x))',
	'return(x)',
	'q()'
];

/** The content of the file a fuzzed `source("helper.R")` reads, once in this and once in the changed version. */
export const HelperFile = 'helper_value <- x * 3\nhelper_fn <- function() helper_value';
export const HelperFileChanged = 'helper_value <- 99';

/** The edits of a single-file program, as its list of top-level statements. */
export enum StatementEdit {
	Append        = 'append',
	RemoveLast    = 'remove-last',
	ReplaceLast   = 'replace-last',
	Insert        = 'insert',
	Delete        = 'delete',
	Replace       = 'replace',
	Duplicate     = 'duplicate',
	Swap          = 'swap',
	Comment       = 'comment',
	TrailingSpace = 'trailing-space',
	BlankLine     = 'blank-line',
	NoOp          = 'no-op'
}

const AllEdits = Object.values(StatementEdit);

/** A seeded source of choices, so a failing fuzz run reproduces. */
export class Choices {
	private readonly rng: seedrandom.PRNG;
	constructor(seed: string) {
		this.rng = seedrandom(seed);
	}
	public int(max: number): number {
		return Math.floor(this.rng() * max);
	}
	public pick<T>(xs: readonly T[]): T {
		return xs[this.int(xs.length)];
	}
}

/** Renders the statements as a file, `blank` inserts a blank line before that statement index. */
export function render(statements: readonly string[]): string {
	return statements.join('\n');
}

/** Applies `edit` to the statements, choosing statements from `pool`; `undefined` if the edit does not apply. */
export function applyEdit(statements: readonly string[], edit: StatementEdit, choices: Choices, pool: readonly string[] = StatementPool): string[] | undefined {
	const n = statements.length;
	const at = n === 0 ? 0 : choices.int(n);
	switch(edit) {
		case StatementEdit.Append:        return [...statements, choices.pick(pool)];
		case StatementEdit.RemoveLast:    return n === 0 ? undefined : statements.slice(0, -1);
		case StatementEdit.ReplaceLast:   return n === 0 ? undefined : [...statements.slice(0, -1), choices.pick(pool)];
		case StatementEdit.Insert:        return [...statements.slice(0, at), choices.pick(pool), ...statements.slice(at)];
		case StatementEdit.Delete:        return n === 0 ? undefined : [...statements.slice(0, at), ...statements.slice(at + 1)];
		case StatementEdit.Replace:       return n === 0 ? undefined : [...statements.slice(0, at), choices.pick(pool), ...statements.slice(at + 1)];
		case StatementEdit.Duplicate:     return n === 0 ? undefined : [...statements.slice(0, at + 1), statements[at], ...statements.slice(at + 1)];
		case StatementEdit.Swap:          return n < 2 || at === n - 1 ? undefined : [...statements.slice(0, at), statements[at + 1], statements[at], ...statements.slice(at + 2)];
		case StatementEdit.Comment:       return n === 0 ? undefined : statements.map((s, i) => i === at ? `${s} # note ${choices.int(100)}` : s);
		case StatementEdit.TrailingSpace: return [...statements.slice(0, -1), `${statements.at(-1) ?? ''}   `];
		case StatementEdit.BlankLine:     return n === 0 ? undefined : [...statements.slice(0, at), `\n${statements[at]}`, ...statements.slice(at + 1)];
		case StatementEdit.NoOp:          return [...statements];
	}
}

/**
 * A seeded random sequence of `length` edits on a program of `initial` statements drawn from the pool,
 * favoring the edits at the end of the file, as typing does. Steps that source the helper file carry it,
 * and every few steps the helper file changes, which must invalidate what the analysis kept of it.
 */
export function fuzzedSequence(seed: string, initial: number, length: number, pool: readonly string[] = StatementPool): IncrementalStep[] {
	const choices = new Choices(seed);
	let statements = Array.from({ length: initial }, () => choices.pick(pool));
	const weighted = [...AllEdits, StatementEdit.Append, StatementEdit.Append, StatementEdit.ReplaceLast, StatementEdit.RemoveLast];
	let helper = HelperFile;
	const steps: IncrementalStep[] = [];
	const files = () => ({ 'script.R': render(statements), 'helper.R': helper });
	steps.push({ files: files() });
	for(let i = 0; i < length; i++) {
		if(choices.int(8) === 0) {
			helper = helper === HelperFile ? HelperFileChanged : HelperFile;
		} else {
			statements = applyEdit(statements, choices.pick(weighted), choices, pool) ?? statements;
		}
		steps.push({ files: files() });
	}
	return steps;
}

/** Grows the program one statement at a time and then shrinks it again, as typing and undoing it does. */
export function typingSequence(statements: readonly string[]): IncrementalStep[] {
	const steps: IncrementalStep[] = [];
	for(let i = 1; i <= statements.length; i++) {
		steps.push({ files: { 'script.R': render(statements.slice(0, i)) } });
	}
	for(let i = statements.length - 1; i >= 1; i--) {
		steps.push({ files: { 'script.R': render(statements.slice(0, i)) } });
	}
	return steps;
}
