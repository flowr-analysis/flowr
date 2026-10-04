import { configDefaults, defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';

/* read rather than imported: a JSON import needs an import attribute the project's TypeScript setup does not allow */
const TestSuites = JSON.parse(readFileSync('test/functionality/test-suites.json', 'utf8')) as Record<'functionality' | 'mutations', { folder: string, details: string }>;

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
