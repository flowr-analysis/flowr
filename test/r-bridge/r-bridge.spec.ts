describe('R-Bridge', () => {
  describe('R language utilities', () => {
    require('./values')
  })

  require('./sessions')

  // TODO: allow to specify where to install packages to so we can minimize installation to one temp directory
  describe('Retrieve AST from R', () => {
    require('./ast/parse-values')
  })
})
