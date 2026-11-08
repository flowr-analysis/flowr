import { assertSliced, assumeLoadedPackages, withShell, assertSliceMatchesR, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { BuiltInOperators } from '../../../../../src/dataflow/environments/default-builtin-config/base-operators';

describe('eval', { concurrent: false }, withShell(shell => {
	assertSliced(label('simple eval use', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(x)"))', ['2@y'], 'x <- 2\ny <- eval(parse(text="print(x)"))');
	assertSliced(label('simple eval no-use', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(y)"))', ['2@y'], 'y <- eval(parse(text="print(y)"))');
	assertSliced(label('simple eval remote string', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\nt <- "print(x)"\ny <- eval(parse(text=t))', ['3@y'], 'x <- 2\nt <- "print(x)"\ny <- eval(parse(text=t))');
	assertSliced(label('simple eval conditional string', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `k <- 42
x <- 2
if(u) t <- "print(x)" else 
t <- "print(k)"
y <- eval(parse(text=t))`, ['5@y'], `k <- 42
x <- 2
if(u) t <- "print(x)" else
t <- "print(k)"
y <- eval(parse(text=t))`);
	assertSliced(label('using paste', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `k <- "y"
eval(parse(text=paste(k, "<- 2")))
print(y)`, ['3@print'], `k <- "y"
eval(parse(text=paste(k, "<- 2")))
print(y)`);
	assertSliced(label('using paste in for loop', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'for-loop', 'built-in-evaluation', 'newlines']),
		shell, `for(v in c("x", "y")) eval(parse(text=paste(k, "<- 2")))
print(y)`, ['2@print'], `for(v in c("x", "y")) eval(parse(text=paste(k, "<- 2")))
print(y)`);
}));

describe('evalText', { concurrent: false }, withShell(shell => {
	assumeLoadedPackages('FastUtils');
	assertSliced(label('simple evalText use', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 1\ny <- 1\nz <- evalText("x+y")', ['3@z'], 'x <- 1\ny <- 1\nz <- evalText("x+y")');
	assertSliced(label('simple evalText use', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'foo <- function(x) { return (x+2) }\ny <- evalText("foo(4)*1")', ['2@y'], 'foo <- function(x) return (x+2)\ny <- evalText("foo(4)*1")');
	assertSliced(label('simple evalText remote string', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\nt <- "print(x)"\ny <- evalText(t)', ['3@y'], 'x <- 2\nt <- "print(x)"\ny <- evalText(t)');
	assertSliced(label('indirect evalText call', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'y <- 1\nfoo <- function(x) { return (evalText("x+y")) }\nz <- foo(4)', ['3@z'], 'y <- 1\nfoo <- function(x) return (evalText("x+y"))\nz <- foo(4)');
	assertSliced(label('double indirect evalText call', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'y <- 1\nfoo <- function(x) { return (evalText("x+y")) }\nt <- 3\nz <- evalText("foo(4)*2+t")', ['4@z'], 'y <- 1\nfoo <- function(x) return (evalText("x+y"))\nt <- 3\nz <- evalText("foo(4)*2+t")');
	assertSliced(label('mixed evalText/eval call', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'y <- 1\nfoo <- function(x) { return (eval(parse(text ="x+y"))) }\nt <- 3\nz <- evalText("foo(4)*2+t")', ['4@z'], 'y <- 1\nfoo <- function(x) return (eval(parse(text ="x+y")))\nt <- 3\nz <- evalText("foo(4)*2+t")');
	assertSliced(label('simple evalText conditional string', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `k <- 42
x <- 2
if(u) t <- "print(x)" else 
t <- "print(k)"
y <- evalText(t)`, ['5@y'], `k <- 42
x <- 2
if(u) t <- "print(x)" else
t <- "print(k)"
y <- evalText(t)`);
	assertSliced(label('evalText should resolve back', ['name-normal', ...BuiltInOperators.byName['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `x <- 1
y <- 0
for(i in 1:4){
	y <- 4
}
if(u >= 4) y <- 2
t <- evalText("1+y")
print(y)`, ['8@print'], `for(i in 1:4) y <- 4
if(u >= 4) y <- 2
print(y)`);
}));

describe('eval checked against R', withTreeSitter(parser => {
	/* the name, the program, and whether it needs the signature database to know where a function comes from */
	const cases: readonly (readonly [string, string, boolean?])[] = [
		['second eval of the same quote', 'w <- 1\ne <- quote(w <- w + 1)\neval(e)\neval(e)\nprint(w)'],
		['eval of a global quote inside a function', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nf()\nf()\nprint(w)'],
		['eval of a quote in a loop', 'e <- quote(w <- w + 1)\nw <- 1\nfor(i in 1:3) eval(e)\nprint(w)'],
		['eval quote library', 'eval(quote(library(tools)))\nprint(file_ext("a.txt"))', true],
		['with assign temp', 'x <- 0\nwith(list(), x <- 1)\nprint(x)'],
		['eval quote assign', 'x <- 0\neval(quote(x <- 1))\nprint(x)'],
		['eval var quote', 'q <- quote(x <- 2)\neval(q)\nprint(x)'],
		['eval quote options', 'eval(quote(options(digits = 3)))\nprint(pi)'],
		['eval quote newenv', 'e <- new.env()\neval(quote(y <- 1), e)\nprint(e$y)'],
		['eval bquote', 'v <- 7\neval(bquote(x <- .(v)))\nprint(x)'],
		['fn eval superassign', 'f <- function() eval(quote(z <<- 5))\nf()\nprint(z)'],
		['eval quote rng', 'set.seed(1)\neval(quote(invisible(runif(1))))\nprint(runif(1))'],
		['eval quote later def', 'e <- quote(x + 1)\nx <- 5\nprint(eval(e))'],
		['param eval superassign', 'f <- function(ex) eval(ex)\nf(quote(x <<- 3))\nprint(x)'],
		['eval call', 'print(eval(call("sum", 1, 2)))'],
		['eval list of quotes', 'l <- list(quote(x <- 1), quote(x <- 2))\neval(l[[1]])\nprint(x)'],
		['local eval superassign', 'local(eval(quote(x <<- 4)))\nprint(x)'],
		['evalq env', 'e <- new.env()\nevalq(y <- 3, e)\nprint(e$y)'],
		['evalq library', 'evalq(library(tools))\nprint(file_ext("a.txt"))', true],
		['eval expression library', 'eval(expression(library(tools)))\nprint(file_ext("b.R"))', true],
		['eval of several expressions attaching a package', 'eval(expression(library(tools), x <- 1))\nprint(file_ext("a.txt"))', true],
		['eval of several expressions defining one by another', 'x <- 0\neval(expression(y <- 2, x <- y + 1))\nprint(x)'],
		['replicate evaluates its expression each time', 'x <- 0\ninvisible(replicate(3, x <<- x + 1))\nprint(x)'],
		['eval of a quoted library handed through a parameter', 'g <- function(q) eval(q)\ng(quote(library(tools)))\nprint(file_ext("a.txt"))', true],
		['eval var library', 'q <- quote(library(tools))\neval(q)\nprint(file_ext("a.txt"))', true],
		['fn eval library', 'f <- function() eval(quote(library(tools)))\nf()\nprint(file_ext("a.txt"))', true],
		['within assign temp', 'x <- 0\ny <- within(data.frame(a = 1), x <- 1)\nprint(x)'],
		['local assign', 'x <- 0\nlocal(x <- 1)\nprint(x)'],
		['evalq newenv assign', 'x <- 0\nevalq(x <- 1, new.env())\nprint(x)'],
		['eval newenv assign', 'x <- 0\neval(quote(x <- 1), new.env())\nprint(x)'],
		['eval list envir assign', 'x <- 0\neval(quote(x <- 1), list())\nprint(x)'],
		['fn eval local assign', 'x <- 0\nf <- function() eval(quote(x <- 1))\nf()\nprint(x)'],
		['fn eval parent frame', 'x <- 0\nf <- function() eval(quote(x <- 1), parent.frame())\nf()\nprint(x)'],
		['branch eval', 'x <- 0\nif(TRUE) eval(quote(x <- 1))\nprint(x)'],
		['loop eval', 'x <- 0\nfor(i in 1:3) eval(quote(x <- x + i))\nprint(x)'],
		['eval quote file write', 'eval(quote(writeLines("hi", "f.txt")))\nprint(readLines("f.txt"))'],
		['eval var file read', 'writeLines("a", "f.txt")\nq <- quote(y <- readLines("f.txt"))\neval(q)\nprint(y)'],
		['eval quote rm', 'x <- 1\neval(quote(rm(x)))\nprint(exists("x"))'],
		['eval quote assign fn', 'eval(quote(assign("y", 9)))\nprint(y)'],
		['with df read', 'd <- data.frame(a = 1:3)\nprint(with(d, sum(a)))'],
		['with enclosing read', 'a <- 10\nd <- list(b = 1)\nprint(with(d, a + b))'],
		['with superassign', 'x <- 0\nwith(list(), x <<- 1)\nprint(x)'],
		['with env assign', 'e <- new.env()\nwith(e, y <- 2)\nprint(e$y)'],
		['eval quote wrapped library', 'eval(quote(suppressPackageStartupMessages(library(tools))))\nprint(file_ext("x.c"))', true],
		['eval quote block', 'eval(quote({ x <- 1; y <- x + 1 }))\nprint(y)'],
		['eval quote local', 'x <- 0\neval(quote(local(x <- 1)))\nprint(x)'],
		['eval var bquote', 'x <- 5\nq <- bquote(y <- .(x) * 2)\neval(q)\nprint(y)'],
		['fn eval read local', 'x <- 0\nf <- function() { x <- 1; eval(quote(x)) }\nprint(f())'],
		['eval library newenv', 'e <- new.env()\neval(quote(library(tools)), e)\nprint(file_ext("a.txt"))', true],
		['with library', 'with(list(), library(tools))\nprint(file_ext("a.txt"))', true],
		['local library', 'local(library(tools))\nprint(file_ext("a.txt"))', true],
		['eval options newenv', 'eval(quote(options(digits = 3)), new.env())\nprint(pi)'],
		['with mask assign', 'x <- 0\nwith(list(x = 5), x <- x + 1)\nprint(x)'],
		['eval parse text', 'eval(parse(text = "y <- 4"))\nprint(y)'],
		['eval globalenv', 'x <- 0\neval(quote(x <- 1), envir = globalenv())\nprint(x)'],
		['fn eval globalenv', 'f <- function() eval(quote(x <- 1), envir = globalenv())\nf()\nprint(x)'],
		['with env library unknown', 'with(new.env(), library(tools))\nprint(file_ext("a.txt"))', true],
		['evalq newenv library', 'evalq(library(tools), new.env())\nprint(file_ext("a.txt"))', true],
		['eval quote unknown env', 'x <- 0\neval(quote(x <- 1), list2env(list()))\nprint(x)'],
		['with df assign then read', 'x <- 3\nd <- data.frame(a = 1)\nwith(d, x <- 9)\nprint(x + 1)'],
		['fn library', 'f <- function() library(tools)\nf()\nprint(file_ext("a.txt"))', true],
		['expression not run', 'x <- 0\ne <- expression(x <- 1)\nprint(x)'],
		['eval quote self read', 'x <- 1\neval(quote(x <- x + 1))\nprint(x)'],
		['eval branch var library', 'if(TRUE) q <- quote(library(tools)) else q <- quote(NULL)\neval(q)\nprint(file_ext("a.txt"))', true],
		['eval quote rm later', 'x <- 1\ny <- 2\neval(quote(rm(x)))\nprint(y)'],
		['eval quote in fn assign read', 'f <- function() { eval(quote(y <- 2)); y + 1 }\nprint(f())'],
		['evalq assign', 'x <- 0\nevalq(x <- 7)\nprint(x)'],
		['eval quote file read', 'writeLines("z", "g.txt")\neval(quote(v <- readLines("g.txt")))\nprint(v)'],
		['eval bquote library', 'eval(bquote(library(.(as.name("tools")))))\nprint(file_ext("a.txt"))', true],
		['local eval library', 'local(eval(quote(library(tools))))\nprint(file_ext("a.txt"))', true],
		['eval quote def fn', 'eval(quote(h <- function() 42))\nprint(h())'],
		['eval quote closure side effect', 'h <- function() z <<- 3\neval(quote(h()))\nprint(z)'],
		['eval quote def closure read', 'x <- 1\neval(quote(g <- function() x))\nprint(g())'],
		['eval quote for', 'eval(quote(for(i in 1:3) s <- i))\nprint(s)'],
		['eval quote if', 'x <- 0\neval(quote(if(x == 0) y <- 1 else y <- 2))\nprint(y)'],
		['fn var eval read', 'f <- function() { q <- quote(w <- 5); eval(q); w }\nprint(f())'],
		['fn eval assign stays local', 'x <- 0\nf <- function() { eval(quote(x <- 1)); x }\nf()\nprint(x)'],
		['branch eval var library', 'qs <- quote(library(stats4))\nif(TRUE) eval(qs)\nprint(exists("mle"))', true],
		['loop eval var', 'q <- quote(x <- 1)\nx <- 0\nfor(i in 1:2) eval(q)\nprint(x)'],
		['eval var library newenv', 'e <- new.env()\nq <- quote(library(tools))\neval(q, e)\nprint(file_ext("a.R"))', true],
		['eval newenv then global', 'e <- new.env()\neval(quote(z <- 4), e)\nz <- 1\nprint(get("z", envir = e))'],
		['eval environment top', 'x <- 0\neval(quote(x <- 1), environment())\nprint(x)'],
		['eval expression multi', 'x <- 2\neval(expression(x <- x * 3, x <- x + 1))\nprint(x)'],
		['eval nested library', 'eval(quote(eval(quote(library(tools)))))\nprint(file_ext("a.txt"))', true],
		['eval quote of eval var', 'q <- quote(eval(q2))\nq2 <- quote(y <- 8)\neval(q)\nprint(y)'],
		['eval self reference', 'q <- quote(if(FALSE) eval(q))\neval(q)\nprint(2)'],
		['with df superassign', 'x <- 0\nwith(data.frame(a = 1), { x <<- a })\nprint(x)'],
		['within df column', 'd <- data.frame(a = 1)\nd <- within(d, b <- a + 1)\nprint(d$b)'],
		['local superassign read', 'x <- 10\nlocal({ x <- 1; y <<- x })\nprint(y)'],
		['eval quote set seed', 'eval(quote(set.seed(42)))\nprint(runif(1))'],
		['eval var options', 'options(digits = 7)\nq <- quote(options(digits = 2))\neval(q)\nprint(pi)'],
		['eval quote setenv', 'eval(quote(Sys.setenv(FOO = "bar")))\nprint(Sys.getenv("FOO"))'],
		['fn library eval quote call', 'f <- function() { library(tools); eval(quote(file_ext("a.R"))) }\nprint(f())', true],
		['fn eval parent frame read', 'x <- 1\ng <- function() { x <- 2; eval(quote(x), parent.frame()) }\nprint(g())'],
		['eval quote rm redefine', 'x <- 1\neval(quote(rm(x)))\nx <- 5\nprint(x)'],
		['eval quote assign envir arg', 'e <- new.env()\neval(quote(assign("k", 3)), e)\nprint(exists("k"))'],
	];
	for(const [name, code, sigdb] of cases) {
		assertSliceMatchesR(parser, name, code, { sigdb });
	}
}));
