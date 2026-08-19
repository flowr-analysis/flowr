import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globalSetup: ['test/system-tests/utility/global-setup.ts'],
		/* a test may have to wait for a full build and bundle, see `DefaultTimeout` of the utilities */
		testTimeout: 6 * 60 * 1000,
		hookTimeout: 6 * 60 * 1000,
		sequence:    {
			/* each test file that does not support parallel execution will be executed in sequence by stating this explicitly */
			concurrent: true,
			setupFiles: 'parallel'
		},
		reporters:   process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['dot'],
		isolate:     false,
		pool:        'threads',
		environment: 'node',
		deps:        {
			optimizer: {
				ssr: {
					enabled: true
				}
			}
		}
	},
});
