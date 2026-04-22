import { assertDataflow, assertSliced, withShell, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

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

describe.sequential('eval', withTreeSitter(tr => {
	assertDataflow(label('simple evalText use for dataflow', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'a <- "1+1"\nx <- "1"\nb <- "3"\nz <- eval(parse(text=x))', emptyGraph()
			.defineVariable('2@x')
			.defineVariable('4@z')
			.definedBy('4@z', '4@eval')
			.addEdge('4@eval', '4@parse', EdgeType.Argument | EdgeType.Reads | EdgeType.Returns)
			.addEdge('4@parse', '4@x', EdgeType.Reads)
			.addEdge('4@x', '2@x', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
	assertDataflow(label('simple eval use for dataflow', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'x <- 1\ny <- 1\na <- 2\nz <- eval(parse(text="x+y"))', emptyGraph()
			.definedBy('4@z', '4@eval')
			.addEdge(17, 'eval::17-1:27-1:30-2', EdgeType.Reads | EdgeType.Calls)
			.addEdge('eval::17-1:27-1:30-2', 'eval::17-1:27-1:30-0', EdgeType.Reads | EdgeType.Argument)
			.addEdge('eval::17-1:27-1:30-2', 'eval::17-1:27-1:30-1', EdgeType.Reads | EdgeType.Argument)
			.addEdge('eval::17-1:27-1:30-0', '1@x', EdgeType.Reads)
			.addEdge('eval::17-1:27-1:30-1', '2@y', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
}));

describe.sequential('evalText', withShell(shell => {
	assertSliced(label('simple evalText use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 1\ny <- 1\nz <- evalText("x+y")', ['3@z'], 'x <- 1\ny <- 1\nz <- evalText("x+y")');
	assertSliced(label('simple evalText use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'foo <- function(x) { return (x+2) }\ny <- evalText("foo(4)*1")', ['2@y'], 'foo <- function(x) return (x+2)\ny <- evalText("foo(4)*1")');
	/*assertSliced(label('simple evalText no-use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, 'x <- 2\ny <- 1\nz <- evalText("y+x+1", env(x=42))', ['3@z'], 'y <- 1\nz <- evalText("y+x+1", env(x=42))');*/
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
	assertSliced(label('', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		shell, `x <- 1
y <- 0
for(i in 1:4){
	y <- 4
}
if(u >= 4) y <- 2
t <- evalText("1+y")`, ['4@z'], '');
}));

describe.sequential('evalText', withTreeSitter(tr => {
	assertDataflow(label('simple evalText use for dataflow', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'a <- "1+1"\nx <- "1"\nb <- "3"\nz <- evalText(x)', emptyGraph()
			.defineVariable('2@x')
			.defineVariable('4@z')
			.definedBy('4@z', '4@evalText')
			.addEdge('4@evalText', '4@x', EdgeType.Argument | EdgeType.Reads | EdgeType.Returns)
			.addEdge('4@x', '2@x', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
	assertDataflow(label('simple evalText use for dataflow', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation', 'newlines']),
		tr, 'x <- 1\ny <- 1\na <- 2\nz <- evalText("x+y")', emptyGraph()
			.definedBy('4@z', '4@evalText')
			.addEdge(13, 'evalText::13-1:27-1:34-2', EdgeType.Returns)
			.addEdge('evalText::13-1:27-1:34-2', 'evalText::13-1:27-1:34-0', EdgeType.Reads | EdgeType.Argument)
			.addEdge('evalText::13-1:27-1:34-2', 'evalText::13-1:27-1:34-1', EdgeType.Reads | EdgeType.Argument)
			.addEdge('evalText::13-1:27-1:34-0', '1@x', EdgeType.Reads)
			.addEdge('evalText::13-1:27-1:34-1', '2@y', EdgeType.Reads),
		{
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true,
			context:               'dataflow'
		});
}));