import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 60 * 2000,
		hookTimeout: 60 * 2000,
		sequence:    {
			/* each test file that does not support parallel execution will be executed in sequence by stating this explicitly */
			concurrent: true,
			setupFiles: 'parallel'
		},
		reporters: process.env.GITHUB_ACTIONS ? ['basic', 'github-actions'] : ['dot'],
		isolate:   false,
		pool:      'threads',
		deps:      {
			optimizer: {
				ssr: {
					enabled: true
				}
			}
		}
	},
});
