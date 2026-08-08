export const recommendedZedConfig = {
	'languages': {
		'TypeScript': {
			'formatter': [],
			'prettier':  {
				'allowed': false
			},
			'code_actions_on_format': {
				'source.fixAll.eslint': true
			}
		}
	},
	'hard_tabs': true
};

export const recommendedVsCodeTask = {
	'version':        '0.2.0',
	'configurations': [
		{
			'type':      'node',
			'request':   'launch',
			'name':      'Launch Program',
			'skipFiles': [
				'node_modules/**'
			],
			'program':       '${workspaceFolder}/src/cli/flowr.ts',
			'preLaunchTask': 'npm: build-dev',
			'console':       'integratedTerminal',
		},
		{
			'type':    'node',
			'request': 'attach',
			'name':    'Attach to Process',
			'port':    9229
		}
	]
};
