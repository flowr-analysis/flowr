import { assert, describe, test } from 'vitest';
import { VisitingQueue } from '../../../../src/slicing/static/visiting-queue';
import { GasLevel } from '../../../../src/gas';
import { DefaultCountedCheckEvery } from '../../../../src/config';
import type { ReadOnlyFlowrAnalyzerGasContext } from '../../../../src/project/context/flowr-analyzer-gas-context';
import type { REnvironmentInformation } from '../../../../src/dataflow/environments/environment';
import { label } from '../../_helper/label';

/** a queue holding `size` nodes, with a gas context counting how often it is asked */
function queueOf(size: number, checkEvery = DefaultCountedCheckEvery): { queue: VisitingQueue, checks: () => number } {
	let checks = 0;
	const gas = { checkGas: () => {
		checks++; return GasLevel.Normal;
	}, checkEvery: () => checkEvery } as unknown as ReadOnlyFlowrAnalyzerGasContext;
	const queue = new VisitingQueue(size + 1, undefined, undefined, gas);
	for(let i = 0; i < size; i++) {
		queue.add(i, {} as REnvironmentInformation, `f${i}`, false);
	}
	return { queue, checks: () => checks };
}

describe('Polling the gas', () => {
	/* the period is `gas.countedCheckEvery`, the same one an armed dataflow budget samples at */
	test.each([[1, 1], [2, 2], [4, 4]])('%i periods of visits ask %i times', (periods, expected) => {
		const calls = periods * DefaultCountedCheckEvery;
		const { queue, checks } = queueOf(calls + 1);
		for(let i = 0; i < calls; i++) {
			queue.nonEmpty();
		}
		assert.strictEqual(checks(), expected, 'the check happens once a period, the checking visit included');
	});

	test(label('the period follows the configured value', ['name-normal'], ['other']), () => {
		const { queue, checks } = queueOf(33, 16);
		for(let i = 0; i < 32; i++) {
			queue.nonEmpty();
		}
		assert.strictEqual(checks(), 2, '32 visits at a period of 16');
	});

	test(label('no gas context means no polling at all', ['name-normal'], ['other']), () => {
		const queue = new VisitingQueue(10);
		queue.add(1, {} as REnvironmentInformation, 'f', false);
		assert.isTrue(queue.nonEmpty());
	});
});
