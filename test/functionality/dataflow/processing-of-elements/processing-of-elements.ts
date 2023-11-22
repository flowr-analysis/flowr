import { requireAllTestsInFolder } from '../../_helper/collect-tests'
import path from 'path'

require('./elements/atomic')
require('./elements/expression-lists')

describe('Processing of Elements', () => {
	describe('atomic', () =>
		requireAllTestsInFolder(path.join(__dirname, 'atomic'))
	)

	describe('loops', () =>
		requireAllTestsInFolder(path.join(__dirname, 'loops'))
	)

	describe('expression-lists', () =>
		requireAllTestsInFolder(path.join(__dirname, 'expression-lists'))
	)

	describe('Functions', () =>
		requireAllTestsInFolder(path.join(__dirname, 'functions'))
	)
})
