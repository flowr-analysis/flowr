import { assert } from 'chai'
import { defaultTokenMap, withShell } from '../helper/shell'
import { CFG, ControlFlowInformation, emptyControlFlowInformation, equalCfg, extractCFG } from '../../../src/util/cfg'
import { SteppingSlicer } from '../../../src/core'
import { requestFromInput, RFalse, RTrue, RType } from '../../../src/r-bridge'
import { cfgToMermaidUrl } from '../../../src/util/mermaid'

describe("Control Flow Graph", withShell(shell => {
	 function assertCfg(code: string, partialExpected: Partial<ControlFlowInformation>) {
		 // shallow copy is important to avoid killing the CFG :c
		const expected: ControlFlowInformation = {...emptyControlFlowInformation(), ...partialExpected}
		return it(code, async()=> {
			const result = await new SteppingSlicer({
				stepOfInterest: 'normalize',
				shell,
				request:        requestFromInput(code),
				tokenMap:       await defaultTokenMap()
			}).allRemainingSteps()
			const cfg = extractCFG(result.normalize)

			try {
				assert.deepStrictEqual(cfg.entryPoints, expected.entryPoints, "entry points differ")
				assert.deepStrictEqual(cfg.exitPoints, expected.exitPoints, "exit points differ")
				assert.deepStrictEqual(cfg.breaks, expected.breaks, "breaks differ")
				assert.deepStrictEqual(cfg.nexts, expected.nexts, "nexts differ")
				assert.deepStrictEqual(cfg.returns, expected.returns, "returns differ")
				assert.isTrue(equalCfg(cfg.graph, expected.graph), "graphs differ")
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
		 graph:       new CFG()
			.addVertex({ id: '0', name: RType.Logical, content: 'TRUE' })
			.addVertex({ id: '1', name: RType.Number, content: '1' })
			.addVertex({ id: '3', name: RType.IfThenElse, content: 'if(TRUE) 1' })
			.addVertex({ id: '3-exit', name: 'if-exit', content: undefined })
			.addEdge('0', '3', { label: 'FD' })
			.addEdge('1', '0', { label: 'CD', when: RTrue })
			.addEdge('3-exit', '1', { label: 'FD' })
			.addEdge('3-exit', '0', { label: 'CD', when: RFalse })

	})
}))
