import { defaultTokenMap, retrieveNormalizedAst, withShell } from '../../../helper/shell'
import { assert } from 'chai'
import { getStoredTokenMap, ParserData, requestFromInput, XmlBasedJson } from '../../../../src/r-bridge'
import { SteppingSlicer } from '../../../../src/core'

describe("Check hooks are called appropriately", withShell(shell => {
	it('Call the number hook!', async() => {
		let before = false
		let after = false
		await retrieveNormalizedAst(shell, "1", {
			values: {
				onNumber: {
					before: () => { before = true; return undefined },
					after:  () => { after = true; return undefined }
				},
			},
		})
		assert.isTrue(before, 'The number before-hook was not called!')
		assert.isTrue(after, 'The number after-hook was not called!')
	})
	it("Call the string hook!", async() => {
		const tokenMap = await defaultTokenMap()

		let counter = 0

		await new SteppingSlicer({
			stepOfInterest: 'normalize',
			shell, tokenMap,
			request:        requestFromInput('x <- "foo"'),
			hooks:          {
				values: {
					onString: {
						after: () => { counter++; return undefined },
					}
				}
			}
		}).allRemainingSteps()

		assert.equal(counter, 1, 'The string after-hook should be called once')
	})
}))
