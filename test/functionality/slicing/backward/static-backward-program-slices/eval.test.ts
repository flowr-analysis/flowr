import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';

describe.sequential('eval', withShell(shell => {
	assertSliced(label('simple eval use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(x)"))', ['2@y'], 'x <- 2\ny <- eval(parse(text="print(x)"))');
	assertSliced(label('simple eval no-use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(y)"))', ['2@y'], 'y <- eval(parse(text="print(y)"))');
	assertSliced(label('simple eval remote string', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\nt <- "print(x)"\ny <- eval(parse(text=t))', ['3@y'], 'x <- 2\nt <- "print(x)"\ny <- eval(parse(text=t))');
	assertSliced(label('simple eval conditional string', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `k <- 42
x <- 2
if(u) t <- "print(x)" else 
t <- "print(k)"
y <- eval(parse(text=t))`, ['5@y'], `k <- 42
x <- 2
if(u) t <- "print(x)" else
t <- "print(k)"
y <- eval(parse(text=t))`);
	assertSliced(label('using paste', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `k <- "y"
eval(parse(text=paste(k, "<- 2")))
print(y)`, ['3@print'], `k <- "y"
eval(parse(text=paste(k, "<- 2")))
print(y)`);
	assertSliced(label('using paste in for loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'for-loop', 'built-in-evaluation', 'newlines']),
		shell, `for(v in c("x", "y")) eval(parse(text=paste(k, "<- 2")))
print(y)`, ['2@print'], `for(v in c("x", "y")) eval(parse(text=paste(k, "<- 2")))
print(y)`);
}));

describe.sequential('evalText', withShell(shell => {
	assertSliced(label('simple evalText use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 1\ny <- 1\nz <- evalText("x+y")', ['3@z'], 'x <- 1\ny <- 1\nz <- evalText("x+y")');
	assertSliced(label('simple evalText use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'foo <- function(x) { return (x+2) }\ny <- evalText("foo(4)*1")', ['2@y'], 'foo <- function(x) return (x+2)\ny <- evalText("foo(4)*1")');
	assertSliced(label('simple evalText remote string', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\nt <- "print(x)"\ny <- evalText(t)', ['3@y'], 'x <- 2\nt <- "print(x)"\ny <- evalText(t)');
	assertSliced(label('indirect evalText call', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'y <- 1\nfoo <- function(x) { return (evalText("x+y")) }\nz <- foo(4)', ['3@z'], 'y <- 1\nfoo <- function(x) return (evalText("x+y"))\nz <- foo(4)');
	assertSliced(label('double indirect evalText call', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'y <- 1\nfoo <- function(x) { return (evalText("x+y")) }\nt <- 3\nz <- evalText("foo(4)*2+t")', ['4@z'], 'y <- 1\nfoo <- function(x) return (evalText("x+y"))\nt <- 3\nz <- evalText("foo(4)*2+t")');
	assertSliced(label('mixed evalText/eval call', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'y <- 1\nfoo <- function(x) { return (eval(parse(text ="x+y"))) }\nt <- 3\nz <- evalText("foo(4)*2+t")', ['4@z'], 'y <- 1\nfoo <- function(x) return (eval(parse(text ="x+y")))\nt <- 3\nz <- evalText("foo(4)*2+t")');
	assertSliced(label('simple evalText conditional string', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `k <- 42
x <- 2
if(u) t <- "print(x)" else 
t <- "print(k)"
y <- evalText(t)`, ['5@y'], `k <- 42
x <- 2
if(u) t <- "print(x)" else
t <- "print(k)"
y <- evalText(t)`);
	assertSliced(label('evalText should resolve back', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `x <- 1
y <- 0
for(i in 1:4){
	y <- 4
}
if(u >= 4) y <- 2
t <- evalText("1+y")
print(y)`, ['8@print'], `y <- 0
for(i in 1:4) y <- 4
if(u >= 4) y <- 2
print(y)`);
}));
