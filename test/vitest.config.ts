import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8'
		},
		testTimeout: 60 * 1000,
		sequence:    {
			/* each test file that does not support parallel execution will be executed in sequence by stating this explicitly */
			concurrent: true,
			setupFiles: 'parallel'
		},
		setupFiles:  ['./test/functionality/test-setup.ts'],
		globalSetup: ['./test/functionality/test-summary.ts'],
		reporters:   process.env.GITHUB_ACTIONS ? ['basic', 'github-actions'] : ['dot'],
		isolate:     false,
		pool:        'threads',
		deps:        {
			optimizer: {
				ssr: {
					enabled: true
				}
			}
		}
	},
});
