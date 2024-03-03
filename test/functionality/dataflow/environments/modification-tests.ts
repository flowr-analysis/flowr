import type { NodeId } from '../../../../src'
import type { IEnvironment } from '../../../../src/dataflow'
import { BuiltInMemory, initializeCleanEnvironments } from '../../../../src/dataflow'
import { guard } from '../../../../src/util/assert'
import { expect } from 'chai'
import { appendEnvironment, define, overwriteEnvironment } from '../../../../src/dataflow/environments'
import { variable } from '../../_helper/environment-builder'
import { label } from '../../_helper/label'

/** if you pass multiple `definedAt`, this will expect the node to have multiple definitions */
function existsDefinedAt(name: string, definedAt: NodeId[], result: IEnvironment | undefined, message?: string) {
	if(result === undefined) {
		expect.fail('there should be a result')
	}
	const got = result.memory.get(name)
	guard(got !== undefined, `${name} should exist. ${message ?? ''}`)
	expect(got, `${name} should have one possible definition per defined at (${JSON.stringify(definedAt)}). ${message ?? ''}`).to.have.length(definedAt.length)
	expect(got.map(d => d.definedAt), `${name} should be defined at ${JSON.stringify(definedAt)}. ${message ?? ''}`).to.deep.equal(definedAt)
}

describe('Modification', () => {
	describe('Global', () => {
		it(label('Different variables', ['global-scope', 'name-normal'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('x', '_1'), true, clean)
			let overwrite = initializeCleanEnvironments()
			overwrite = define(variable('y', '_2'), true, overwrite)
			const result = overwriteEnvironment(clean, overwrite)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.current.memory, 'there should be two definitions for x and y').to.have.length(2)
			existsDefinedAt('x', ['_1'], result.current, 'globals must be defined locally as well')
			existsDefinedAt('y', ['_2'], result.current, 'globals must be defined locally as well')
		})

		it(label('Same variables', ['global-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('x', '_1'), true, clean)
			let overwrite = initializeCleanEnvironments()
			overwrite = define(variable('x', '_2'), true, overwrite)
			const result = overwriteEnvironment(clean, overwrite)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.current.memory, 'there should be only one definition for x').to.have.length(1)
			existsDefinedAt('x', ['_2'], result.current)
		})
	})

	describe('Local', () => {
		it(label('Different variables', ['lexicographic-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('long', '_1'), false, clean)
			let overwrite = initializeCleanEnvironments()
			overwrite = define(variable('short', '_2'), false, overwrite)
			const result = overwriteEnvironment(clean, overwrite)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.level, 'neither definitions nor overwrites should produce new local scopes').to.be.equal(0)
			expect(result.current.memory, 'there should be two definitions for long and short').to.have.length(2)
			existsDefinedAt('long', ['_1'], result.current)
			existsDefinedAt('short', ['_2'], result.current)
		})

		it(label('Same variables', ['lexicographic-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('long', '_1'), false, clean)
			let overwrite = initializeCleanEnvironments()
			overwrite = define(variable('long', '_2'), false, overwrite)
			const result = overwriteEnvironment(clean, overwrite)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.level, 'neither definitions nor overwrites should produce new local scopes').to.be.equal(0)
			expect(result.current.memory, 'there should be only one definition for long').to.have.length(1)
			existsDefinedAt('long', ['_2'], result.current)
		})
	})
})

describe('Append', () => {
	describe('Global', () => {
		it(label('Different variables', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('x', '_1'), true, clean)
			let append = initializeCleanEnvironments()
			append = define(variable('y', '_2'), true, append)
			const result = appendEnvironment(clean, append)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.current.memory, 'there should be two definitions for x and y').to.have.length(2)
			existsDefinedAt('x', ['_1'], result.current, 'globals must be defined locally as well')
			existsDefinedAt('y', ['_2'], result.current, 'globals must be defined locally as well')
		})

		it(label('Same variables', ['global-scope', 'lexicographic-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('x', '_1'), true, clean)
			let append = initializeCleanEnvironments()
			append = define(variable('x', '_2'), true, append)
			const result = appendEnvironment(clean, append)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.current.memory, 'there should be only one symbol defined (for x)').to.have.length(1)
			existsDefinedAt('x', ['_1', '_2'], result.current)
		})
	})

	describe('Local', () => {
		it(label('Different variables', ['lexicographic-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('local-long', '_1'), false, clean)
			let append = initializeCleanEnvironments()
			append = define(variable('local-short', '_2'), false, append)
			const result = appendEnvironment(clean, append)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.level, 'neither definitions nor appends should produce new local scopes').to.be.equal(0)
			expect(result.current.memory, 'there should be two definitions for local-long and local-short').to.have.length(2)
			existsDefinedAt('local-long', ['_1'], result.current)
			existsDefinedAt('local-short', ['_2'], result.current)
		})

		it(label('Same variables', ['lexicographic-scope'], ['other']), () => {
			let clean = initializeCleanEnvironments()
			clean = define(variable('local-long', '_1'), false, clean)
			let append = initializeCleanEnvironments()
			append = define(variable('local-long', '_2'), false, append)
			const result = appendEnvironment(clean, append)
			expect(result, 'there should be a result').to.be.not.undefined
			expect(result.level, 'neither definitions nor overwrites should produce new local scopes').to.be.equal(0)
			expect(result.current.memory, 'there should be only one definition for local-long').to.have.length(1)
			existsDefinedAt('local-long', ['_1', '_2'], result.current)
		})
	})
})
