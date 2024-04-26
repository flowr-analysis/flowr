import { retrieveNormalizedAst, withShell } from '../_helper/shell'
import { decorateAst, requestFromInput } from '../../../src'
import { defaultQuadIdGenerator, serialize2quads } from '../../../src/util/quads'
import { assert } from 'chai'
import { dataflowGraphToQuads } from '../../../src/core/print/dataflow-printer'
import { SteppingSlicer } from '../../../src/core/stepping-slicer'

describe('Quads', withShell(shell => {
	const context = 'test'
	const domain = 'https://uni-ulm.de/r-ast/'

	const compareQuadsCfg = async(code: string, expected: string) => {
		const ast = await retrieveNormalizedAst(shell, code)
		const decorated = decorateAst(ast).ast
		const serialized = serialize2quads(decorated, { context, domain, getId: defaultQuadIdGenerator() })
		assert.strictEqual(serialized.trim(), expected.trim())
	}

	it('should generate quads for the cfg', async() => {
		const idPrefix =  `${domain}${context}/`
		// ids are deterministic, so we can compare the quads
		await compareQuadsCfg('1', `
<${idPrefix}0> <${domain}type> "RExpressionList" <${context}> .
<${idPrefix}0> <${domain}children> <${idPrefix}1> <${context}> .
<${idPrefix}1> <${domain}location> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}1> <${domain}location> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}1> <${domain}location> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}1> <${domain}location> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}1> <${domain}lexeme> "1" <${context}> .
<${idPrefix}1> <${domain}type> "RNumber" <${context}> .
<${idPrefix}1> <${domain}content> <${idPrefix}2> <${context}> .
<${idPrefix}2> <${domain}num> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
    `)
	})

	const compareQuadsDfg = async(code: string, expected: string) => {
		const info = await new SteppingSlicer({
			stepOfInterest: 'dataflow',
			request:        requestFromInput(code),
			shell
		}).allRemainingSteps()

		const serialized = dataflowGraphToQuads(info.dataflow, { context, domain, getId: defaultQuadIdGenerator() })
		assert.strictEqual(serialized.trim(), expected.trim())
	}

	it('should generate quads for the dfg', async() => {
		const idPrefix =  `${domain}${context}/`
		// ids are deterministic, so we can compare the quads
		await compareQuadsDfg('foo(x)', `
<${idPrefix}0> <${domain}rootIds> "1" <${context}> .
<${idPrefix}0> <${domain}rootIds> "2" <${context}> .
<${idPrefix}0> <${domain}rootIds> "3" <${context}> .
<${idPrefix}0> <${domain}vertices> <${idPrefix}1> <${context}> .
<${idPrefix}1> <${domain}next> <${idPrefix}2> <${context}> .
<${idPrefix}1> <${domain}tag> "use" <${context}> .
<${idPrefix}1> <${domain}id> "1" <${context}> .
<${idPrefix}1> <${domain}name> "x" <${context}> .
<${idPrefix}1> <${domain}when> "always" <${context}> .
<${idPrefix}1> <${domain}environment> <${idPrefix}3> <${context}> .
<${idPrefix}3> <${domain}level> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}0> <${domain}vertices> <${idPrefix}2> <${context}> .
<${idPrefix}2> <${domain}next> <${idPrefix}4> <${context}> .
<${idPrefix}2> <${domain}tag> "use" <${context}> .
<${idPrefix}2> <${domain}id> "2" <${context}> .
<${idPrefix}2> <${domain}name> "noname-2" <${context}> .
<${idPrefix}2> <${domain}when> "always" <${context}> .
<${idPrefix}2> <${domain}environment> <${idPrefix}3> <${context}> .
<${idPrefix}3> <${domain}level> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}0> <${domain}vertices> <${idPrefix}4> <${context}> .
<${idPrefix}4> <${domain}tag> "function-call" <${context}> .
<${idPrefix}4> <${domain}id> "3" <${context}> .
<${idPrefix}4> <${domain}name> "foo" <${context}> .
<${idPrefix}4> <${domain}environment> <${idPrefix}5> <${context}> .
<${idPrefix}5> <${domain}current> <${idPrefix}6> <${context}> .
<${idPrefix}5> <${domain}level> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${idPrefix}4> <${domain}onlyBuiltin> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> <${context}> .
<${idPrefix}4> <${domain}args> <${idPrefix}7> <${context}> .
<${idPrefix}7> <${domain}name> "noname-2" <${context}> .
<${idPrefix}7> <${domain}nodeId> "2" <${context}> .
<${idPrefix}4> <${domain}when> "always" <${context}> .
<${idPrefix}0> <${domain}edges> <${idPrefix}8> <${context}> .
<${idPrefix}8> <${domain}next> <${idPrefix}9> <${context}> .
<${idPrefix}8> <${domain}from> "2" <${context}> .
<${idPrefix}8> <${domain}to> "1" <${context}> .
<${idPrefix}8> <${domain}type> "reads" <${context}> .
<${idPrefix}0> <${domain}edges> <${idPrefix}9> <${context}> .
<${idPrefix}9> <${domain}from> "3" <${context}> .
<${idPrefix}9> <${domain}to> "2" <${context}> .
<${idPrefix}9> <${domain}type> "argument" <${context}> .
    `)
	})
}))
