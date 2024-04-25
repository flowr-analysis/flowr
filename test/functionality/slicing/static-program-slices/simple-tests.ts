import { assertSliced, withShell } from '../../_helper/shell'

describe('Simple', withShell(shell => {
	describe('Constant assignments', () => {
		for(const i of [1, 2, 3]) {
			assertSliced(`x <- [${i}]`, shell, 'x <- 1\nx <- 2\nx <- 3', [`${i}:1`], `x <- ${i}`)
		}
	})
	describe('Constant conditionals', () => {
		assertSliced('if(TRUE)', shell, 'if(TRUE) { x <- 3 } else { x <- 4}\nx', ['2@x'], 'if(TRUE) { x <- 3 }\nx')
		//if reconstruction needs more work to handle this
		assertSliced('if(FALSE)', shell, 'if(FALSE) { x <- 3 } else { x <- 4}\nx', ['2@x'], 'if(FALSE) {}         else { x <- 4}\nx')
	})
	describe('Independent Control-Flow', () => {
		assertSliced('For-Loop', shell, `
x <- 1
for(i in 1:10) {
  x <- x * 2
}
cat(x)
    `, ['6@x'], 'x <- 1\nfor(i in 1:10) {\n  x <- x * 2\n}\ncat(x)')
		assertSliced('While-Loop', shell, `
x <- 1
while(i > 3) {
  x <- x * 2
}
cat(x)
    `, ['6@x'], 'x <- 1\nwhile(i > 3) {\n  x <- x * 2\n}\ncat(x)')

		// urgh that is fragile
		assertSliced('If-Then', shell, `
x <- 1
if(i > 3) {
    x <- x * 2
}
cat(x)
    `, ['6@x'], `x <- 1
if(i > 3) {
    x <- x * 2
}
cat(x)`)

		assertSliced('Independent If-Then with extra requirements', shell, `
x <- 1
i <- 3
if(i > 3) {
    x <- x * 2
}
cat(x)
    `, ['7@x'], `x <- 1
i <- 3
if(i > 3) {
    x <- x * 2
}
cat(x)`)
	})
	describe('Access', () => {
		assertSliced('Constant', shell, 'a <- 4\na <- list(1,2)\na[3]', ['3@a'], 'a <- list(1,2)\na[3]')
		assertSliced('Variable', shell, 'i <- 4\na <- list(1,2)\na[i]', ['3@a'], 'i <- 4\na <- list(1,2)\na[i]')
		assertSliced('Subset Sequence', shell, 'i <- 4\na <- list(1,2)\na[1:i,]', ['3@a'], 'i <- 4\na <- list(1,2)\na[1:i,]')
		describe('definitions', () => {
			describe('[[', () => {
				const code = '\na <- list(1,2)\na[[1]] = 2\na[[2]] = 3\nb[[4]] = 5\ncat(a)\na <- list(3,4)\ncat(a)\n'
				//we get an added space in front of the access
				assertSliced('Repeated named access and definition', shell, code, ['6@a'], 'a <- list(1,2)\na[[1]] = 2\na[[2]] = 3\ncat(a)')
				assertSliced('Full redefinitions still apply', shell, code, ['8@a'], `a <- list(3,4)
cat(a)`)
			})
			describe('$', () => {
				const codeB = '\na <- list(a=1,b=2)\na$a = 2\na$b = 3\nb[[4]] = 5\ncat(a)\na <- list(a=3,b=4)\ncat(a)\n'
				//we get an added space in front of the access
				assertSliced('Repeated named access and definition', shell, codeB, ['6@a'], 'a <- list(a=1,b=2)\na$a = 2\na$b = 3\ncat(a)')
				assertSliced('Full redefinitions still apply', shell, codeB, ['8@a'], `a <- list(a=3,b=4)
cat(a)`)
			})
		})
	})
	describe('With directives', () => {
		assertSliced('Single directive', shell, `
#line 42 "foo.R"
a <- 5
    `, ['3@a'], 'a <- 5')
	})
	describe('The classic', () => {
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

		assertSliced('Sum lhs in for', shell, code, ['8:3'],
			`sum <- 0
w <- 7
N <- 10
for (i in 1:(N-1)) {
  sum <- sum + i + w
}`
		)

		assertSliced('Sum rhs in for', shell, code, ['8:10'],
			`sum <- 0
w <- 7
N <- 10
for (i in 1:(N-1)) {
  sum <- sum + i + w
}`
		)

		assertSliced('Product lhs in for', shell, code, ['9:3'],
			`product <- 1
N <- 10
for (i in 1:(N-1)) {
  product <- product * i
}`
		)

		assertSliced('Product rhs in for', shell, code, ['9:14'],
			`product <- 1
N <- 10
for (i in 1:(N-1)) {
  product <- product * i
}`
		)

		assertSliced('Sum in call', shell, code, ['12:13'],
			`sum <- 0
w <- 7
N <- 10
for (i in 1:(N-1)) {
  sum <- sum + i + w
}
cat("Sum:", sum, "\\n")`
		)

		assertSliced('Product in call', shell, code, ['13:17'],
			`product <- 1
N <- 10
for (i in 1:(N-1)) {
  product <- product * i
}
cat("Product:", product, "\\n")`
		)

		assertSliced('Top by name', shell, code, ['2@sum'],
			'sum <- 0'
		)

	})

}))
