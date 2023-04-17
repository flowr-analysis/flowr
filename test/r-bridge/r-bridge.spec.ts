describe('R-Bridge', () => {
  describe('R language utilities', () => {
    require('./lang/values')
  })

  require('./lang/ast/model')
  require('./sessions')
  require('./retriever')

  // TODO: allow to specify where to install packages to so we can minimize installation to one temp directory
  describe('Retrieve AST from R', () => {
    require('./lang/ast/parse-values')
    require('./lang/ast/parse-operations')
    require('./lang/ast/parse-assignments')
    require('./lang/ast/parse-snippets')
  })
})
