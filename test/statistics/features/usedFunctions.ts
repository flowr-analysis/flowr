import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Used Function Calls', withShell(shell => {
  testForFeatureForInput(shell, 'usedFunctions', [
    {
      name:     'no calls',
      code:     'a <- 1',
      expected: {}
    }
  ])
}))

