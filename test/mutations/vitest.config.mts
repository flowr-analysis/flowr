import { configDefaults, defineConfig } from 'vitest/config';
import { TestSuites } from '../functionality/summary-def';

/*
 * set here since globalSetup runs before workers see test.env, and this file shares that process.
 * keeps this suite's run from overwriting the functionality suite's own test-details file.
 */
process.env.FLOWR_TEST_DETAILS_FILE = TestSuites.mutations.details;

export default defineConfig({
	test: {
		testTimeout: 60 * 1000,
		sequence:    {
			/* explicit concurrent:true is what makes a file without parallel support run in sequence */
			concurrent: true,
			setupFiles: 'parallel'
		},
		/* reuse the functionality suite's setup so `label(...)` claims and the summary pipeline stay identical */
		setupFiles:  [`./${TestSuites.functionality.folder}/test-setup.ts`],
		globalSetup: [`./${TestSuites.functionality.folder}/test-setup-global.ts`],
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
		include: [`${TestSuites.mutations.folder}/**/*.test.ts`]
	},
});
