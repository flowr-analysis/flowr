import { valuesSpec } from './values'
import { simpleAstParsingSpec } from './ast/parse-simple'
import { sessionsSpec } from './sessions'

describe('R-Bridge', () => {
  describe('R language utilities', valuesSpec)

  sessionsSpec()

  // TODO: allow to specify where to install packages to so we can minimize installation to one temp directory
  describe('Retrieve AST from R', () => {
    simpleAstParsingSpec()
  })
})
