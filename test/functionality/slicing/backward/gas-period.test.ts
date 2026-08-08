import { assert, describe, test } from 'vitest';
import { VisitingQueue } from '../../../../src/slicing/static/visiting-queue';
import { GasLevel } from '../../../../src/gas';
import type { ReadOnlyFlowrAnalyzerGasContext } from '../../../../src/project/context/flowr-analyzer-gas-context';
import type { REnvironmentInformation } from '../../../../src/dataflow/environments/environment';
import { label } from '../../_helper/label';

/** a queue holding `size` nodes, with a gas context counting how often it is asked */
function queueOf(size: number): { queue: VisitingQueue, checks: () => number } {
	let checks = 0;
	const gas = { checkGas: () => {
		checks++; return GasLevel.Normal;
	} } as unknown as ReadOnlyFlowrAnalyzerGasContext;
	const queue = new VisitingQueue(size + 1, undefined, undefined, gas);
	for(let i = 0; i < size; i++) {
		queue.add(i, {} as REnvironmentInformation, `f${i}`, false);
	}
	return { queue, checks: () => checks };
}

describe('Polling the gas', () => {
	test.each([[512, 1], [1024, 2], [2048, 4]])('%i visits ask %i times', (calls, expected) => {
		const { queue, checks } = queueOf(calls + 1);
		for(let i = 0; i < calls; i++) {
			queue.nonEmpty();
		}
		assert.strictEqual(checks(), expected, 'the check happens every 512 visits, the checking one included');
	});

	test(label('no gas context means no polling at all', ['name-normal'], ['other']), () => {
		const queue = new VisitingQueue(10);
		queue.add(1, {} as REnvironmentInformation, 'f', false);
		assert.isTrue(queue.nonEmpty());
	});
});
