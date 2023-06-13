import { assertSliced, withShell } from '../../helper/shell'

describe('Simple', withShell(shell => {
  describe('Constant assignments', () => {
    for(const i of [1, 2, 3]) {
      assertSliced(`x <- [${i}]`, shell, 'x <- 1\nx <- 2\nx <- 3', [{ line: i, column: 1 }], `x <- ${i}`)
    }
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

    assertSliced('Sum lhs in for', shell, code, [{ line: 8, column: 3 }],
      `sum <- 0
w <- 7
N <- 10
for(i in 1:(N-1)) sum <- sum + i + w`
    )

    /* TODO: differs - why?
    assertSliced('Product rhs in for', shell, code, [{ line: 9, column: 14 }],
      `product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i`
    )
    */
  }
  )

}))
