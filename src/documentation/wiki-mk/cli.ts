import type { DocMakerArgs, DocMakerLike, DocMakerOutputArgs } from './doc-maker';
import { RShell } from '../../r-bridge/shell';
import { TreeSitterExecutor } from '../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { makeDocContextForTypes } from './doc-context';
import { ansiFormatter, ColorEffect, Colors, FontStyles } from '../../util/text/ansi';
import fs from 'fs';
import os from 'os';
import type { OptionDefinition } from 'command-line-usage';
import commandLineUsage from 'command-line-usage';
import commandLineArgs from 'command-line-args';
import { setMinLevelOfAllLogs } from '../../../test/functionality/_helper/log';
import { LogLevel } from '../../util/log';
import type { DocRefs } from '../doc-util/doc-refs';

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
export async function makeAllWikis(docs: DocMakerLike[], refs: DocRefs, force: boolean, filter: string[] | undefined, rootFolders?: string[]) {
	const setupStart = new Date();
	console.log('Setting up wiki generation...');
	const shell = new RShell();
	console.log('  * R shell initialized');
	await TreeSitterExecutor.initTreeSitter();
	const treeSitter = new TreeSitterExecutor();
	console.log('  * Tree-sitter parser initialized');
	const ctx = makeDocContextForTypes(refs, shell, ...rootFolders ?? []);
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

	console.log(`Setup for wiki generation took ${(Date.now() - setupStart.getTime())}ms`);
	const changedWikis = new Set<string>();
	try {
		const sortedDocs = sortByLeastRecentChanged(docs);
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
			console.log(ansiFormatter.format(`  [${doc.getTarget()}] ${text}: ${doc.getTarget()} (took ${Date.now() - now.getTime()}ms)`, { color, effect: ColorEffect.Foreground }));
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
	console.log('All wikis processed in ' + (Date.now() - setupStart.getTime()) + 'ms');
	console.log(`    * Changed ${changedWikis.size} wiki/doc files.`);
	// write a temp file in the os temp dir with the changed wikis
	const filename=`${os.tmpdir()}/flowr-wiki-changed-files.txt`;
	fs.writeFileSync(`${filename}`, Array.from(changedWikis).join('\n'));
	console.log(`    * List of changed wikis/docs written to ${filename}`);
}

interface WikiOptions {
	/** The pages to create the wiki from */
	docs:         DocMakerLike[],
	/** Interface containing various references */
	refs:         DocRefs,
	/** Paths to folders containing the necessary type definitions */
	rootFolders?: string[],
	/** To be printed by {@link commandLineUsage} */
	header:       string,
	/** Content to be printed by {@link commandLineUsage} */
	content:      string
}

/**
 * Generic CLI function for creating wiki pages from {@link DocMakerLike} classes.
 */
export function wikiCli({ docs, refs, rootFolders, header, content }: WikiOptions) {
	const wikiOptions: OptionDefinition[] = [
		{ name: 'force', alias: 'F', type: Boolean, description: 'Overwrite existing wiki files, even if nothing changes' },
		{ name: 'filter', alias: 'f', type: String, multiple: true, description: 'Only generate wikis whose target path contains the given string' },
		{ name: 'help', alias: 'h', type: Boolean, description: 'Print this usage guide for the wiki generator' },
		{ name: 'keep-alive', type: Boolean, description: 'Keep-alive wiki generator (only sensible with a reloading script like node --watch)' },
	];

	interface WikiCliOptions {
		force:        boolean;
		filter?:      string[];
		help:         boolean;
		'keep-alive': boolean;
	}

	const optionHelp = [
		{
			header,
			content
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

	setMinLevelOfAllLogs(LogLevel.Fatal);
	// parse args
	const options = commandLineArgs(wikiOptions) as WikiCliOptions;
	if(options.help) {
		console.log(commandLineUsage(optionHelp));
		process.exit(0);
	}
	void makeAllWikis(docs, refs, options.force, options.filter, rootFolders).catch(err => {
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
