import { splitAtEscapeSensitive } from '../../../src/util/args'
import { assert } from 'chai'
import { defaultTokenMap, retrieveNormalizedAst, withShell } from '../helper/shell'
import { extractCFG } from '../../../src/util/cfg'
import { SteppingSlicer } from '../../../src/core'
import { requestFromInput } from '../../../src/r-bridge'
import { cfgToMermaidUrl } from '../../../src/util/mermaid'

describe("Control Flow Graph", withShell(shell => {
	it('dummy',async() => {
		const ast = await new SteppingSlicer({
			stepOfInterest: 'normalize',
			shell,
			request:        requestFromInput('file://test/testfiles/example.R'),
			tokenMap:       await defaultTokenMap()
		}).allRemainingSteps()

		const cfg = extractCFG(ast.normalize)
		console.log(cfgToMermaidUrl(cfg))
	}).timeout('3min')
}))
