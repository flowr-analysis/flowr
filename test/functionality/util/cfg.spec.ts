import { assert } from 'chai'
import { withShell } from '../helper/shell'
import {
	ControlFlowGraph,
	cfg2quads,
	ControlFlowInformation,
	emptyControlFlowInformation,
	equalCfg,
	extractCFG
} from '../../../src/util/cfg'
import { SteppingSlicer } from '../../../src/core'
import { requestFromInput, RFalse, RTrue, RType } from '../../../src/r-bridge'
import { cfgToMermaidUrl } from '../../../src/util/mermaid'
import { defaultQuadIdGenerator } from '../../../src/util/quads'

describe('Control Flow Graph', withShell(shell => {
	 function assertCfg(code: string, partialExpected: Partial<ControlFlowInformation>) {
		 // shallow copy is important to avoid killing the CFG :c
		const expected: ControlFlowInformation = {...emptyControlFlowInformation(), ...partialExpected}
		return it(code, async()=> {
			const result = await new SteppingSlicer({
				stepOfInterest: 'normalize',
				shell,
				request:        requestFromInput(code)
			}).allRemainingSteps()
			const cfg = extractCFG(result.normalize)

			try {
				assert.deepStrictEqual(cfg.entryPoints, expected.entryPoints, 'entry points differ')
				assert.deepStrictEqual(cfg.exitPoints, expected.exitPoints, 'exit points differ')
				assert.deepStrictEqual(cfg.breaks, expected.breaks, 'breaks differ')
				assert.deepStrictEqual(cfg.nexts, expected.nexts, 'nexts differ')
				assert.deepStrictEqual(cfg.returns, expected.returns, 'returns differ')
				assert.isTrue(equalCfg(cfg.graph, expected.graph), 'graphs differ')
			} catch(e: unknown) {
				console.error(`expected: ${cfgToMermaidUrl(expected)}`)
				console.error(`actual: ${cfgToMermaidUrl(cfg)}`)
				throw e
			}
		}).timeout('3min')
	}

	assertCfg('if(TRUE) 1', {
	   entryPoints: [ '3' ],
		 exitPoints:  [ '3-exit' ],
		 graph:       new ControlFlowGraph()
			.addVertex({ id: '0', name: RType.Logical, content: 'TRUE' })
			.addVertex({ id: '1', name: RType.Number, content: '1' })
			.addVertex({ id: '3', name: RType.IfThenElse, content: 'if(TRUE) 1' })
			.addVertex({ id: '3-exit', name: 'if-exit', content: undefined })
			.addEdge('0', '3', { label: 'FD' })
			.addEdge('1', '0', { label: 'CD', when: RTrue })
			.addEdge('3-exit', '1', { label: 'FD' })
			.addEdge('3-exit', '0', { label: 'CD', when: RFalse })
	})

	it('Example Quad Export', async() => {
		const domain = 'https://uni-ulm.de/r-ast/'
		const context = 'test'

		const result = await new SteppingSlicer({
			stepOfInterest: 'normalize',
			shell,
			request:        requestFromInput('if(TRUE) 1')
		}).allRemainingSteps()
		const cfg = extractCFG(result.normalize)

		const content = cfg2quads(cfg, { context, domain, getId: defaultQuadIdGenerator() })

		assert.strictEqual(content, `<${domain}${context}/0> <${domain}rootIds-0> "3" <${context}> .
<${domain}${context}/0> <${domain}rootIds-1> "3-exit" <${context}> .
<${domain}${context}/0> <${domain}rootIds-2> "0" <${context}> .
<${domain}${context}/0> <${domain}rootIds-3> "1" <${context}> .
<${domain}${context}/0> <${domain}vertices-0> <${domain}${context}/1> <${context}> .
<${domain}${context}/1> <${domain}id> "3" <${context}> .
<${domain}${context}/1> <${domain}name> "RIfThenElse" <${context}> .
<${domain}${context}/1> <${domain}content> "if(TRUE) 1" <${context}> .
<${domain}${context}/0> <${domain}vertices-1> <${domain}${context}/2> <${context}> .
<${domain}${context}/2> <${domain}id> "3-exit" <${context}> .
<${domain}${context}/2> <${domain}name> "if-exit" <${context}> .
<${domain}${context}/0> <${domain}vertices-2> <${domain}${context}/3> <${context}> .
<${domain}${context}/3> <${domain}id> "0" <${context}> .
<${domain}${context}/3> <${domain}name> "RLogical" <${context}> .
<${domain}${context}/3> <${domain}content> "TRUE" <${context}> .
<${domain}${context}/0> <${domain}vertices-3> <${domain}${context}/4> <${context}> .
<${domain}${context}/4> <${domain}id> "1" <${context}> .
<${domain}${context}/4> <${domain}name> "RNumber" <${context}> .
<${domain}${context}/4> <${domain}content> "1" <${context}> .
<${domain}${context}/0> <${domain}edges-0> <${domain}${context}/5> <${context}> .
<${domain}${context}/5> <${domain}from> "1" <${context}> .
<${domain}${context}/5> <${domain}to> "0" <${context}> .
<${domain}${context}/5> <${domain}type> "CD" <${context}> .
<${domain}${context}/5> <${domain}when> "TRUE" <${context}> .
<${domain}${context}/0> <${domain}edges-1> <${domain}${context}/6> <${context}> .
<${domain}${context}/6> <${domain}from> "0" <${context}> .
<${domain}${context}/6> <${domain}to> "3" <${context}> .
<${domain}${context}/6> <${domain}type> "FD" <${context}> .
<${domain}${context}/0> <${domain}edges-2> <${domain}${context}/7> <${context}> .
<${domain}${context}/7> <${domain}from> "3-exit" <${context}> .
<${domain}${context}/7> <${domain}to> "1" <${context}> .
<${domain}${context}/7> <${domain}type> "FD" <${context}> .
<${domain}${context}/0> <${domain}edges-3> <${domain}${context}/8> <${context}> .
<${domain}${context}/8> <${domain}from> "3-exit" <${context}> .
<${domain}${context}/8> <${domain}to> "0" <${context}> .
<${domain}${context}/8> <${domain}type> "CD" <${context}> .
<${domain}${context}/8> <${domain}when> "FALSE" <${context}> .
<${domain}${context}/0> <${domain}entryPoints-0> "3" <${context}> .
<${domain}${context}/0> <${domain}exitPoints-0> "3-exit" <${context}> .
`)
	})
}))
