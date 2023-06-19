import { retrieveAst, withShell } from '../../../helper/shell'
import { assert } from 'chai'

describe("Check hooks are called appropriately", withShell(shell => {
  it('Call the number hook!', async() => {
    let before = false
    let after = false
    await retrieveAst(shell, "1", {
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
}))
