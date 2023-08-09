import { assertDataflow, withShell } from '../helper/shell'
import { DataflowGraph } from '../../src/dataflow'
import { log, LogLevel } from '../../src/util/log'

describe("Dataflow", () => {
  require('./environments/environments')

  describe("Extraction", () => {
    require('./elements/atomic')
    require('./elements/expression-lists')
    describe('Functions', () => {
      require('./elements/functions/function-definition')
      require('./elements/functions/function-call')
    })
    describe('x', withShell(shell => {
      before(() => {
        log.updateSettings(logger => {
          logger.settings.minLevel = LogLevel.error
        })
      })
      assertDataflow('u', shell, 'file:///home/limerent/Documents/SocialScience/1-Zenodo_Output.csv-output/586/Paper_script.R', new DataflowGraph())
    }))
  })
})
