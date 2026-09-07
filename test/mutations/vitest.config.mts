import { configDefaults, defineConfig } from 'vitest/config';

/*
 * globalSetup runs in vitest's own process before `test.env` is injected into workers, so `test.env`
 * cannot reach it; setting it here (this file also runs in that process) is what does. This is what
 * keeps a run of this suite from overwriting the functionality suite's own `coverage/flowr-test-details.json`.
 */
process.env.FLOWR_TEST_DETAILS_FILE = 'coverage/flowr-test-details-mutations.json';

export default defineConfig({
	test: {
		testTimeout: 60 * 1000,
		sequence:    {
			/* each test file that does not support parallel execution will be executed in sequence by stating this explicitly */
			concurrent: true,
			setupFiles: 'parallel'
		},
		/* reuse the functionality suite's setup so `label(...)` claims and the summary pipeline stay identical */
		setupFiles:  ['./test/functionality/test-setup.ts'],
		globalSetup: ['./test/functionality/test-setup-global.ts'],
		reporters:   process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['dot'],
		isolate:     false,
		pool:        'threads',
		environment: 'node',
		server:      {
			deps: {
				external: [/web-tree-sitter/]
			}
		},
		deps: {
			optimizer: {
				ssr: {
					enabled: true
				}
			}
		},
		exclude: [
			...configDefaults.exclude,
			'dist/**'
		],
		include: ['test/mutations/**/*.test.ts']
	},
});
