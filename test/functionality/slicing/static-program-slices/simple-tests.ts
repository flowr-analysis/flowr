import { assertSliced, withShell } from '../../_helper/shell'
import { label } from '../../_helper/label'
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators'
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data/get'

describe('Simple', withShell(shell => {
	describe('Constant assignments', () => {
		for(const i of [1, 2, 3]) {
			assertSliced(label(`slice constant assignment ${i}`, ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines']),
				shell, 'x <- 1\nx <- 2\nx <- 3', [`${i}:1`], `x <- ${i}`
			)
		}
	})
	//if reconstruction needs more work to handle all cases
	describe('Constant conditionals', () => {
		assertSliced('if(TRUE)', shell, 'if(TRUE) { x <- 3 } else { x <- 4}\nx', ['2@x'], 'if(TRUE) { x <- 3 }\nx')
		//if reconstruction needs more work to handle this
		assertSliced('if(FALSE)', shell, 'if(FALSE) { x <- 3 } else { x <- 4}\nx', ['2@x'], 'if(FALSE) {}         else { x <- 4}\nx')
		assertSliced(label('if(TRUE)', ['name-normal', 'logical', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'if']),
			shell, 'if(TRUE) { x <- 3 } else { x <- 4 }\nx', ['2@x'], 'x <- 3\nx'
		)
		assertSliced(label('if(FALSE)', ['name-normal', 'logical', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'if']),
			shell, 'if(FALSE) { x <- 3 } else { x <- 4 }\nx', ['2@x'], 'x <- 4\nx')
	})
	//for is currently pretty printing
	//this does not produce a stack trace??
	describe('Independent Control-Flow', () => {
		assertSliced(label('For-Loop', ['name-normal', 'for-loop', 'newlines', 'unnamed-arguments', 'numbers', 'built-in-sequencing', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
for(i in 1:10) {
  x <- x * 2
}
cat(x)
    `, ['6@x'], 'x <- 1\nfor(i in 1:10) {\n  x <- x * 2\n}\nx')
		assertSliced('While-Loop', shell, `
print(x)
    `, ['6@x'], 'x <- 1\nfor(i in 1:10) x <- x * 2\nx', {
			expectedOutput: '[1] 1024'
		})
		assertSliced(label('While-Loop', ['name-normal', 'while-loop', 'newlines', 'numbers', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
while(i > 3) {
  x <- x * 2
}
cat(x)
    `, ['6@x'], 'x <- 1\nwhile(i > 3) {\n  x <- x * 2\n}\ncat(x)')

		assertSliced(label('independent if-then with extra requirements', ['name-normal', 'if', 'newlines', 'unnamed-arguments', 'numbers', ...OperatorDatabase['<-'].capabilities, 'function-calls', ...OperatorDatabase['*'].capabilities, 'precedence']),
			shell, `
x <- 1
i <- 3
if(i > 3) {
    x <- x * 2
}
print(x)
    `, ['7@x'], `x <- 1
i <- 3
if(i > 3) { x <- x * 2 }
x`, {
				expectedOutput: '[1] 1'
			})
	})
	describe('Access', () => {
		assertSliced(label('constant', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'single-bracket-access']),
			shell, 'a <- 4\na <- list(1,2)\na[3]', ['3@a'], 'a <- list(1,2)\na')
		assertSliced(label('variable', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'single-bracket-access']),
			shell, 'i <- 4\na <- list(1,2)\nb <- a[i]', ['3@b'], 'i <- 4\na <- list(1,2)\nb <- a[i]')
		assertSliced(label('subset sequence', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'built-in-sequencing', 'empty-arguments', 'single-bracket-access', 'subsetting']),
			shell, 'i <- 4\na <- list(1,2)\n b <- a[1:i,]', ['3@b'], 'i <- 4\na <- list(1,2)\nb <- a[1:i,]')
		assertSliced(label('range assignment', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'built-in-sequencing', 'empty-arguments', 'single-bracket-access', 'subsetting', 'range-assignment']),
			shell, 'a <- 1:10\na[1:5] <- 3\na', ['3@a'], 'a <- 1:10\na[1:5] <- 3\na')
		describe('Definitions', () => {
			describe('[[', () => {
				const code = '\na <- list(1,2)\na[[1]] = 2\na[[2]] = 3\nb[[4]] = 5\ncat(a)\na <- list(3,4)\ncat(a)\n'
				//we get an added space in front of the access
				assertSliced('Repeated named access and definition', shell, code, ['6@a'], 'a <- list(1,2)\na[[1]] = 2\na[[2]] = 3\na')
				assertSliced('Full redefinitions still apply', shell, code, ['8@a'], `a <- list(3,4)
a`)
				assertSliced(label('Repeated named access and definition', ['name-normal', 'numbers', 'double-bracket-access', 'unnamed-arguments', 'function-calls', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments']),
					shell, code, ['6@a'], `a <- list(1,2)
a[[1]] = 2
a[[2]] = 3
a`)
				assertSliced(label('Full redefinitions still apply', ['name-normal', 'numbers', 'double-bracket-access', 'unnamed-arguments', 'function-calls', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments']),
					shell, code, ['8@a'], `a <- list(3,4)
a`)
			})
			describe('$', () => {
				const codeB = '\na <- list(a=1,b=2)\na$a = 2\na$b = 3\nb[[4]] = 5\ncat(a)\na <- list(a=3,b=4)\ncat(a)\n'
				//we get an added space in front of the access
				assertSliced('Repeated named access and definition', shell, codeB, ['6@a'], 'a <- list(a=1,b=2)\na$a = 2\na$b = 3\ncat(a)')
				assertSliced('Full redefinitions still apply', shell, codeB, ['8@a'], `a <- list(a=3,b=4)
a`)
				assertSliced(label('Repeated named access and definition', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'dollar-access', ...OperatorDatabase['<-'].capabilities, 'numbers']),
					shell, codeB, ['6@a'], `a <- list(a=1,b=2)
a$a = 2
a$b = 3
a`)
				assertSliced(label('Full redefinitions still apply', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'dollar-access', ...OperatorDatabase['<-'].capabilities, 'numbers']),
					shell, codeB, ['8@a'], `a <- list(a=3,b=4)
a`)
			})
		})
	})
	describe('With directives', () => {
		assertSliced(label('Single directive', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'newlines', 'unnamed-arguments', 'comments']),
			shell, `
#line 42 "foo.R"
a <- 5
    `, ['3@a'], 'a <- 5')
	})
	describe('The classic', () => {
		const capabilities: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'call-normal', 'newlines', 'unnamed-arguments', 'for-loop', ...OperatorDatabase['+'].capabilities, ...OperatorDatabase['*'].capabilities, 'built-in-sequencing', 'strings', 'precedence']
		const code = `
sum <- 0
product <- 1
w <- 7
N <- 10

for (i in 1:(N-1)) {
  sum <- sum + i + w
  product <- product * i
}

cat("Sum:", sum, "\\n")
cat("Product:", product, "\\n")
`

		assertSliced(label('Sum lhs in for', capabilities),
			shell, code, ['8:3'],
			`sum <- 0
w <- 7
N <- 10
for (i in 1:(N-1)) {
  sum <- sum + i + w
}`, {
				expectedOutput: 'Sum: 108\nProduct: 362880'
			}
		)

		assertSliced(label('Sum rhs in for', capabilities),
			shell, code, ['8:10'],
			`sum <- 0
w <- 7
N <- 10
for (i in 1:(N-1)) {
  sum <- sum + i + w
}`
		)

		assertSliced(label('Product lhs in for', capabilities),
			shell, code, ['9:3'],
			`product <- 1
N <- 10
for (i in 1:(N-1)) {
  product <- product * i
}`
		)

		assertSliced(label('Product rhs in for', capabilities),
			shell, code, ['9:14'],
			`product <- 1
N <- 10
for (i in 1:(N-1)) {
  product <- product * i
}`
		)

		assertSliced(label('Sum in call', capabilities),
			shell, code, ['12:13'],
			`sum <- 0
w <- 7
N <- 10
for (i in 1:(N-1)) {
  sum <- sum + i + w
}
sum`
		)

		assertSliced(label('Product in call', capabilities),
			shell, code, ['13:17'],
			`product <- 1
N <- 10
for (i in 1:(N-1)) {
  product <- product * i
}
product`
		)

		assertSliced(label('Top by name', capabilities),
			shell, code, ['2@sum'],
			'sum <- 0'
		)
	})
}))
