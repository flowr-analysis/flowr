import { requireAllTestsInFolder } from '../_helper/collect-tests'
import path from 'path'
import {setSourceProvider} from '../../../src/dataflow/internal/process/functions/source'
import {requestProviderFromFile} from '../../../src'

describe('Dataflow', () => {
	describe('Environments', () =>
		requireAllTestsInFolder(path.join(__dirname, 'environments'))
	)

	describe('Graph', () =>
		requireAllTestsInFolder(path.join(__dirname, 'graph'))
	)

	// reset the source provider back to the default value after each "describe" section
	after(() => setSourceProvider(requestProviderFromFile()))

	require('./processing-of-elements/processing-of-elements')
})
