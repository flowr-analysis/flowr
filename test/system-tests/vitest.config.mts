import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 60 * 2000,
		sequence:    {
			concurrent: false,
			setupFiles: 'list'
		},
		reporters: process.env.GITHUB_ACTIONS ? ['basic', 'github-actions'] : ['dot'],
		isolate:   true,
		deps:      {
			optimizer: {
				ssr: {
					enabled: true
				}
			}
		}
	},
});
