import type { FlowrConfigOptions } from '../../../src/config';
import { setConfig , getConfig } from '../../../src/config';
import { afterAll, beforeAll } from 'vitest';
import type { DeepPartial } from 'ts-essentials';
import { deepMergeObject } from '../../../src/util/objects';


/**
 * Temporarily sets the config to the given value for all tests in the suite.
 */
export function useConfigForTest(config: DeepPartial<FlowrConfigOptions>): void {
	const currentConfig = getConfig();
	beforeAll(() => {
		setConfig(deepMergeObject(currentConfig, config) as FlowrConfigOptions);
	});
	afterAll(() => {
		setConfig(currentConfig);
	});
}
