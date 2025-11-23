import { makeContextForTypes } from '../documentation/wiki-mk/wiki-context';
import { RShell } from '../r-bridge/shell';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { WikiMakerArgs, WikiMakerLike, WikiMakerOutputArgs } from '../documentation/wiki-mk/wiki-maker';
import fs from 'fs';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import type { OptionDefinition } from 'command-line-usage';
import commandLineUsage from 'command-line-usage';
import commandLineArgs from 'command-line-args';
import { flowrVersion } from '../util/version';
import { WikiFaq } from '../documentation/wiki-faq';
import { ansiFormatter, ColorEffect, Colors, FontStyles } from '../util/text/ansi';
import { WikiSearch } from '../documentation';
import { WikiCfg } from '../documentation/wiki-cfg';

const Wikis: WikiMakerLike[] = [
	new WikiFaq(),
	new WikiSearch(),
	new WikiCfg()
];

/**
 * Updates and optionally re-creates all flowR wikis.
 */
export async function makeAllWikis(force: boolean, filter: string[] | undefined) {
	const setupStart = new Date();
	console.log('Setting up wiki generation...');
	const shell = new RShell();
	console.log('  * R shell initialized');
	await TreeSitterExecutor.initTreeSitter();
	const treeSitter = new TreeSitterExecutor();
	console.log('  * Tree-sitter parser initialized');
	const ctx = makeContextForTypes(shell);
	console.log('  * Wiki context prepared');
	const info: WikiMakerArgs & WikiMakerOutputArgs = {
		ctx,
		shell, treeSitter,
		force,
		readFileSync(f: fs.PathLike) {
			try {
				return fs.readFileSync(f);
			} catch{
				return undefined;
			}
		},
		writeFileSync: fs.writeFileSync
	};

	console.log(`Setup for wiki generation took ${(new Date().getTime() - setupStart.getTime())}ms`);
	try {
		for(const wiki of Wikis) {
			if(filter && !filter.some(f => wiki.getTarget().includes(f))) {
				console.log(`  * Skipping wiki (filtered out): ${wiki.getTarget()}`);
				continue;
			}
			const now = new Date();
			console.log(ansiFormatter.format(`  [${wiki.getTarget()}] Updating wiki...`, { style: FontStyles.Bold, color: Colors.Cyan, effect: ColorEffect.Foreground }));
			const changed = await wiki.make(info);
			const text = changed ? 'Wiki updated' : 'Wiki identical, no changes made';
			const color = changed ? Colors.Green : Colors.White;
			console.log(ansiFormatter.format(`  [${wiki.getTarget()}] ${text}: ${wiki.getTarget()} (took ${new Date().getTime() - now.getTime()}ms)`, { color, effect: ColorEffect.Foreground }));
		}
	} catch(error) {
		console.error('Error while generating wikis:', error);
	} finally {
		shell.close();
	}
	console.log('All wikis processed in ' + (new Date().getTime() - setupStart.getTime()) + 'ms');
}

if(require.main === module) {
	const wikiOptions: OptionDefinition[] = [
		{ name: 'force', alias: 'F', type: Boolean, description: 'Overwrite existing wiki files, even if nothing changes' },
		{ name: 'filter', alias: 'f', type: String, multiple: true, description: 'Only generate wikis whose target path contains the given string' },
		{ name: 'help', alias: 'h', type: Boolean, description: 'Print this usage guide for the wiki generator' },
		{ name: 'keep-alive', type: Boolean, description: 'Keep-alive wiki generator (only sensible with a reloading script like ts-node-dev)' },
	];

	interface WikiCliOptions {
		force:        boolean;
		filter?:      string[];
		help:         boolean;
		'keep-alive': boolean;
	}

	const optionHelp = [
		{
			header:  `flowR (version ${flowrVersion().toString()})`,
			content: 'Wiki generator for flowR'
		},
		{
			header:  'Synopsis',
			content: [
				'$ wiki {bold --help}',
				'$ wiki {bold --force}',
				'$ wiki {bold --filter} {italic "dataflow"}'
			]
		},
		{
			header:     'Options',
			optionList: wikiOptions
		}
	];


	// TODO: provide wiki:watch with reload
	setMinLevelOfAllLogs(LogLevel.Fatal);
	// parse args
	const options = commandLineArgs(wikiOptions) as WikiCliOptions;
	if(options.help) {
		console.log(commandLineUsage(optionHelp));
		process.exit(0);
	}
	void makeAllWikis(options.force, options.filter).catch(err => {
		console.error('Error while generating wikis:', err);
		process.exit(1);
	});
	if(options['keep-alive']) {
		console.log('Wiki generator running in keep-alive mode...');
		// keep alive
		setInterval(() => {
			// do nothing, just keep alive
		}, 100);
	}
}
