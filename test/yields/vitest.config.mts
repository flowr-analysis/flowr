import { defineConfig } from 'vitest/config';

/* every check runs its own R processes, so all run at once */
export default defineConfig({
	test: {
		include:     ['test/yields/**/*.test.ts'],
		setupFiles:  ['./test/functionality/test-setup.ts'],
		testTimeout: 120 * 1000,
		sequence:    { concurrent: true },
		reporters:   process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['dot'],
		pool:        'threads',
		environment: 'node',
		server:      { deps: { external: [/web-tree-sitter/] } }
	}
});
