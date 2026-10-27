import type { FlowrCapabilityId } from '../../src/r-bridge/data/get';
import type { MutationTarget } from '../functionality/_helper/r-mutations';

/** a program flowR once got wrong, or one standing for what the functionality tests cover, with what R prints for it */
export interface Counterexample extends MutationTarget {
	readonly name:         string;
	readonly capabilities: readonly FlowrCapabilityId[];
	/** code the slice must leave out wherever the (mutated) program still contains it, so a mutant also keeps the slice precise */
	readonly lacks?:       readonly string[];
}

export interface CounterexampleGroup {
	readonly group: string;
	readonly cases: readonly Counterexample[];
}

/** every counterexample, by what it is about */
export const Counterexamples: readonly CounterexampleGroup[] = [
	{ group: 'Functions stored in containers', cases: [
		{ name: 'call a function held in a list', capabilities: ['dollar-access', 'call-anonymous', 'normal-definition'], code: 'fs <- list(f = function(x) x * 3)\nr <- fs$f(2)\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'call a function held two levels deep', capabilities: ['dollar-access', 'call-anonymous'], code: 'o <- list(inner = list(f = function() 11))\nr <- o$inner$f()\nprint(r)', criterion: '3@r', expected: '[1] 11' },
		{ name: 'argument of a call through $', capabilities: ['dollar-access', 'unnamed-arguments'], code: 'o <- list(f = function(x) x * 2)\nk <- 4\nr <- o$f(k)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'closure in a list sees the later binding', capabilities: ['dollar-access', 'closures'], code: 'k <- 5\nfs <- list(f = function() k)\nk <- 9\nr <- fs$f()\nprint(r)', criterion: '5@r', expected: '[1] 9' },
		{ name: 'two functions assigned through $', capabilities: ['dollar-access', 'replacement-functions'], code: 'o <- list()\no$f <- function() 8\no$g <- function() 9\nr <- o$f() + o$g()\nprint(r)', criterion: '5@r', expected: '[1] 17' },
		{ name: 'function assigned to a list index keeps its body', capabilities: ['double-bracket-access', 'replacement-functions'], code: 'fs <- list()\nfs[[1]] <- function(x) x + 5\nr <- fs[[1]](1)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'functions collected in a loop', capabilities: ['double-bracket-access', 'for-loop', 'closures'], code: 'fs <- list()\nfor(i in 1:2) fs[[i]] <- function() i * 10\nr <- fs[[1]]()\nprint(r)', criterion: '4@r', expected: '[1] 20' },
		{ name: 'function collected by super-assignment from local', capabilities: ['super-left-assignment', 'closures'], code: 'fs <- list()\nfor(i in 1:3) { local({ j <- i; fs[[j]] <<- function() j }) }\nr <- fs[[1]]()\nprint(r)', criterion: '4@r', expected: '[1] 1' },
		{ name: 'closure of a function in a list literal', capabilities: ['double-bracket-access', 'closures'], code: 'k <- 5\nfs <- list(function(x) x + k)\nr <- fs[[1]](1)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'object built from closures over a counter', capabilities: ['dollar-access', 'super-left-assignment', 'closures'], code: 'mk <- function() { cnt <- 0; list(inc = function() cnt <<- cnt + 1, get = function() cnt) }\no <- mk()\no$inc(); o$inc()\nr <- o$get()\nprint(r)', criterion: '5@r', expected: '[1] 2' },
		{ name: 'reference class method mutates its field', capabilities: ['oop-rc', 'dollar-access'], code: 'G <- setRefClass("G2", fields = list(n = "numeric"), methods = list(bump = function() { n <<- n + 1 }))\no <- G$new(n = 1)\no$bump()\nr <- o$n\nprint(r)', criterion: '5@r', expected: '[1] 2' },
	] },

	{ group: 'Functions as values', cases: [
		{ name: 'a function read as a value keeps its body', capabilities: ['normal-definition', 'get-function-structure'], code: 'f <- function() { x <- 1; x + 1 }\nr <- length(deparse(f))\nprint(r)', criterion: '3@r', expected: '[1] 5' },
		{ name: 'a function wrapped by Negate is called through the wrapper', capabilities: ['closures', 'normal-definition'], code: 'thr <- 3\nsmall <- function(x) x < thr\nr <- Filter(Negate(small), 1:5)\nprint(r)', criterion: '4@r', expected: '[1] 3 4 5' },
		{ name: 'a function wrapped by Vectorize is called through the wrapper', capabilities: ['closures', 'normal-definition'], code: 'base <- 5\nf <- function(x) x + base\nr <- sapply(1:2, Vectorize(f))\nprint(r)', criterion: '4@r', expected: '[1] 6 7' },
		{ name: 'functions stored in a list keep their free names', capabilities: ['closures', 'call-anonymous'], code: 'k <- 10\nfs <- list(a = function(x) x + k, b = function(x) x * k)\nr <- unname(sapply(fs, function(f) f(2)))\nprint(r)', criterion: '4@r', expected: '[1] 12 20' },
	] },

	{ group: 'Closures', cases: [
		{ name: 'a sibling closure sees a write made through <<-', capabilities: ['closure-capture', 'dollar-access'], code: 'make <- function() {\n  x <- 1\n  list(get = function() x, set = function(v) x <<- v)\n}\no <- make()\no$set(5)\nr <- o$get()\nprint(r)', criterion: '8@r', expected: '[1] 5' },
		{ name: 'two instances of the same factory still print correctly', capabilities: ['closures'], code: 'counter <- function() {\n  i <- 0\n  function() {\n    i <<- i + 1\n    i\n  }\n}\nc1 <- counter()\nc2 <- counter()\nc1()\nc1()\nr <- c2()\nprint(r)', criterion: '13@r', expected: '[1] 1' },
	] },

	{ group: 'Pure built-ins', cases: [
		{ name: 'setNames leaves its argument alone', capabilities: ['normal-definition'], code: 'df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- setNames(df1, c("A", "B"))\nprint(names(df1))', criterion: '3@print', expected: '[1] "id"   "name"' },
	] },

	{ group: 'Reflection', cases: [
		{ name: 'a body written in reads what it names', capabilities: ['modify-function-structure', 'built-in-quoting'], code: 'k <- 7\nf <- function() 0\nbody(f) <- quote(k)\nr <- f()\nprint(r)', criterion: '5@r', expected: '[1] 7' },
		{ name: 'a nested replacement of the formals reaches the call', capabilities: ['modify-function-structure', 'replacement-functions'], code: 'f <- function(x) x + 1\nformals(f)$x <- 10\nr <- f()\nprint(r)', criterion: '4@r', expected: '[1] 11' },
		{ name: 'a nested replacement of the body reaches the call', capabilities: ['modify-function-structure', 'replacement-functions'], code: 'f <- function() list(a = 1)\nbody(f)$a <- 5\nr <- f()$a\nprint(r)', criterion: '4@r', expected: '[1] 5' },
	] },

	{ group: 'Names computed at run time', cases: [
		{ name: 'get with the name in a variable', capabilities: ['name-created-resolved', 'built-in-evaluation'], code: 'nm <- "vv"\nvv <- 8\nr <- get(nm)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'get0 with the name in a variable', capabilities: ['name-created', 'name-created-resolved', 'built-in-evaluation'], code: 'nm <- "vv"\nvv <- 8\nr <- get0(nm)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'match.fun with the name in a variable', capabilities: ['name-created-resolved', 'built-in-evaluation'], code: 's <- "sum"\nf <- match.fun(s)\nr <- f(1:4)\nprint(r)', criterion: '4@r', expected: '[1] 10' },
		{ name: 'get with a name pasted from a number', capabilities: ['name-created-resolved', 'string-templates'], code: 'i <- 1\nv1 <- 5\nr <- get(paste0("v", i))\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		{ name: 'get0 with a name pasted from a number', capabilities: ['name-created', 'name-created-resolved', 'string-templates'], code: 'i <- 1\nv1 <- 5\nr <- get0(paste0("v", i))\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		{ name: 'mget reads every name it is given', capabilities: ['name-created-resolved', 'built-in-evaluation'], code: 'a <- 1\nb <- 2\nr <- sum(unlist(mget(c("a","b"))))\nprint(r)', criterion: '4@r', expected: '[1] 3' },
		{ name: 'exists depends on the binding it asks about', capabilities: ['name-created-resolved', 'search-type'], code: 'nm <- "zzz"\nzzz <- 1\nr <- exists(nm)\nprint(r)', criterion: '4@r', expected: '[1] TRUE' },
		{ name: 'eval of a symbol built from a string', capabilities: ['built-in-evaluation', 'name-created-resolved'], code: 'nm <- "qq"\nqq <- 6\nr <- eval(as.name(nm))\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'rm unshadows the built-in again', capabilities: ['dynamic-variable-removal', 'redefinition-of-built-in-functions-primitives'], code: 'sum <- function(x) 1\nr1 <- sum(1:3)\nrm(sum)\nr <- r1 + sum(1:3)\nprint(r)', criterion: '5@r', expected: '[1] 7' },
	] },

	{ group: 'Environments', cases: [
		{ name: 'field written through $ on an environment', capabilities: ['environment-sharing', 'dollar-access'], code: 'e <- new.env()\ne$a <- 1\nr <- e$a\nprint(r)', criterion: '4@r', expected: '[1] 1' },
		{ name: 'function written through $ on an environment', capabilities: ['environment-sharing', 'dollar-access'], code: 'e <- new.env()\ne$f <- function() 15\nr <- e$f()\nprint(r)', criterion: '4@r', expected: '[1] 15' },
		{ name: 'a closure inside a function keeps what it captures', capabilities: ['closures', 'super-left-assignment', 'exceptions-and-errors'], code: 'tally <- 0\nsafe <- function(f) tryCatch(f(), error = function(e) { tally <<- tally + 1; NA })\nignore <- safe(function() stop(\'x\'))\nprint(tally)', criterion: '4@print', expected: '[1] 1' },
		{ name: 'field of an environment read inside a function', capabilities: ['environment-sharing', 'closures'], code: 'e <- new.env()\ne$a <- function() 1\ne$b <- function() e$a() + 1\nr <- e$b()\nprint(r)', criterion: '5@r', expected: '[1] 2' },
		{ name: 'environment modified by a callee', capabilities: ['environment-sharing', 'functions-with-global-side-effects'], code: 'e <- new.env()\ne$a <- 1\nf <- function(en) en$a <- 42\nf(e)\nr <- e$a\nprint(r)', criterion: '6@r', expected: '[1] 42' },
		{ name: 'ls sees what was assigned into the environment', capabilities: ['environment-sharing', 'search-path'], code: 'e <- new.env()\nassign("x1", 1, envir = e)\nr <- length(ls(e))\nprint(r)', criterion: '4@r', expected: '[1] 1' },
		{ name: 'environment<- decides where the body looks up', capabilities: ['environment-sharing', 'modify-function-structure'], code: 'f <- function() x\ne <- new.env()\nassign("x", 77, envir = e)\nenvironment(f) <- e\nr <- f()\nprint(r)', criterion: '6@r', expected: '[1] 77' },
		{ name: 'writing into a closure environment', capabilities: ['environment-sharing', 'closures'], code: 'f <- function() { y <- 3; function() y }\ng <- f()\nenvironment(g)$y <- 10\nr <- g()\nprint(r)', criterion: '5@r', expected: '[1] 10' },
		{ name: 'list2env defines each element as a binding', capabilities: ['environment-sharing', 'dynamic-environment-resolution'], code: 'l <- list(p = 3, q = 4)\ninvisible(list2env(l, envir = environment()))\nr <- p + q\nprint(r)', criterion: '4@r', expected: '[1] 7' },
		{ name: 'makeActiveBinding creates a binding', capabilities: ['environment-sharing', 'closures'], code: 'v <- 13\nmakeActiveBinding("ab", function() v, environment())\nr <- ab\nprint(r)', criterion: '4@r', expected: '[1] 13' },
		{ name: 'reading an active binding runs its function', capabilities: ['environment-sharing', 'closures', 'super-left-assignment'], code: 'n <- 0\nmakeActiveBinding("tick", function() { n <<- n + 1; n }, environment())\ntick\ntick\nprint(n)', criterion: '5@n', expected: '[1] 2' },
		{ name: 'parent.frame()$x reads the caller\'s variable', capabilities: ['parent-frame', 'dollar-access'], code: 'f <- function() { g <- function() parent.frame()$z; z <- 4; g() }\nr <- f()\nprint(r)', criterion: '3@r', expected: '[1] 4' },
		{ name: 'eval.parent assigns in the caller', capabilities: ['built-in-evaluation', 'parent-frame'], code: 'f <- function() eval.parent(quote(pp <- 3))\nf()\nr <- pp\nprint(r)', criterion: '4@r', expected: '[1] 3' },
	] },

	{ group: 'Side effects of a function handed to another', cases: [
		{ name: 'sapply over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(sapply(1:3, function(i) s <<- s + i))\nprint(s)', criterion: '3@s', expected: '[1] 6' },
		{ name: 'lapply over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 'acc <- c()\ninvisible(lapply(1:3, function(i) acc <<- c(acc, i)))\nr <- sum(acc)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'mapply over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 'tot <- 0\ninvisible(mapply(function(a,b) tot <<- tot + a*b, 1:2, 3:4))\nprint(tot)', criterion: '3@tot', expected: '[1] 11' },
		{ name: 'Map over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(Map(function(i) s <<- s + i, 1:3))\nprint(s)', criterion: '3@s', expected: '[1] 6' },
		{ name: 'Reduce over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(Reduce(function(a, b) { s <<- s + b; a + b }, 1:3))\nprint(s)', criterion: '3@s', expected: '[1] 5' },
		{ name: 'Filter over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(Filter(function(i) { s <<- s + i; TRUE }, 1:3))\nprint(s)', criterion: '3@s', expected: '[1] 6' },
		{ name: 'do.call over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(do.call(function(a) s <<- a, list(7)))\nprint(s)', criterion: '3@s', expected: '[1] 7' },
	] },

	{ group: 'Condition handling', cases: [
		{ name: 'the error handler wins over the aborted body', capabilities: ['exceptions-and-errors', 'super-left-assignment'], code: 'v <- 0\ntryCatch({ v <- 1; stop("x") }, error = function(e) v <<- 2)\nprint(v)', criterion: '3@v', expected: '[1] 2' },
		{ name: 'finally runs after the handler', capabilities: ['exceptions-and-errors'], code: 'v <- 0\ninvisible(tryCatch({ stop("x") }, error = function(e) NULL, finally = { v <- 3 }))\nprint(v)', criterion: '3@v', expected: '[1] 3' },
		{ name: 'a calling handler writes to its enclosing scope', capabilities: ['exceptions-and-errors', 'super-left-assignment'], code: 'v <- 0\nwithCallingHandlers(warning("w"), warning = function(w) { v <<- 5; invokeRestart("muffleWarning") })\nprint(v)', criterion: '3@v', expected: '[1] 5' },
	] },

	{ group: 'Lazy evaluation', cases: [
		{ name: 'a promise is forced after the body assigned', capabilities: ['formals-promises', 'super-left-assignment'], code: 'f <- function(a) { x <<- 99; a }\nx <- 1\nr <- f(x)\nprint(r)', criterion: '4@r', expected: '[1] 99' },
		{ name: 'a default argument sees the reassigned parameter', capabilities: ['formals-default', 'formals-promises'], code: 'f <- function(a, b = a * 2) { a <- 10; b }\nr <- f(3)\nprint(r)', criterion: '3@r', expected: '[1] 20' },
	] },

	{ group: 'Loops', cases: [
		{ name: 'while(TRUE) stops at its break', capabilities: ['while-loop', 'break'], code: 'i <- 0\nwhile(TRUE) { i <- i + 1; if(i >= 3) break }\nprint(i)', criterion: '3@print', expected: '[1] 3' }
	] },

	{ group: 'Communication through files', cases: [
		{ name: 'cat writes what readLines reads back', capabilities: ['i-o'], code: 'f <- tempfile()\ncat("hi\\n", file = f)\nr <- readLines(f)\nprint(r)', criterion: '4@r', expected: '[1] "hi"' },
		{ name: 'what is read back was written before', capabilities: ['i-o'], code: 'f <- tempfile()\nwriteLines("hi", f)\nr <- readLines(f)\nprint(r)', criterion: '4@r', expected: '[1] "hi"' },
		{ name: 'readRDS depends on the matching saveRDS', capabilities: ['i-o', 'handling-binary-riles'], code: 'f <- tempfile()\nsaveRDS(11, f)\nr <- readRDS(f)\nprint(r)', criterion: '4@r', expected: '[1] 11' },
	] },

	{ group: 'Files named in the working directory', cases: [
		{ name: 'a read of one file does not keep a plot written to another', capabilities: ['i-o', 'graphics-state', 'working-directory'], code: 'setwd(tempdir())\nwriteLines("1", "b.txt")\npdf("a.pdf")\nplot(1)\ninvisible(dev.off())\nr <- readLines("b.txt")\nprint(r)', criterion: '7@r', expected: '[1] "1"', lacks: ['pdf(', 'plot(', 'dev.off('] },
		{ name: 'the file a device writes keeps the device', capabilities: ['i-o', 'graphics-state', 'working-directory'], code: 'setwd(tempdir())\nunlink("p.pdf")\npdf("p.pdf")\nplot(1)\ninvisible(dev.off())\nr <- file.exists("p.pdf")\nprint(r)', criterion: '7@r', expected: '[1] TRUE' },
		{ name: 'a device closed in a function writes its file', capabilities: ['i-o', 'graphics-state', 'normal-definition'], code: 'setwd(tempdir())\nunlink("c.pdf")\nclose_dev <- function() invisible(dev.off())\npdf("c.pdf")\nplot(1:3)\nclose_dev()\nr <- file.exists("c.pdf")\nprint(r)', criterion: '8@r', expected: '[1] TRUE' },
		{ name: 'a percent sign in a file name is no pattern', capabilities: ['i-o', 'strings'], code: 'setwd(tempdir())\nwriteLines("x", "o.txt")\nwriteLines("7", "a_%_b.txt")\nr <- readLines("a_%_b.txt")\nprint(r)', criterion: '5@r', expected: '[1] "7"', lacks: ['"o.txt"'] },
		{ name: 'a write to another file is not kept', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "m.txt")\nwriteLines("2", "n.txt")\nr <- readLines("m.txt")\nprint(r)', criterion: '5@r', expected: '[1] "1"', lacks: ['"n.txt"'] },
		{ name: 'a write after the read is not kept', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "q.txt")\nr <- readLines("q.txt")\nwriteLines("2", "q.txt")\nprint(r)', criterion: '5@r', expected: '[1] "1"', lacks: ['"2"'] },
		{ name: 'an overwrite hides the earlier write', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "ow.txt")\nwriteLines("2", "ow.txt")\nr <- readLines("ow.txt")\nprint(r)', criterion: '5@r', expected: '[1] "2"' },
		{ name: 'an append keeps the earlier write', capabilities: ['i-o', 'named-arguments'], code: 'setwd(tempdir())\ncat("a\\n", file = "ap.txt")\ncat("b\\n", file = "ap.txt", append = TRUE)\nr <- length(readLines("ap.txt"))\nprint(r)', criterion: '5@r', expected: '[1] 2' },
		{ name: 'a file name held in a variable', capabilities: ['i-o', 'named-arguments'], code: 'setwd(tempdir())\nnm <- "z.csv"\nwrite.csv(data.frame(a = 4), nm, row.names = FALSE)\nr <- read.csv(nm)$a\nprint(r)', criterion: '5@r', expected: '[1] 4' },
		{ name: 'file names computed in a loop', capabilities: ['i-o', 'for-loop', 'string-templates'], code: 'setwd(tempdir())\nfor(i in 1:2) writeLines(as.character(i), paste0("o", i, ".txt"))\nr <- readLines("o2.txt")\nprint(r)', criterion: '4@r', expected: '[1] "2"' },
		{ name: 'saveRDS to another file is not kept', capabilities: ['i-o', 'handling-binary-riles'], code: 'setwd(tempdir())\nsaveRDS(1, "s1.rds")\nsaveRDS(2, "s2.rds")\nr <- readRDS("s2.rds")\nprint(r)', criterion: '5@r', expected: '[1] 2', lacks: ['"s1.rds"'] },
		{ name: 'a write in a called function reaches the read', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nf <- function(p) writeLines("9", p)\nf("w.txt")\nr <- readLines("w.txt")\nprint(r)', criterion: '5@r', expected: '[1] "9"' },
		{ name: 'each call of a helper writes the file it names', capabilities: ['i-o', 'normal-definition', 'string-templates'], code: 'setwd(tempdir())\nsave_it <- function(n, v) writeLines(v, paste0(n, ".txt"))\nsave_it("pa", "1")\nsave_it("pb", "2")\nr <- readLines("pa.txt")\nprint(r)', criterion: '6@r', expected: '[1] "1"', lacks: ['"pb"'] },
		{ name: 'a helper called again overwrites its file', capabilities: ['i-o', 'normal-definition', 'string-templates'], code: 'setwd(tempdir())\nsave_it <- function(n, v) writeLines(v, paste0(n, ".txt"))\nsave_it("po", "1")\nsave_it("po", "2")\nr <- readLines("po.txt")\nprint(r)', criterion: '6@r', expected: '[1] "2"' },
		{ name: 'a default names the file of a call leaving it out', capabilities: ['i-o', 'normal-definition', 'formals-default'], code: 'setwd(tempdir())\nsave_it <- function(v, n = "pd") writeLines(v, paste0(n, ".txt"))\nsave_it("1")\nsave_it("2", "pe")\nr <- readLines("pd.txt")\nprint(r)', criterion: '6@r', expected: '[1] "1"', lacks: ['"pe"'] },
		{ name: 'a helper writing a file in its body before returning', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nsave_it <- function(p, v) { writeLines(v, p); invisible(nchar(p)) }\nsave_it("pq.txt", "4")\nsave_it("pr.txt", "5")\nr <- readLines("pq.txt")\nprint(r)', criterion: '6@r', expected: '[1] "4"', lacks: ['"pr.txt"'] },
		{ name: 'a helper calling a helper writes the file named at the outer call', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nw <- function(p, v) writeLines(v, p)\ng <- function(p) w(p, toupper(p))\ng("pu.txt")\ng("pv.txt")\nr <- readLines("pu.txt")\nprint(r)', criterion: '7@r', expected: '[1] "PU.TXT"', lacks: ['"pv.txt"'] },
		{ name: 'a read of a file not known keeps every call of the helper', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nsave_it <- function(p, v) writeLines(v, p)\nsave_it("ps.txt", "6")\nsave_it("pt.txt", "6")\nr <- readLines(c("ps.txt", "pt.txt")[nchar("ab")])\nprint(r)', criterion: '6@r', expected: '[1] "6"' },
		{ name: 'a helper piped into writes the file piped in', capabilities: ['i-o', 'normal-definition', 'pipe-and-pipe-bind'], code: 'setwd(tempdir())\nsave_to <- function(p) writeLines("3", p)\n"pp.txt" |> save_to()\nr <- readLines("pp.txt")\nprint(r)', criterion: '5@r', expected: '[1] "3"' },
		{ name: 'unlink removes the file file.exists asks about', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "u.txt")\nunlink("u.txt")\nr <- file.exists("u.txt")\nprint(r)', criterion: '5@r', expected: '[1] FALSE' },
		{ name: 'file.copy reads what was written to its source', capabilities: ['i-o', 'named-arguments'], code: 'setwd(tempdir())\nwriteLines("c", "src.txt")\ninvisible(file.copy("src.txt", "dst.txt", overwrite = TRUE))\nr <- readLines("dst.txt")\nprint(r)', criterion: '5@r', expected: '[1] "c"' },
		{ name: 'what a sink captures is read back', capabilities: ['i-o'], code: 'setwd(tempdir())\nsink("sk.txt")\nprint(3)\nsink()\nr <- readLines("sk.txt")\nprint(r)', criterion: '6@r', expected: '[1] "[1] 3"' },
		{ name: 'a path below the working directory', capabilities: ['i-o', 'working-directory'], code: 'setwd(tempdir())\ndir.create("pd", showWarnings = FALSE)\nwriteLines("8", "pd/x.txt")\nwriteLines("9", "pd/y.txt")\nr <- readLines("pd/x.txt")\nprint(r)', criterion: '6@r', expected: '[1] "8"', lacks: ['"9"'] },
		{ name: 'the same name in two directories', capabilities: ['i-o', 'working-directory'], code: 'd <- file.path(tempdir(), "sub")\ndir.create(d, showWarnings = FALSE)\nsetwd(tempdir())\nwriteLines("top", "v.txt")\nwriteLines("sub", file.path(d, "v.txt"))\nsetwd(d)\nr <- readLines("v.txt")\nprint(r)', criterion: '8@r', expected: '[1] "sub"' }
	] },

	{ group: 'The working directory', cases: [
		{ name: 'a relative read depends on the directory set before', capabilities: ['working-directory', 'i-o'], code: 'd <- file.path(tempdir(), "wd1")\ndir.create(d, showWarnings = FALSE)\nwriteLines("5", file.path(d, "v.txt"))\nsetwd(d)\nr <- readLines("v.txt")\nprint(r)', criterion: '6@r', expected: '[1] "5"' },
		{ name: 'a value does not depend on the directory', capabilities: ['working-directory'], code: 'setwd(tempdir())\nx <- 3\nsetwd(tempdir())\nprint(x)', criterion: '4@x', expected: '[1] 3', lacks: ['setwd('] },
		{ name: 'getwd reads what setwd set', capabilities: ['working-directory'], code: 'setwd(tempdir())\nr <- basename(getwd()) == basename(tempdir())\nprint(r)', criterion: '3@r', expected: '[1] TRUE' },
		{ name: 'setwd returns the directory before', capabilities: ['working-directory'], code: 'setwd(tempdir())\nold <- setwd(dirname(tempdir()))\nr <- basename(old) == basename(tempdir())\nprint(r)', criterion: '4@r', expected: '[1] TRUE' },
		{ name: 'a directory changed in a function', capabilities: ['working-directory', 'normal-definition', 'i-o'], code: 'd <- file.path(tempdir(), "wd2")\ndir.create(d, showWarnings = FALSE)\nwriteLines("6", file.path(d, "v.txt"))\ngo <- function() setwd(d)\ngo()\nr <- readLines("v.txt")\nprint(r)', criterion: '7@r', expected: '[1] "6"' }
	] },

	{ group: 'Values beside ambient state', cases: [
		{ name: 'a value does not depend on files, devices or the generator', capabilities: ['i-o', 'graphics-state'], code: 'setwd(tempdir())\nwriteLines("1", "k.txt")\nset.seed(1)\nu <- runif(1)\npdf("k.pdf")\nplot(u)\ninvisible(dev.off())\nv <- rep(c("a", "b"), 2)\nprint(v)', criterion: '9@v', expected: '[1] "a" "b" "a" "b"', lacks: ['writeLines', 'set.seed', 'runif', 'pdf(', 'plot(', 'dev.off', 'setwd('] },
		{ name: 'a package loaded before does not make rep opaque', capabilities: ['library-loading'], code: 'library(dplyr, warn.conflicts = FALSE)\nset.seed(2)\nu <- runif(1)\nv <- rep(1, 3)\nprint(v)', criterion: '5@v', expected: '[1] 1 1 1', lacks: ['set.seed', 'runif'] },
		{ name: 'a draw depends on the seed set before', capabilities: ['functions-with-global-side-effects'], code: 'set.seed(1)\na <- runif(1)\nb <- round(runif(1), 4)\nprint(b)', criterion: '4@b', expected: '[1] 0.3721' },
		{ name: 'printing reads the digits option', capabilities: ['built-in-options'], code: 'options(digits = 3)\nx <- pi\nprint(x)', criterion: '3@print', expected: '[1] 3.14' },
		{ name: 'an option restored is not set anymore', capabilities: ['built-in-options'], code: 'op <- options(digits = 3)\noptions(op)\nx <- pi\nprint(x)', criterion: '4@print', expected: '[1] 3.141593' },
		{ name: 'an environment variable set is read back', capabilities: ['functions-with-global-side-effects'], code: 'Sys.setenv(MUT_X = "7")\nr <- Sys.getenv("MUT_X")\nprint(r)', criterion: '3@r', expected: '[1] "7"' },
		{ name: 'par set before is what par reports', capabilities: ['graphics-state'], code: 'pdf(NULL)\npar(mfrow = c(1, 2))\nr <- par("mfrow")\ninvisible(dev.off())\nprint(r)', criterion: '5@r', expected: '[1] 1 2' }
	] },

	{ group: 'Model formulae', cases: [
		{ name: 'a formula reads the names it binds', capabilities: ['model-formula'], code: 'y <- c(1, 2, 4)\nx <- c(1, 2, 3)\nm <- coef(lm(y ~ x))[[2]]\nprint(m)', criterion: '4@m', expected: '[1] 1.5' },
		{ name: 'a formula over the columns of data', capabilities: ['model-formula', 'named-arguments'], code: 'x <- 100\nd <- data.frame(x = 1:3, y = c(2, 4, 6))\nm <- coef(lm(y ~ x, data = d))[[2]]\nprint(m)', criterion: '4@m', expected: '[1] 2' },
		{ name: 'a boxplot over a formula keeps its names', capabilities: ['model-formula', 'graphics-state'], code: 'p <- c(1, 5, 3, 4)\ns <- factor(c("a", "a", "b", "b"))\nb <- boxplot(p ~ s, plot = FALSE)$n\nprint(b)', criterion: '4@b', expected: '[1] 2 2' }
	] },

	{ group: 'Plots saved by ggplot2', cases: [
		{ name: 'ggsave saves the last plot', capabilities: ['library-loading', 'graphics-state', 'i-o'], code: 'library(ggplot2)\nsetwd(tempdir())\nunlink("g.pdf")\nggplot(mtcars, aes(mpg, wt)) + geom_point()\nggsave("g.pdf", width = 2, height = 2)\nr <- file.exists("g.pdf")\nprint(r)', criterion: '7@r', expected: '[1] TRUE' },
		{ name: 'ggsave to another file is not kept', capabilities: ['library-loading', 'graphics-state', 'i-o'], code: 'library(ggplot2)\nsetwd(tempdir())\nwriteLines("1", "h.txt")\np <- ggplot(mtcars, aes(mpg, wt)) + geom_point()\nggsave("g2.pdf", p, width = 2, height = 2)\nr <- readLines("h.txt")\nprint(r)', criterion: '7@r', expected: '[1] "1"', lacks: ['ggsave', 'ggplot('] }
	] },

	{ group: 'Assignments and redefinitions', cases: [
		{ name: 'a redefinition hides the first binding', capabilities: ['local-left-assignment'], code: 'x <- 1\nx <- 2\ny <- x\nprint(y)', criterion: '4@y', expected: '[1] 2' },
		{ name: 'a later redefinition does not reach back', capabilities: ['local-left-assignment'], code: 'x <- 3\ny <- x * 2\nx <- 10\nprint(y)', criterion: '4@y', expected: '[1] 6' },
		{ name: 'a right assignment defines its target', capabilities: ['local-right-assignment'], code: '5 -> a\nb <- a + 1\nprint(b)', criterion: '3@b', expected: '[1] 6' },
		{ name: 'an equals assignment defines its target', capabilities: ['local-equal-assignment'], code: 'a = 4\nb = a * a\nprint(b)', criterion: '3@b', expected: '[1] 16' },
		{ name: 'a chained assignment defines both names', capabilities: ['local-left-assignment', 'return-value-of-assignments'], code: 'a <- b <- 3\nr <- a + b\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'the value of an assignment is used', capabilities: ['return-value-of-assignments', 'grouping'], code: 'r <- (x <- 4) + 1\nprint(r)', criterion: '2@r', expected: '[1] 5' },
		{ name: 'an assignment inside an argument defines its name', capabilities: ['side-effects-in-argument'], code: 'r <- sum(y <- 1:3)\nprint(y)', criterion: '2@y', expected: '[1] 1 2 3' },
		{ name: 'an index replacement keeps the rest of the vector', capabilities: ['replacement-functions', 'single-bracket-access'], code: 'x <- c(1, 2, 3)\nx[2] <- 10\nr <- sum(x)\nprint(r)', criterion: '4@r', expected: '[1] 14' },
		{ name: 'names<- labels the vector read later', capabilities: ['replacement-functions', 'double-bracket-access'], code: 'v <- 1:2\nnames(v) <- c("a", "b")\nr <- v[["b"]]\nprint(r)', criterion: '4@r', expected: '[1] 2' },
		{ name: 'a field added through $ joins the list', capabilities: ['replacement-functions', 'dollar-access'], code: 'l <- list(a = 1)\nl$b <- 2\nr <- l$a + l$b\nprint(r)', criterion: '4@r', expected: '[1] 3' },
		{ name: 'a field added through [[ joins the list', capabilities: ['replacement-functions', 'double-bracket-access'], code: 'l <- list()\nl[["k"]] <- 5\nr <- l[["k"]]\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		{ name: 'an attribute set is read back', capabilities: ['replacement-functions', 'attributes'], code: 'x <- 1\nattr(x, "u") <- 3\nr <- attr(x, "u")\nprint(r)', criterion: '4@r', expected: '[1] 3' }
	] },

	{ group: 'Control flow', cases: [
		{ name: 'both branches assign the variable', capabilities: ['if'], code: 'x <- 3\nif(x > 2) y <- 1 else y <- 2\nprint(y)', criterion: '3@y', expected: '[1] 1' },
		{ name: 'an if used as a value', capabilities: ['if', 'strings'], code: 'x <- 1\ny <- if(x > 2) "big" else "small"\nprint(y)', criterion: '3@y', expected: '[1] "small"' },
		{ name: 'a for loop accumulates', capabilities: ['for-loop'], code: 's <- 0\nfor(i in 1:4) s <- s + i\nprint(s)', criterion: '3@s', expected: '[1] 10' },
		{ name: 'next skips the rest of the body', capabilities: ['for-loop', 'next'], code: 's <- 0\nfor(i in 1:5) { if(i %% 2 == 0) next; s <- s + i }\nprint(s)', criterion: '3@s', expected: '[1] 9' },
		{ name: 'a while loop runs until its condition fails', capabilities: ['while-loop'], code: 'i <- 0\nwhile(i < 5) i <- i + 2\nprint(i)', criterion: '3@i', expected: '[1] 6' },
		{ name: 'a repeat loop runs until its break', capabilities: ['repeat-loop', 'break'], code: 'i <- 0\nrepeat { i <- i + 1; if(i == 4) break }\nprint(i)', criterion: '3@i', expected: '[1] 4' },
		{ name: 'switch picks the named case', capabilities: ['switch'], code: 'k <- "b"\nr <- switch(k, a = 1, b = 2, 3)\nprint(r)', criterion: '3@r', expected: '[1] 2' },
		{ name: 'switch falls through an empty case', capabilities: ['switch', 'empty-arguments'], code: 'k <- "x"\nr <- switch(k, x = , y = "xy", "other")\nprint(r)', criterion: '3@r', expected: '[1] "xy"' },
		{ name: 'nested loops multiply their counts', capabilities: ['for-loop'], code: 's <- 0\nfor(i in 1:3) for(j in 1:2) s <- s + i * j\nprint(s)', criterion: '3@s', expected: '[1] 18' },
		{ name: 'the loop variable keeps its last value', capabilities: ['for-loop'], code: 'for(i in 1:3) NULL\nr <- i\nprint(r)', criterion: '3@r', expected: '[1] 3' },
		{ name: 'an untaken branch leaves the variable alone', capabilities: ['if', 'logical'], code: 'x <- 0\nif(FALSE) x <- 1\nprint(x)', criterion: '3@x', expected: '[1] 0' },
		{ name: 'a while loop with a computed step', capabilities: ['while-loop', 'if'], code: 'n <- 10\nsteps <- 0\nwhile(n != 1) { n <- if(n %% 2 == 0) n / 2 else 3 * n + 1; steps <- steps + 1 }\nprint(steps)', criterion: '4@steps', expected: '[1] 6' },
		{ name: 'ifelse chooses per element', capabilities: ['vectorized-operator-or-functions', 'if'], code: 'v <- c(1, 5, 3)\nr <- ifelse(v > 2, "hi", "lo")\nprint(r)', criterion: '3@r', expected: '[1] "lo" "hi" "hi"' }
	] },

	{ group: 'Function definitions and calls', cases: [
		{ name: 'two arguments by position', capabilities: ['normal-definition', 'unnamed-arguments'], code: 'f <- function(a, b) a + b\nr <- f(1, 2)\nprint(r)', criterion: '3@r', expected: '[1] 3' },
		{ name: 'a default argument fills in', capabilities: ['formals-default'], code: 'f <- function(a, b = 10) a * b\nr <- f(2)\nprint(r)', criterion: '3@r', expected: '[1] 20' },
		{ name: 'arguments by name in another order', capabilities: ['named-arguments'], code: 'f <- function(a, b) a - b\nr <- f(b = 1, a = 5)\nprint(r)', criterion: '3@r', expected: '[1] 4' },
		{ name: 'dots collect every argument', capabilities: ['formals-dot-dot-dot'], code: 'f <- function(...) sum(...)\nr <- f(1, 2, 3)\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'dots are forwarded to another function', capabilities: ['formals-dot-dot-dot'], code: 'g <- function(x, y) x * y\nf <- function(...) g(...)\nr <- f(3, 4)\nprint(r)', criterion: '4@r', expected: '[1] 12' },
		{ name: 'a recursive function', capabilities: ['recursion', 'if'], code: 'fact <- function(n) if(n <= 1) 1 else n * fact(n - 1)\nr <- fact(5)\nprint(r)', criterion: '3@r', expected: '[1] 120' },
		{ name: 'mutually recursive functions', capabilities: ['recursion', 'if'], code: 'ev <- function(n) if(n == 0) TRUE else od(n - 1)\nod <- function(n) if(n == 0) FALSE else ev(n - 1)\nr <- ev(4)\nprint(r)', criterion: '4@r', expected: '[1] TRUE' },
		{ name: 'an early return', capabilities: ['return', 'if'], code: 'f <- function(x) { if(x > 0) return("pos"); "nonpos" }\nr <- f(3)\nprint(r)', criterion: '3@r', expected: '[1] "pos"' },
		{ name: 'a function made by a factory', capabilities: ['closures'], code: 'adder <- function(n) function(x) x + n\nadd2 <- adder(2)\nr <- add2(5)\nprint(r)', criterion: '4@r', expected: '[1] 7' },
		{ name: 'a function reads a global', capabilities: ['lexicographic-scope'], code: 'k <- 4\nf <- function() k * 2\nr <- f()\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'a local binding shadows the global one', capabilities: ['lexicographic-scope'], code: 'x <- 1\nf <- function() { x <- 2; x }\nr <- f() + x\nprint(r)', criterion: '4@r', expected: '[1] 3' },
		{ name: 'a parameter shadows the global one', capabilities: ['formals', 'lexicographic-scope'], code: 'x <- 100\nf <- function(x) x + 1\nr <- f(1)\nprint(r)', criterion: '4@r', expected: '[1] 2' },
		{ name: 'a function applied twice', capabilities: ['call-anonymous', 'normal-definition'], code: 'apply_twice <- function(f, x) f(f(x))\nr <- apply_twice(function(v) v * 3, 2)\nprint(r)', criterion: '3@r', expected: '[1] 18' },
		{ name: 'sapply over an anonymous function', capabilities: ['call-anonymous', 'vectorized-operator-or-functions'], code: 'v <- c(1, 2, 3)\nr <- sapply(v, function(x) x^2)\nprint(r)', criterion: '3@r', expected: '[1] 1 4 9' },
		{ name: 'lapply results unlisted', capabilities: ['call-anonymous'], code: 'r <- unlist(lapply(1:3, function(i) i * 10))\nprint(r)', criterion: '2@r', expected: '[1] 10 20 30' },
		{ name: 'Reduce folds a vector', capabilities: ['call-anonymous'], code: 'r <- Reduce(function(a, b) a * b, 1:4)\nprint(r)', criterion: '2@r', expected: '[1] 24' },
		{ name: 'Map pairs two vectors', capabilities: ['call-anonymous'], code: 'r <- unlist(Map(function(a, b) a + b, 1:3, 4:6))\nprint(r)', criterion: '2@r', expected: '[1] 5 7 9' },
		{ name: 'vapply checks the type of each result', capabilities: ['call-anonymous'], code: 'r <- vapply(1:3, function(i) i + 0.5, numeric(1))\nprint(r)', criterion: '2@r', expected: '[1] 1.5 2.5 3.5' },
		{ name: 'do.call spreads a list of arguments', capabilities: ['built-in-evaluation'], code: 'xs <- list(1:10)\nr <- do.call(sum, xs)\nprint(r)', criterion: '3@r', expected: '[1] 55' },
		{ name: 'on.exit runs when the function returns', capabilities: ['functions-with-global-side-effects'], code: 'f <- function() { on.exit(cat("bye\\n")); 1 }\nr <- f()\nprint(r)', criterion: '3@r', expected: 'bye\n[1] 1' },
		{ name: 'an invisible result is still a value', capabilities: ['implicit-return'], code: 'f <- function() invisible(5)\nr <- f()\nprint(r)', criterion: '3@r', expected: '[1] 5' },
		{ name: 'an unused argument is never evaluated', capabilities: ['formals-promises'], code: 'f <- function(a, b) a\nr <- f(1, stop("no"))\nprint(r)', criterion: '3@r', expected: '[1] 1' },
		{ name: 'missing asks whether an argument was given', capabilities: ['formals-promises', 'if'], code: 'f <- function(a) if(missing(a)) "none" else a\nr <- f()\nprint(r)', criterion: '3@r', expected: '[1] "none"' },
		{ name: 'Recall calls the function itself', capabilities: ['recursion'], code: 'f <- function(n) if(n <= 0) 0 else n + Recall(n - 1)\nr <- f(4)\nprint(r)', criterion: '3@r', expected: '[1] 10' },
		{ name: 'an anonymous function called at once', capabilities: ['call-anonymous', 'grouping'], code: 'r <- (function(x) x * 2)(21)\nprint(r)', criterion: '2@r', expected: '[1] 42' },
		{ name: 'a lambda is a function', capabilities: ['lambda-syntax'], code: 'sq <- \\(x) x * x\nr <- sq(6)\nprint(r)', criterion: '3@r', expected: '[1] 36' },
		{ name: 'a pipe of two calls', capabilities: ['pipe-and-pipe-bind'], code: 'r <- c(1, 4, 9) |> sqrt() |> sum()\nprint(r)', criterion: '2@r', expected: '[1] 6' },
		{ name: 'a function counting its calls through <<-', capabilities: ['super-left-assignment', 'functions-with-global-side-effects'], code: 'cnt <- 0\ninc <- function() cnt <<- cnt + 1\ninc()\ninc()\nprint(cnt)', criterion: '5@cnt', expected: '[1] 2' },
		{ name: 'a nested function reads the outer parameter', capabilities: ['closures'], code: 'outer_fn <- function(x) { inner <- function(y) x + y; inner(10) }\nr <- outer_fn(5)\nprint(r)', criterion: '3@r', expected: '[1] 15' }
	] },

	{ group: 'Vectors, lists and strings', cases: [
		{ name: 'an element by position', capabilities: ['single-bracket-access'], code: 'v <- c(10, 20, 30)\nr <- v[2]\nprint(r)', criterion: '3@r', expected: '[1] 20' },
		{ name: 'a negative index drops an element', capabilities: ['single-bracket-access', 'unary-operator'], code: 'v <- 1:5\nr <- v[-1]\nprint(r)', criterion: '3@r', expected: '[1] 2 3 4 5' },
		{ name: 'a logical index filters', capabilities: ['single-bracket-access', 'vectorized-operator-or-functions'], code: 'v <- c(3, 8, 1)\nr <- v[v > 2]\nprint(r)', criterion: '3@r', expected: '[1] 3 8' },
		{ name: 'a nested list read through $', capabilities: ['dollar-access'], code: 'l <- list(a = list(b = 7))\nr <- l$a$b\nprint(r)', criterion: '3@r', expected: '[1] 7' },
		{ name: 'a matrix cell', capabilities: ['single-bracket-access', 'named-arguments'], code: 'm <- matrix(1:6, nrow = 2)\nr <- m[2, 3]\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'a sequence reversed', capabilities: ['named-arguments'], code: 'r <- rev(seq(2, 10, by = 4))\nprint(r)', criterion: '2@r', expected: '[1] 10  6  2' },
		{ name: 'a substring in upper case', capabilities: ['strings'], code: 's <- "flowR"\nr <- toupper(substr(s, 1, 4))\nprint(r)', criterion: '3@r', expected: '[1] "FLOW"' },
		{ name: 'paste with a separator', capabilities: ['strings', 'named-arguments'], code: 'a <- "x"\nb <- 3\nr <- paste(a, b, sep = "-")\nprint(r)', criterion: '4@r', expected: '[1] "x-3"' },
		{ name: 'sprintf formats a count', capabilities: ['strings', 'string-templates'], code: 'n <- 5\nr <- sprintf("%d items", n)\nprint(r)', criterion: '3@r', expected: '[1] "5 items"' },
		{ name: 'gsub replaces every match', capabilities: ['strings'], code: 's <- "a-b-c"\nr <- gsub("-", "+", s)\nprint(r)', criterion: '3@r', expected: '[1] "a+b+c"' },
		{ name: 'strsplit and two indices', capabilities: ['strings', 'double-bracket-access'], code: 'r <- strsplit("a,b", ",")[[1]][2]\nprint(r)', criterion: '2@r', expected: '[1] "b"' },
		{ name: 'which.max finds the position', capabilities: ['vectorized-operator-or-functions'], code: 'v <- c(4, 9, 2)\nr <- which.max(v)\nprint(r)', criterion: '3@r', expected: '[1] 2' },
		{ name: 'a NULL is NULL', capabilities: ['null'], code: 'x <- NULL\nr <- is.null(x)\nprint(r)', criterion: '3@r', expected: '[1] TRUE' },
		{ name: 'na.rm leaves out the missing value', capabilities: ['named-arguments', 'logical'], code: 'v <- c(1, NA, 3)\nr <- sum(v, na.rm = TRUE)\nprint(r)', criterion: '3@r', expected: '[1] 4' }
	] },

	{ group: 'Data frames', cases: [
		{ name: 'a column element', capabilities: ['dollar-access', 'single-bracket-access'], code: 'df <- data.frame(a = 1:3, b = c(2, 4, 6))\nr <- df$b[2]\nprint(r)', criterion: '3@r', expected: '[1] 4' },
		{ name: 'a column computed from another', capabilities: ['dollar-access', 'replacement-functions'], code: 'df <- data.frame(a = 1:3)\ndf$b <- df$a * 2\nr <- sum(df$b)\nprint(r)', criterion: '4@r', expected: '[1] 12' },
		{ name: 'rows filtered by a column', capabilities: ['single-bracket-access', 'dollar-access'], code: 'df <- data.frame(a = 1:4, b = c(5, 6, 7, 8))\nr <- df[df$a > 2, "b"]\nprint(r)', criterion: '3@r', expected: '[1] 7 8' },
		{ name: 'the shape of a data frame', capabilities: ['normal-definition'], code: 'df <- data.frame(a = 1:3, b = 4:6)\nr <- nrow(df) * ncol(df)\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'the column names', capabilities: ['strings'], code: 'df <- data.frame(x = 1, y = 2)\nr <- colnames(df)\nprint(r)', criterion: '3@r', expected: '[1] "x" "y"' },
		{ name: 'two frames bound by rows', capabilities: ['normal-definition'], code: 'd1 <- data.frame(a = 1)\nd2 <- data.frame(a = 2)\nr <- nrow(rbind(d1, d2))\nprint(r)', criterion: '4@r', expected: '[1] 2' },
		{ name: 'two frames merged on a key', capabilities: ['dollar-access'], code: 'a <- data.frame(k = 1:2, x = 3:4)\nb <- data.frame(k = 2:3, y = 5:6)\nr <- merge(a, b)$x\nprint(r)', criterion: '4@r', expected: '[1] 4' },
		{ name: 'a column read through [[', capabilities: ['double-bracket-access', 'single-bracket-access'], code: 'df <- data.frame(a = c(1, 2))\nr <- df[["a"]][1]\nprint(r)', criterion: '3@r', expected: '[1] 1' },
		{ name: 'tapply groups a vector', capabilities: ['vectorized-operator-or-functions'], code: 'v <- c(1, 2, 3, 4)\ng <- c("a", "b", "a", "b")\nr <- unname(tapply(v, g, sum))\nprint(r)', criterion: '4@r', expected: '[1] 4 6' }
	] },

	{ group: 'Objects', cases: [
		{ name: 'an S3 method is dispatched on the class', capabilities: ['oop-s3-dispatch'], code: 'area <- function(s) UseMethod("area")\narea.sq <- function(s) s$w^2\nx <- structure(list(w = 3), class = "sq")\nr <- area(x)\nprint(r)', criterion: '5@r', expected: '[1] 9' },
		{ name: 'an S3 default method', capabilities: ['oop-s3-dispatch'], code: 'desc <- function(o) UseMethod("desc")\ndesc.default <- function(o) "thing"\nr <- desc(1)\nprint(r)', criterion: '4@r', expected: '[1] "thing"' },
		{ name: 'an S4 slot is read', capabilities: ['oop-s4-construction', 'slot-access'], code: 'setClass("P", representation(n = "numeric"))\np <- new("P", n = 4)\nr <- p@n\nprint(r)', criterion: '4@r', expected: '[1] 4' },
		{ name: 'inherits reads the class vector', capabilities: ['oop-s3-inheritance'], code: 'o <- structure(1, class = c("b", "a"))\nr <- inherits(o, "a")\nprint(r)', criterion: '3@r', expected: '[1] TRUE' }
	] },

	{ group: 'Evaluation and scopes', cases: [
		{ name: 'local evaluates a block in its own scope', capabilities: ['local-envir-argument'], code: 'r <- local({ a <- 2; a * 3 })\nprint(r)', criterion: '2@r', expected: '[1] 6' },
		{ name: 'get reads from the environment it is given', capabilities: ['environment-sharing', 'named-arguments'], code: 'e <- new.env()\nassign("v", 9, envir = e)\nr <- get("v", envir = e)\nprint(r)', criterion: '4@r', expected: '[1] 9' },
		{ name: 'exists of a name never bound', capabilities: ['search-type'], code: 'r <- exists("not_defined_here_xyz")\nprint(r)', criterion: '2@r', expected: '[1] FALSE' },
		{ name: 'with reads the fields of a list', capabilities: ['environment-with', 'data-masking'], code: 'l <- list(a = 2, b = 3)\nr <- with(l, a * b)\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'eval of parsed text', capabilities: ['built-in-parsing', 'built-in-evaluation'], code: 'r <- eval(parse(text = "1 + 2"))\nprint(r)', criterion: '2@r', expected: '[1] 3' },
		{ name: 'a quoted expression sees the later binding', capabilities: ['built-in-quoting', 'built-in-evaluation'], code: 'e <- quote(x * 2)\nx <- 4\nr <- eval(e)\nprint(r)', criterion: '4@r', expected: '[1] 8' }
	] },

	{ group: 'Conditions', cases: [
		{ name: 'the error handler provides the value', capabilities: ['exceptions-and-errors'], code: 'r <- tryCatch(stop("e"), error = function(e) -1)\nprint(r)', criterion: '2@r', expected: '[1] -1' },
		{ name: 'the warning handler provides the value', capabilities: ['exceptions-and-errors'], code: 'r <- tryCatch(as.integer("x"), warning = function(w) 0L)\nprint(r)', criterion: '2@r', expected: '[1] 0' },
		{ name: 'an error raised in a function is caught', capabilities: ['exceptions-and-errors', 'if'], code: 'f <- function(x) if(x < 0) stop("neg") else sqrt(x)\nr <- tryCatch(f(-4), error = function(e) conditionMessage(e))\nprint(r)', criterion: '3@r', expected: '[1] "neg"' },
		{ name: 'finally sees what the body did', capabilities: ['exceptions-and-errors'], code: 'trail <- c()\nr <- tryCatch({ trail <- c(trail, "body"); 1 }, finally = { trail <- c(trail, "fin") })\nprint(trail)', criterion: '3@trail', expected: '[1] "body" "fin"' }
	] }
];
