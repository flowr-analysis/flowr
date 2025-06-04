import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'./test/vitest.config.mts',
	'./test/system-tests/vitest.config.mts'
]);
