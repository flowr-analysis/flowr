describe('R-Bridge', () => {
  describe('R language utilities', () => {
    require('./lang:4.x/values')
  })

  require('./lang:4.x/ast/model')
  require('./sessions')
  require('./retriever')

  // TODO: allow to specify where to install packages to so we can minimize installation to one temp directory
  describe('Retrieve AST from R', () => {
    require('./lang:4.x/ast/parse-values')
    require('./lang:4.x/ast/parse-operations')
    require('./lang:4.x/ast/parse-assignments')
  })
})
