import { retrieveAst, withShell } from '../helper/shell'
import { decorateAst } from '../../src/r-bridge'
import { serialize2quads } from '../../src/util/quads'
import { assert } from 'chai'

describe('Quad generation', withShell(shell => {
  const compareQuads = async(code: string, expected: string) => {
    const ast = await retrieveAst(shell, code)
    const decorated = decorateAst(ast).decoratedAst
    const serialized = serialize2quads(decorated, { context: 'test' })
    assert.strictEqual(serialized.trim(), expected.trim())
  }

  it('should generate quads', async() => {
    // ids are deterministic, so we can compare the quads
    await compareQuads('1', `
<https://uni-ulm.de/r-ast/0> <https://uni-ulm.de/r-ast/type> "exprlist"@string <test> .
<https://uni-ulm.de/r-ast/0> <https://uni-ulm.de/r-ast/children-0> <https://uni-ulm.de/r-ast/1> <test> .
<https://uni-ulm.de/r-ast/1> <https://uni-ulm.de/r-ast/location> <https://uni-ulm.de/r-ast/2> <test> .
<https://uni-ulm.de/r-ast/2> <https://uni-ulm.de/r-ast/start> <https://uni-ulm.de/r-ast/3> <test> .
<https://uni-ulm.de/r-ast/3> <https://uni-ulm.de/r-ast/line> "1"@number <test> .
<https://uni-ulm.de/r-ast/3> <https://uni-ulm.de/r-ast/column> "1"@number <test> .
<https://uni-ulm.de/r-ast/2> <https://uni-ulm.de/r-ast/end> <https://uni-ulm.de/r-ast/4> <test> .
<https://uni-ulm.de/r-ast/4> <https://uni-ulm.de/r-ast/line> "1"@number <test> .
<https://uni-ulm.de/r-ast/4> <https://uni-ulm.de/r-ast/column> "1"@number <test> .
<https://uni-ulm.de/r-ast/1> <https://uni-ulm.de/r-ast/lexeme> "1"@string <test> .
<https://uni-ulm.de/r-ast/1> <https://uni-ulm.de/r-ast/type> "NUM_CONST"@string <test> .
<https://uni-ulm.de/r-ast/1> <https://uni-ulm.de/r-ast/content> <https://uni-ulm.de/r-ast/5> <test> .
<https://uni-ulm.de/r-ast/5> <https://uni-ulm.de/r-ast/num> "1"@number <test> .
<https://uni-ulm.de/r-ast/5> <https://uni-ulm.de/r-ast/complexNumber> "false"@boolean <test> .
<https://uni-ulm.de/r-ast/5> <https://uni-ulm.de/r-ast/markedAsInt> "false"@boolean <test> .
<https://uni-ulm.de/r-ast/1> <https://uni-ulm.de/r-ast/info> <https://uni-ulm.de/r-ast/6> <test> .
<https://uni-ulm.de/r-ast/6> <https://uni-ulm.de/r-ast/id> "0"@string <test> .
<https://uni-ulm.de/r-ast/6> <https://uni-ulm.de/r-ast/parent> "1"@string <test> .
<https://uni-ulm.de/r-ast/0> <https://uni-ulm.de/r-ast/info> <https://uni-ulm.de/r-ast/7> <test> .
<https://uni-ulm.de/r-ast/7> <https://uni-ulm.de/r-ast/id> "1"@string <test> .
    `)
  })
}))
