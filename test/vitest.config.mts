import { configDefaults, defineConfig } from 'vitest/config';

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
		setupFiles:  ['./test/functionality/test-setup.ts'],
		globalSetup: ['./test/functionality/test-setup-global.ts'],
		reporters:   process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['dot'],
		isolate:     false,
		pool:        'threads',
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
		}
	},
});
