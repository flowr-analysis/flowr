import type { OptionDefinition } from 'command-line-usage';
import { scripts } from './common/scripts-info';

let _scriptsText: string | undefined;

export function getScriptsText() {
	if(_scriptsText === undefined) {
		_scriptsText = Array.from(Object.entries(scripts).filter(([, { type }]) => type === 'master script'), ([k]) => k).join(', ');
	}
	return _scriptsText;
}

export const flowrMainOptionDefinitions: OptionDefinition[] = [
	{ name: 'config-file', type: String, description: 'The name of the configuration file to use', multiple: false },
	{
		name:        'config-json',
		type:        String,
		description: 'The flowR configuration to use, as a JSON string',
		multiple:    false
	},
	{
		name:        'execute',
		alias:       'e',
		type:        String,
		description: 'Execute the given command and exit. Use a semicolon ";" to separate multiple commands.',
		typeLabel:   '{underline command}',
		multiple:    false
	},
	{
		name:        'help',
		alias:       'h',
		type:        Boolean,
		description: 'Print this usage guide (or the guide of the corresponding script)'
	},
	{
		name:        'no-ansi',
		type:        Boolean,
		description: 'Disable ansi-escape-sequences in the output. Useful, if you want to redirect the output to a file.'
	},
	{
		name:         'port',
		type:         Number,
		description:  'The port to listen on, if --server is given.',
		defaultValue: 1042,
		typeLabel:    '{underline port}'
	},
	{
		name:        'r-path',
		type:        String,
		description: 'The path to the R executable to use. Defaults to your PATH. This option is being phased out in favor of the engine configuration option "engine.r-shell.r-path", which should be used instead.',
		multiple:    false
	},
	{
		name:        'r-session-access',
		type:        Boolean,
		description: 'Allow to access the underlying R session when using flowR (security warning: this allows the execution of arbitrary R code!)'
	},
	{
		name:          'script',
		alias:         's',
		type:          String,
		description:   `The sub-script to run (${getScriptsText()})`,
		multiple:      false,
		defaultOption: true,
		typeLabel:     '{underline files}',
		defaultValue:  undefined
	},
	{
		name:        'server',
		type:        Boolean,
		description: 'Do not drop into a repl, but instead start a server on the given port (default: 1042) and listen for messages.'
	},
	{
		name:        'verbose',
		alias:       'v',
		type:        Boolean,
		description: 'Run with verbose logging (will be passed to the corresponding script)'
	},
	{
		name:        'version',
		alias:       'V',
		type:        Boolean,
		description: 'Provide information about the version of flowR as well as its underlying R system and exit.'
	},
	{ name: 'ws', type: Boolean, description: 'If the server flag is set, use websocket for messaging' },
	{
		name:        'engine.r-shell.disabled',
		type:        Boolean,
		description: 'Disable the R shell engine'
	},
	{
		name:        'engine.r-shell.r-path',
		type:        String,
		description: 'The path to the R executable to use. Defaults to your PATH.',
		multiple:    false
	},
	{
		name:        'engine.tree-sitter.disabled',
		type:        Boolean,
		description: 'Disable the tree-sitter engine'
	},
	{
		name:        'engine.tree-sitter.wasm-path',
		type:        String,
		description: 'The path to the tree-sitter-r WASM binary to use. Defaults to the one shipped with flowR.',
		multiple:    false
	},
	{
		name:        'engine.tree-sitter.tree-sitter-wasm-path',
		type:        String,
		description: 'The path to the tree-sitter WASM binary to use. Defaults to the path specified by the tree-sitter package.',
		multiple:    false
	},
	{
		name:        'default-engine',
		type:        String,
		description: 'The default engine to use for interacting with R code. If this is undefined, an arbitrary engine from the specified list will be used.',
		multiple:    false
	}
];

export const defaultConfigFile = 'flowr.json';
