describe("Dataflow", () => {
	require('./environments/environments')

	describe("Extraction", () => {
		require('./elements/atomic')
		require('./elements/expression-lists')
		describe('Functions', () => {
			require('./elements/functions/function-definition')
			require('./elements/functions/function-call')
		})
	})
})
