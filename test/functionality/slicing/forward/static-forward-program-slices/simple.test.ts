import { assertSlicedF, withShell } from '../../../_helper/shell';
import { describe } from 'vitest';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';

describe.sequential('Simple Forward', withShell(shell => {
	describe('Constant assignments', () => {
		for(const i of [1, 2, 3]) {
			assertSlicedF(label(`slice constant assignment ${i}`, ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines']),
				shell, 'x <- 1\nx <- 2\nx <- 3', [`${i}:1`], `x <- ${i}`
			);
		}
		for(const i of [1,2]) {
			assertSlicedF(label(`slice constant assignment with print ${i}`, ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'function-calls']),
				shell, 'x <- 2\nx <- 3\nprint(x)', [`${i}@x`], i == 1 ? 'x <- 2' : 'x <- 3\nprint(x)'
			);
		}
		// TODO doesn't expect the final print here
		/*assertSlicedF(label('using setnames', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'function-calls']),
			shell, 'x <- read.csv("foo")\nsetnames(x, 2:3, c("foo"))\nprint(x)', ['1@x'], 'x <- read.csv("foo")\nsetnames(x, 2:3, c("foo"))\nx'
		);*/
		assertSlicedF(label('using setnames but wanting another', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'function-calls']),
			shell, 'x <- read.csv("foo")\ny <- 3\nsetnames(x, 2:3, c("foo"))\nprint(y)', ['2@y'], 'y <- 3\nprint(y)'
		);
		assertSlicedF(label('two vars'), shell, `x <- 1
y <- 2
print(x + y)
		`, ['1@x'], 'x <- 1\nprint(x + y)');
		assertSlicedF(label('assignment in function'), shell, `f <- function() {
	  x <<- 2
	}
f()
print(x + y)
		`, ['2@x'], '{ x <<- 2 }\nf()\nprint(x + y)');
	});
	describe('Constant conditionals', () => {
		assertSlicedF(label('if(TRUE)', ['name-normal', 'logical', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'if']),
			shell, 'x <- 1\nif(TRUE) { x <- 3 }\nx', ['1@x'], 'x <- 1');
		assertSlicedF(label('if(FALSE)', ['name-normal', 'logical', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'if']),
			shell, 'x <- 1\nif(FALSE) { x <- 3 }\nx', ['1@x'], 'x <- 1\nx');
	});
	describe('Independent Control-Flow', () => {
		assertSlicedF(label('For-Loop', ['name-normal', 'for-loop', 'newlines', 'unnamed-arguments', 'numbers', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
for(i in 1:10) {
  x <- x * 2
}
print(x)
    `, ['2@x'], 'x <- 1\nfor(i in 1:10) { x <- x * 2 }\nprint(x)');
		assertSlicedF(label('While-Loop', ['name-normal', 'while-loop', 'newlines', 'numbers', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
while(i > 3) {
  x <- x * 2
}
cat(x)
    `, ['2@x'], 'x <- 1\nwhile(i > 3) { x <- x * 2 }\ncat(x)');
		assertSlicedF(label('if-then', ['name-normal', 'if', 'newlines', 'numbers', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
if(i > 3) {
    x <- x * 2
}
cat(x)
    `, ['2@x'], `x <- 1
if(i > 3) { x <- x * 2 }
cat(x)`);
		assertSlicedF(label('independent if-then with extra requirements', ['name-normal', 'if', 'newlines', 'unnamed-arguments', 'numbers', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
i <- 3
if(i > 3) {
    x <- x * 2
}
print(x)
    `, ['2@x'],  `x <- 1
if(i > 3) { x <- x * 2 }
print(x)`);
	});
	describe('Replacement With Argument-Name', () => {
		assertSlicedF(label('simple argument', ['replacement-functions']), shell,
			'rownames(y=x) <- c("w")\nx',
			['1@x'],
			'rownames(y=x)\nx'
		);
	});
	describe('Access', () => {
		assertSlicedF(label('constant', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'single-bracket-access']),
			shell, 'a <- list(1,2)\na[3]', ['1@a'], 'a <- list(1,2)\na');
		// TODO doesn't include a[i], just i
		/*assertSlicedF(label('variable', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'single-bracket-access']),
			shell, 'i <- 4\na <- list(1,2)\nb <- a[i]', ['1@i'], 'i <- 4\na <- list(1,2)\nb <- a[i]');*/
		// TODO doesn't include the full a[1:i,] part, just the i
		/*assertSlicedF(label('subset sequence', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'empty-arguments', 'single-bracket-access', 'subsetting-multiple']),
			shell, 'i <- 4\na <- list(1,2)\n b <- a[1:i,]', ['1@i'], 'i <- 4\nb <- a[1:i,]');*/
		// TODO just includes a in the second line (and then again in the third!)
		/*assertSlicedF(label('range assignment', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'empty-arguments', 'single-bracket-access', 'subsetting-multiple', 'range-assignment']),
			shell, 'a <- 1:10\na[1:5] <- 3\na', ['1@a'], 'a <- 1:10\na[1:5] <- 3\na');*/
		describe('Definitions', () => {
			describe('[[', () => {
				const code = `
a <- list(1,2)
a[[1]] = 2
a[[2]] = 3
b[[4]] = 5
cat(a)
a <- list(3,4)
cat(a)
`;
				// TODO doesn't include the [[1]] = 2 and [[2]] = 3 parts, just the a in both lines
				/*assertSlicedF(label('Repeated named access and definition', ['name-normal', 'numbers', 'double-bracket-access', 'unnamed-arguments', 'function-calls', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments']),
					shell, code, ['2@a'], `a <- list(1,2)
a[[1]] = 2
a[[2]] = 3
cat(a)`);*/
				assertSlicedF(label('Full redefinitions still apply', ['name-normal', 'numbers', 'double-bracket-access', 'unnamed-arguments', 'function-calls', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments']),
					shell, code, ['7@a'], `a <- list(3,4)
cat(a)`);
			});
			describe('$', () => {
				const codeB = `
a <- list(a=1,b=2)
a$a = 2
a$b = 3
b[[4]] = 5
cat(a)
a <- list(a=3,b=4)
cat(a)
`;

				// TODO doesn't include the $a = 2 and $b = 3 parts, just the a in both lines
				/*assertSlicedF(label('Repeated named access and definition', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'dollar-access', ...OperatorDatabase['<-'].capabilities, 'numbers']),
					shell, codeB, ['2@a'], `a <- list(a=1,b=2)
a$a = 2
a$b = 3
cat(a)`);*/
				assertSlicedF(label('Full redefinitions still apply', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'dollar-access', ...OperatorDatabase['<-'].capabilities, 'numbers']),
					shell, codeB, ['7@a'], `a <- list(a=3,b=4)
cat(a)`);
			});
		});
	});
	describe('With directives', () => {
		assertSlicedF(label('Single directive', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'comments']),
			shell, `
#line 42 "foo.R"
a <- 5
    `, ['3@a'], 'a <- 5', { skipTreeSitter: true /* directives aren't supported yet! */ });
	});
}));
