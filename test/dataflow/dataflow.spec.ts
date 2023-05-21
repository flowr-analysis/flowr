// TODO: get def-usage for every line
describe("Dataflow", () => {
  require('./environments/environments')

  describe("Extraction", () => {
    require('./elements/atomic')
    require('./elements/expression-lists')
    require('./elements/others')
    require('./elements/functions/functions')
  })
})
