import { configDefaults, defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';

/* read rather than imported: a JSON import needs an import attribute the project's TypeScript setup does not allow */
const TestSuites = JSON.parse(readFileSync('test/functionality/test-suites.json', 'utf8')) as Record<'functionality' | 'mutations', { folder: string, details: string }>;

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			exclude:  [
				...configDefaults.exclude,
				'**/node_modules/**',
				'./dist/**',
				'./coverage/**',
				'./wiki/**',
				'./doc/**',
				'./test/**',
				'./src/documentation/**',
			]
		},
		testTimeout: 60 * 1000,
		sequence:    {
			/* each test file that does not support parallel execution will be executed in sequence by stating this explicitly */
			concurrent: true,
			setupFiles: 'parallel'
		},
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
			'dist/**',
			'test/system-tests/**',
			'test/mutations/**'
		],
		include: [`${TestSuites.functionality.folder}/**/*.test.ts`]
	},
});
