import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';

describe.sequential('eval', withShell(shell => {
	assertSliced(label('simple eval use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(x)"))', ['2@y'], 'x <- 2\ny <- eval(parse(text="print(x)"))');
	assertSliced(label('simple eval no-use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(y)"))', ['2@y'], 'y <- eval(parse(text="print(y)"))');
	assertSliced(label('simple eval remote string', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, 'x <- 2\nt <- "print(x)"\ny <- eval(parse(text=t))', ['3@y'], 'x <- 2\nt <- "print(x)"\ny <- eval(parse(text=t))');
	assertSliced(label('simple eval conditional string', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, `k <- 42
x <- 2
if(u) t <- "print(x)" else 
t <- "print(k)"
y <- eval(parse(text=t))`, ['5@y'], `k <- 42
x <- 2
if(u) t <- "print(x)" else
t <- "print(k)"
y <- eval(parse(text=t))`);
	assertSliced(label('using paste', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, `k <- "y"
eval(parse(text=paste(k, "<- 2")))
print(y)`, ['3@print'], `k <- "y"
eval(parse(text=paste(k, "<- 2")))
print(y)`);
	assertSliced(label('using paste in for loop', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'for-loop', 'built-in-evaluation','newlines']),
		shell, `for(v in c("x", "y")) eval(parse(text=paste(k, "<- 2")))
print(y)`, ['2@print'], `for(v in c("x", "y")) eval(parse(text=paste(k, "<- 2")))
print(y)`);
}));
