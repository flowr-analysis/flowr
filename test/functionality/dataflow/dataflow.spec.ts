import { requireAllTestsInFolder } from '../_helper/collect-tests';
import path from 'path';

describe('Dataflow', () => {
	describe('Environments', () =>
		requireAllTestsInFolder(path.join(__dirname, 'environments'))
	);

	describe('Graph', () =>
		requireAllTestsInFolder(path.join(__dirname, 'graph'))
	);

	describe('Query', () =>
		requireAllTestsInFolder(path.join(__dirname, 'query'))
	);

	require('./processing-of-elements/processing-of-elements');
});
