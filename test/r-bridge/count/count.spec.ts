import { retrieveXmlFromRCode } from '../../../src/r-bridge/retriever'
import { withShell } from '../../helper/shell'
import { countQueries } from '../../../src/r-bridge/lang:4.x/ast/model/processing/xpath'
import { assert } from 'chai'

describe('Count structures in R-Scripts', withShell(shell => {
  it('Count the number of function calls', async() => {
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
    const xml = await retrieveXmlFromRCode({ request: 'text', content: code, attachSourceInformation: true, ensurePackageInstalled: true }, shell)
    const result = countQueries(xml, '//SYMBOL_FUNCTION_CALL')
    assert.deepStrictEqual(result, [2], 'there are two calls to cat')
  })
}))
