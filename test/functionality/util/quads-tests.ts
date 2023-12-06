import { retrieveNormalizedAst, withShell } from '../_helper/shell'
import { decorateAst, RType } from '../../../src/r-bridge'
import { defaultQuadIdGenerator, serialize2quads } from '../../../src/util/quads'
import { assert } from 'chai'

describe('Quads', withShell(shell => {
	const context = 'test'
	const domain = 'https://uni-ulm.de/r-ast/'

	const compareQuads = async(code: string, expected: string) => {
		const ast = await retrieveNormalizedAst(shell, code)
		const decorated = decorateAst(ast).ast
		const serialized = serialize2quads(decorated, { context, domain, getId: defaultQuadIdGenerator() })
		assert.strictEqual(serialized.trim(), expected.trim())
	}

	it('should generate quads', async() => {
		const idPrefix =  `${domain}${context}/`
		// ids are deterministic, so we can compare the quads
		await compareQuads('1', `
<${idPrefix}0> <${domain}type> "${RType.ExpressionList}" <test> .
<${idPrefix}0> <${domain}children> <${idPrefix}1> <test> .
<${idPrefix}1> <${domain}order> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}1> <${domain}location> <${idPrefix}2> <test> .
<${idPrefix}2> <${domain}start> <${idPrefix}3> <test> .
<${idPrefix}3> <${domain}line> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}3> <${domain}column> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}2> <${domain}end> <${idPrefix}4> <test> .
<${idPrefix}4> <${domain}line> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}4> <${domain}column> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
<${idPrefix}1> <${domain}lexeme> "1" <test> .
<${idPrefix}1> <${domain}type> "${RType.Number}" <test> .
<${idPrefix}1> <${domain}content> <${idPrefix}5> <test> .
<${idPrefix}5> <${domain}num> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <test> .
    `)
	})
}))
