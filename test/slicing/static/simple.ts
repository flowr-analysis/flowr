import { assertSliced, withShell } from '../../helper/shell'

describe('Simple', withShell(shell => {
  describe('Constant assignments', () => {
    for(const i of [1, 2, 3]) {
      assertSliced(`x <- [${i}]`, shell, 'x <- 1\nx <- 2\nx <- 3', [`${i}:1`], `x <- ${i}`)
    }
  })
  // TODO: test for(i in 1:10) { print(i); i <- 12 }
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
for(i in 1:(N-1)) sum <- sum + i + w`
    )

    assertSliced('Sum rhs in for', shell, code, ['8:10'],
      `sum <- 0
w <- 7
N <- 10
for(i in 1:(N-1)) sum <- sum + i + w`
    )

    assertSliced('Product lhs in for', shell, code, ['9:3'],
      `product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i`
    )

    assertSliced('Product rhs in for', shell, code, ['9:14'],
      `product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i`
    )

    assertSliced('Sum in call', shell, code, ['12:13'],
      `sum <- 0
w <- 7
N <- 10
for(i in 1:(N-1)) sum <- sum + i + w
cat("Sum:", sum, "\\n")`
    )

    assertSliced('Product in call', shell, code, ['13:17'],
      `product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i
cat("Product:", product, "\\n")`
    )

  })

}))
