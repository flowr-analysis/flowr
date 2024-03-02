import chai, { assert } from 'chai'
import { testWithShell, withShell } from '../_helper/shell'
import chaiAsPromised from 'chai-as-promised'
import semver from 'semver/preload'
import { guard } from '../../../src/util/assert'
chai.use(chaiAsPromised)

/** here we use testWithShell to get a fresh shell within each call */
describe('RShell sessions', withShell(shell => {
	it('test that we can create a connection to R', () => {
		assert.doesNotThrow(() => {
			shell.clearEnvironment()
		})
	})
	describe('test the version of R', () => {
		it('query the installed version of R', async() => {
			const version = await shell.usedRVersion()
			guard(version !== null, 'we should be able to retrieve the version of R')
			assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`)
			assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`)
		})
	})

	describe('let R make an addition', () => {
		[true, false].forEach(trimOutput => {
			it(`let R make an addition (${trimOutput ? 'with' : 'without'} trimming)`, async() => {
				const lines = await shell.sendCommandWithOutput('1 + 1', { automaticallyTrimOutput: trimOutput })
				assert.equal(lines.length, 1)
				assert.equal(lines[0], '[1] 2')
			})
		})
	})
	it('keep context of previous commands', async() => {
		shell.sendCommand('a <- 1 + 1')
		const lines = await shell.sendCommandWithOutput('a')
		assert.equal(lines.length, 1)
		assert.equal(lines[0], '[1] 2')
	})
	testWithShell('trigger timeout', async shell => {
		await assert.isRejected(
			shell.sendCommandWithOutput('Sys.sleep(42)', {
				timeout: {
					ms:             1,
					resetOnNewData: false
				}
			})
		)
	})
	testWithShell('clear environment should remove variable information', async shell => {
		shell.continueOnError() // we will produce an error!
		shell.sendCommand('options(warn=-1); invisible(Sys.setlocale("LC_MESSAGES", \'en_GB.UTF-8\'))')
		shell.sendCommand('a <- 1 + 1')
		shell.clearEnvironment()
		await shell.sendCommandWithOutput('a', { from: 'stderr' }).then(lines => {
			// just await an error
			assert.notMatch(lines[0], /^([1] 2)/)
		})
	})
	it('send multiple commands', async() => {
		shell.sendCommands('a <- 1', 'b <- 2', 'c <- a + b')

		const lines = await shell.sendCommandWithOutput('c')
		assert.equal(lines.length, 1)
		assert.equal(lines[0], '[1] 3')
	})
}))
