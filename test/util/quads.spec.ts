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
<${idPrefix}0> <${domain}type> "exprlist" <test> .
<${idPrefix}0> <${domain}children-0> <${idPrefix}1> <test> .
<${idPrefix}1> <${domain}location> <${idPrefix}2> <test> .
<${idPrefix}2> <${domain}start> <${idPrefix}3> <test> .
<${idPrefix}3> <${domain}line> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}3> <${domain}column> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}2> <${domain}end> <${idPrefix}4> <test> .
<${idPrefix}4> <${domain}line> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}4> <${domain}column> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}1> <${domain}lexeme> "1" <test> .
<${idPrefix}1> <${domain}info> <${idPrefix}5> <test> .
<${idPrefix}5> <${domain}id> "0" <test> .
<${idPrefix}5> <${domain}parent> "1" <test> .
<${idPrefix}1> <${domain}type> "NUM_CONST" <test> .
<${idPrefix}1> <${domain}content> <${idPrefix}6> <test> .
<${idPrefix}6> <${domain}num> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}6> <${domain}complexNumber> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> <test> .
<${idPrefix}6> <${domain}markedAsInt> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> <test> .
<${idPrefix}0> <${domain}info> <${idPrefix}7> <test> .
<${idPrefix}7> <${domain}id> "1" <test> .
    `)
  })
}))
