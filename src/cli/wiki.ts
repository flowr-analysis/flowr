import { makeContextForTypes } from '../documentation/wiki-mk/wiki-context';
import { RShell } from '../r-bridge/shell';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { DocMakerArgs, DocMakerLike, DocMakerOutputArgs } from '../documentation/wiki-mk/doc-maker';
import fs from 'fs';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import type { OptionDefinition } from 'command-line-usage';
import commandLineUsage from 'command-line-usage';
import commandLineArgs from 'command-line-args';
import { flowrVersion } from '../util/version';
import { WikiFaq } from '../documentation/wiki-faq';
import { ansiFormatter, ColorEffect, Colors, FontStyles } from '../util/text/ansi';
import {
	DocCapabilities,
	WikiCore, WikiDataflowGraph,
	WikiEngine,
	WikiInterface, WikiLintingAndTesting,
	WikiNormalizedAst,
	WikiQuery,
	WikiSearch
} from '../documentation';
import { WikiCfg } from '../documentation/wiki-cfg';
import { WikiOnboarding } from '../documentation/wiki-onboarding';
import { WikiAnalyzer } from '../documentation/wiki-analyzer';
import { IssueLintingRule } from '../documentation/issue-linting-rule';
import { DocReadme } from '../documentation/doc-readme';
import { WikiLinter } from '../documentation/wiki-linter';
import os from 'os';

const Documents: DocMakerLike[] = [
	new WikiFaq(),
	new WikiSearch(),
	new WikiCfg(),
	new WikiQuery(),
	new WikiOnboarding(),
	new WikiAnalyzer(),
	new WikiEngine(),
	new WikiNormalizedAst(),
	new WikiCore(),
	new WikiInterface(),
	new WikiDataflowGraph(),
	new WikiLintingAndTesting(),
	new WikiLinter(),
	new IssueLintingRule(),
	new DocReadme(),
	new DocCapabilities()
];

function sortByLeastRecentChanged(wikis: DocMakerLike[]): DocMakerLike[] {
	return wikis.slice().sort((a, b) => {
		const aStat = fs.existsSync(a.getProducer()) ? fs.statSync(a.getProducer()) : undefined;
		const bStat = fs.existsSync(b.getProducer()) ? fs.statSync(b.getProducer()) : undefined;
		const aMTime = aStat ? aStat.mtime.getTime() : 0;
		const bMTime = bStat ? bStat.mtime.getTime() : 0;
		return bMTime - aMTime;
	});
}

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
	if(force) {
		console.log(ansiFormatter.format('Forcing wiki regeneration (existing files will be overwritten)', { style: FontStyles.Bold, color: Colors.Yellow, effect: ColorEffect.Foreground }));
	}
	const info: DocMakerArgs & DocMakerOutputArgs = {
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
	const changedWikis = new Set<string>();
	try {
		const sortedDocs = sortByLeastRecentChanged(Documents);
		console.log(`Generating ${sortedDocs.length} wikis/docs, sorted by most recently updated...`);
		for(const doc of sortedDocs) {
			const type = doc.getTarget().toLowerCase().includes('wiki') ? 'Wiki' : 'Doc';
			if(filter && !filter.some(f => doc.getTarget().includes(f))) {
				console.log(`  * Skipping ${type} (filtered out): ${doc.getTarget()}`);
				continue;
			}
			const now = new Date();
			console.log(ansiFormatter.format(`  [${doc.getTarget()}] Updating ${type}...`, { style: FontStyles.Bold, color: Colors.Cyan, effect: ColorEffect.Foreground }));
			const changed = await doc.make(info);
			const text = changed ? `${type} updated` : `${type} identical, no changes made`;
			if(changed) {
				changedWikis.add(doc.getTarget());
			}
			const color = changed ? Colors.Green : Colors.White;
			console.log(ansiFormatter.format(`  [${doc.getTarget()}] ${text}: ${doc.getTarget()} (took ${new Date().getTime() - now.getTime()}ms)`, { color, effect: ColorEffect.Foreground }));
			for(const out of doc.getWrittenSubfiles()) {
				changedWikis.add(out);
				console.log(`    - Also updated: ${out}`);
			}
		}
	} catch(error) {
		console.error('Error while generating documents:', error);
	} finally {
		shell.close();
	}
	console.log('All wikis processed in ' + (new Date().getTime() - setupStart.getTime()) + 'ms');
	console.log(`    * Changed ${changedWikis.size} wiki/doc files.`);
	// write a temp file in the os temp dir with the changed wikis
	fs.writeFileSync(`${os.tmpdir()}/flowr-wiki-changed-wikis.txt`, Array.from(changedWikis).join('\n'));
	console.log(`    * List of changed wikis/docs written to ${os.tmpdir()}/flowr-wiki-changed-wikis.txt`);
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
			content: 'Documentation (wiki, issue, ...) generator for flowR'
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

	// TODO: speed up broken link check by parallelize readme check with rest
	// TODO: document wiki:watch
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
	}).then(() => {
		if(options['keep-alive']) {
			console.log('Wiki generator running in keep-alive mode...');
			setInterval(() => {
				// do nothing, just keep alive
			}, 100);
		}
	});
}
