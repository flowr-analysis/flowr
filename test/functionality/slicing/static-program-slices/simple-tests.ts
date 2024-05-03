import { assertSliced, withShell } from '../../_helper/shell'
import {label} from "../../_helper/label";
import {SupportedFlowrCapabilityId} from "../../../../src/r-bridge/data";

describe('Simple', withShell(shell => {
	describe('Constant assignments', () => {
		for(const i of [1, 2, 3]) {
			assertSliced(label(`slice constant assignment ${i}`, ['name-normal', 'numbers', 'local-left-assignment', 'newlines']),
				shell, 'x <- 1\nx <- 2\nx <- 3', [`${i}:1`], `x <- ${i}`
			)
		}
	})
	describe('Constant conditionals', () => {
		assertSliced(label('if(TRUE)', ['name-normal', 'logical', 'numbers', 'local-left-assignment', 'newlines', 'if']),
			shell, 'if(TRUE) { x <- 3 } else { x <- 4 }\nx', ['2@x'], 'x <- 3\nx'
		)
		assertSliced(label('if(FALSE)', ['name-normal', 'logical', 'numbers', 'local-left-assignment', 'newlines', 'if']),
			shell, 'if(FALSE) { x <- 3 } else { x <- 4 }\nx', ['2@x'], 'x <- 4\nx')
	})
	describe('Independent Control-Flow', () => {
		assertSliced(label('For-Loop', ['name-normal', 'for-loop', 'newlines', 'unnamed-arguments', 'numbers', 'built-in-sequencing', 'local-left-assignment', 'function-calls', 'binary-operator']),
			shell, `
x <- 1
for(i in 1:10) {
  x <- x * 2
}
cat(x)
    `, ['6@x'], 'x <- 1\nfor(i in 1:10) x <- x * 2\ncat(x)')
		assertSliced(label('While-Loop', ['name-normal', 'while-loop', 'newlines', 'numbers', 'unnamed-arguments', 'local-left-assignment', 'function-calls', 'binary-operator']),
			shell, `
x <- 1
while(i > 3) {
  x <- x * 2
}
cat(x)
    `, ['6@x'], 'x <- 1\nwhile(i > 3) x <- x * 2\ncat(x)')

		assertSliced(label('if-then', ['name-normal', 'if', 'newlines', 'numbers', 'unnamed-arguments', 'local-left-assignment', 'function-calls', 'binary-operator']),
			shell, `
x <- 1
if(i > 3) {
    x <- x * 2
}
cat(x)
    `, ['6@x'], `x <- 1
if(i > 3) { x <- x * 2 }
cat(x)`)

		assertSliced(label('independent if-then with extra requirements', ['name-normal', 'if', 'newlines', 'unnamed-arguments', 'numbers', 'local-left-assignment', 'function-calls', 'binary-operator']),
			shell, `
x <- 1
i <- 3
if(i > 3) {
    x <- x * 2
}
cat(x)
    `, ['7@x'], `x <- 1
i <- 3
if(i > 3) { x <- x * 2 }
cat(x)`)
	})
	describe('Access', () => {
		assertSliced(label('Constant', ['name-normal', 'numbers', 'local-left-assignment', 'newlines', 'unnamed-arguments', 'single-bracket-access']),
			shell, 'a <- 4\na <- list(1,2)\na[3]', ['3@a'], 'a <- list(1,2)\na')
		assertSliced(label('Variable', ['name-normal', 'numbers', 'local-left-assignment', 'newlines', 'unnamed-arguments', 'single-bracket-access']),
			shell, 'i <- 4\na <- list(1,2)\nb <- a[i]', ['3@b'], 'i <- 4\na <- list(1,2)\nb <- a[i]')
		assertSliced(label('Subset Sequence', ['name-normal', 'numbers', 'local-left-assignment', 'newlines', 'unnamed-arguments', 'built-in-sequencing', 'empty-arguments', 'single-bracket-access']),
			shell, 'i <- 4\na <- list(1,2)\n b <- a[1:i,]', ['3@b'], 'i <- 4\na <- list(1,2)\nb <- a[1:i,]')
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
`
				assertSliced(label('Repeated named access and definition', ['name-normal', 'numbers', 'double-bracket-access', 'unnamed-arguments', 'function-calls', 'local-left-assignment', 'newlines', 'unnamed-arguments']),
					shell, code, ['6@a'], `a <- list(1,2)
a[[1]] = 2
a[[2]] = 3
cat(a)`)
				assertSliced(label('Full redefinitions still apply', ['name-normal', 'numbers', 'double-bracket-access', 'unnamed-arguments', 'function-calls', 'local-left-assignment', 'newlines', 'unnamed-arguments']),
					shell, code, ['8@a'], `a <- list(3,4)
cat(a)`)
			})
			describe('$', () => {
				const codeB = `
a <- list(a=1,b=2)
a$a = 2
a$b = 3
b[[4]] = 5
cat(a)
a <- list(a=3,b=4)
cat(a)
`
				assertSliced(label('Repeated named access and definition', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'dollar-access', 'local-left-assignment', 'numbers']),
					shell, codeB, ['6@a'], `a <- list(a=1,b=2)
a$a = 2
a$b = 3
cat(a)`)
				assertSliced(label('Full redefinitions still apply', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'dollar-access', 'local-left-assignment', 'numbers']),
					shell, codeB, ['8@a'], `a <- list(a=3,b=4)
cat(a)`)
			})
		})
	})
	describe('With directives', () => {
		assertSliced(label('Single directive', ['name-normal', 'numbers', 'local-left-assignment', 'newlines', 'unnamed-arguments', 'comments']),
			shell, `
#line 42 "foo.R"
a <- 5
    `, ['3@a'], 'a <- 5')
	})
	describe('The classic', () => {
		const capabilities: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'local-left-assignment', 'call-normal', 'newlines', 'unnamed-arguments', 'for-loop', 'binary-operator', 'built-in-sequencing', 'strings']
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
for(i in 1:(N-1)) sum <- sum + i + w`
		)

		assertSliced(label('Sum rhs in for', capabilities),
			shell, code, ['8:10'],
			`sum <- 0
w <- 7
N <- 10
for(i in 1:(N-1)) sum <- sum + i + w`
		)

		assertSliced(label('Product lhs in for', capabilities),
			shell, code, ['9:3'],
			`product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i`
		)

		assertSliced(label('Product rhs in for', capabilities),
			shell, code, ['9:14'],
			`product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i`
		)

		assertSliced(label('Sum in call', capabilities),
			shell, code, ['12:13'],
			`sum <- 0
w <- 7
N <- 10
for(i in 1:(N-1)) sum <- sum + i + w
cat("Sum:", sum, "\\n")`
		)

		assertSliced(label('Product in call', capabilities),
		shell, code, ['13:17'],
			`product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i
cat("Product:", product, "\\n")`
		)

		assertSliced(label('Top by name', capabilities),
			shell, code, ['2@sum'],
			'sum <- 0'
		)

	})

}))
