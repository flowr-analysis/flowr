import { retrieveAst, withShell } from '../helper/shell'
import { decorateAst } from '../../src/r-bridge'
import { serialize2quads } from '../../src/util/quads'
import { assert } from 'chai'

describe('Quad Generation', withShell(shell => {
  const context = 'test'
  const domain = 'https://uni-ulm.de/r-ast/'

  const compareQuads = async(code: string, expected: string) => {
    const ast = await retrieveAst(shell, code)
    const decorated = decorateAst(ast).decoratedAst
    const serialized = serialize2quads(decorated, { context, domain })
    assert.strictEqual(serialized.trim(), expected.trim())
  }

  it('should generate quads', async() => {
    const idPrefix =  `${domain}${context}/`
    // ids are deterministic, so we can compare the quads
    await compareQuads('1', `
<${idPrefix}0> <${domain}type> "exprlist"@string <${context}> .
<${idPrefix}0> <${domain}children-0> <${idPrefix}1> <${context}> .
<${idPrefix}1> <${domain}location> <${idPrefix}2> <${context}> .
<${idPrefix}2> <${domain}start> <${idPrefix}3> <${context}> .
<${idPrefix}3> <${domain}line> "1"@number <${context}> .
<${idPrefix}3> <${domain}column> "1"@number <${context}> .
<${idPrefix}2> <${domain}end> <${idPrefix}4> <${context}> .
<${idPrefix}4> <${domain}line> "1"@number <${context}> .
<${idPrefix}4> <${domain}column> "1"@number <${context}> .
<${idPrefix}1> <${domain}lexeme> "1"@string <${context}> .
<${idPrefix}1> <${domain}type> "NUM_CONST"@string <${context}> .
<${idPrefix}1> <${domain}content> <${idPrefix}5> <${context}> .
<${idPrefix}5> <${domain}num> "1"@number <${context}> .
<${idPrefix}5> <${domain}complexNumber> "false"@boolean <${context}> .
<${idPrefix}5> <${domain}markedAsInt> "false"@boolean <${context}> .
<${idPrefix}1> <${domain}info> <${idPrefix}6> <${context}> .
<${idPrefix}6> <${domain}id> "0"@string <${context}> .
<${idPrefix}6> <${domain}parent> "1"@string <${context}> .
<${idPrefix}0> <${domain}info> <${idPrefix}7> <${context}> .
<${idPrefix}7> <${domain}id> "1"@string <${context}> .
    `)
  })
}))
