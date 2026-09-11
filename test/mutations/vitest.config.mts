import { configDefaults, defineConfig } from 'vitest/config';

/*
 * set here since globalSetup runs before workers see test.env, and this file shares that process.
 * keeps this suite's run from overwriting the functionality suite's own test-details file.
 */
process.env.FLOWR_TEST_DETAILS_FILE = 'coverage/flowr-test-details-mutations.json';

export default defineConfig({
	test: {
		testTimeout: 60 * 1000,
		sequence:    {
			/* explicit concurrent:true is what makes a file without parallel support run in sequence */
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
