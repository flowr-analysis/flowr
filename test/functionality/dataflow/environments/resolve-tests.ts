import { define, initializeCleanEnvironments, resolveByName } from '../../../../src/dataflow/common/environments'
import { expect } from 'chai'
import { guard } from '../../../../src/util/assert'
import { GlobalScope, LocalScope } from '../../../../src/dataflow/common/environments/scopes'
import { variable } from '../../_helper/environment-builder'
import { label } from '../../_helper/label'

describe('Resolve', () => {
	describe('ByName', () => {
		it(label('Locally without distracting elements', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			let env = initializeCleanEnvironments()
			const xVar = variable('x', '_1')
			env = define(xVar, LocalScope, env)
			const result = resolveByName('x', LocalScope, env)
			guard(result !== undefined, 'there should be a result')
			expect(result, 'there should be exactly one definition for x').to.have.length(1)
			expect(result[0], 'it should be x').to.be.equal(xVar)
		})
		it(label('Locally with global distract', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			let env = initializeCleanEnvironments()
			env = define(variable('x', '_2'), GlobalScope, env)
			const xVar = variable('x', '_1')
			env = define(xVar, LocalScope, env)
			const result = resolveByName('x', LocalScope , env)
			guard(result !== undefined, 'there should be a result')
			expect(result, 'there should be exactly one definition for x').to.have.length(1)
			expect(result[0], 'it should be x').to.be.equal(xVar)
		})
	})
})
