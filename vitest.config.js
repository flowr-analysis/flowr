import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			'./test/vitest.config.mts',
			'./test/system-tests/vitest.config.mts'
		]
	}
});
