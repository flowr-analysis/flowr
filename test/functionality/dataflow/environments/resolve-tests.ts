import { define, initializeCleanEnvironments, resolveByName } from '../../../../src/dataflow/environments'
import { expect } from 'chai'
import { guard } from '../../../../src/util/assert'
import { GlobalScope, LocalScope } from '../../../../src/dataflow/environments/scopes'
import { variable } from '../../_helper/environment-builder'

describe('Resolve', () => {
	describe('ByName', () => {
		it('Locally without distracting elements', () => {
			let env = initializeCleanEnvironments()
			const xVar = variable('x', '_1')
			env = define(xVar, LocalScope, env)
			const result = resolveByName('x', LocalScope, env)
			guard(result !== undefined, 'there should be a result')
			expect(result, 'there should be exactly one definition for x').to.have.length(1)
			expect(result[0], 'it should be x').to.be.equal(xVar)
		})
		it('Locally with global distract', () => {
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
