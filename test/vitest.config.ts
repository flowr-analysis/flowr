import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8'
		},
		testTimeout: 60 * 1000,
		sequence:    {
			concurrent: false
		},
		setupFiles: ['./test/functionality/test-setup.ts'],
	},
});
