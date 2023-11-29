import { requireAllTestsInFolder } from '../_helper/collect-tests'
import path from 'path'
import { PipelineExecutor } from '../../../src/core/pipeline-executor'
import { DEFAULT_SLICING_PIPELINE } from '../../../src/core/steps/pipeline'
import { withShell } from '../_helper/shell'
import { requestFromInput } from '../../../src/r-bridge'

describe('Dataflow', () => {
	describe('Environments', () =>
		requireAllTestsInFolder(path.join(__dirname, 'environments'))
	)

	describe('Graph', () =>
		requireAllTestsInFolder(path.join(__dirname, 'graph'))
	)

	describe('x', withShell(shell => {
		it('foo', async() => {
			const stepper = new PipelineExecutor(DEFAULT_SLICING_PIPELINE, {
				shell,
				criterion: ['2@b'],
				request:   requestFromInput('b <- 3; x <- 5\ncat(b)'),
			})

			while(stepper.hasNextStep()) {
				await stepper.nextStep()
			}

			stepper.switchToRequestStage()

			while(stepper.hasNextStep()) {
				await stepper.nextStep()
			}

			const result = stepper.getResults()
			console.log(result)
		})
		it('bar', async() => {
			const stepper = new PipelineExecutor(DEFAULT_SLICING_PIPELINE, {
				shell,
				criterion: ['2@b'],
				request:   requestFromInput('b <- 3; x <- 5\ncat(b)'),
			})
			console.log(await stepper.allRemainingSteps())
			stepper.updateRequest({
				criterion: ['1@x']
			})
			console.log(await stepper.allRemainingSteps())
		})
	}))

	require('./processing-of-elements/processing-of-elements')
})
