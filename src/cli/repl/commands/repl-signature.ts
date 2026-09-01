import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { bold, italic } from '../../../util/text/ansi';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { executeQueries } from '../../../queries/query';
import { SignatureQueryDefinition } from '../../../queries/catalog/signature-query/signature-query-format';
import { asciiSummaryOfQueryResult } from '../../../queries/query-print';
import { downloadFullSigDb } from '../../../project/sigdb/sigdb-download';
import { persistSigDbPathToGlobalConfig } from '../../../config';
import { fileProtocol } from '../../../r-bridge/retriever';
import { signatureQueryCompleter } from '../../../queries/catalog/signature-query/signature-query-executor';
import type { CommandCompletions } from '../core';

/** treat the whole line as arguments, no R code to separate */
function parseArgs(line: string) {
	return { rCode: undefined, remaining: splitAtEscapeSensitive(line) };
}

/** the (possibly space-containing) path/argument remainder passed to a subcommand */
function joinArgs(args: readonly string[]): string {
	return args.filter(a => a.length > 0).join(' ').trim();
}

function printHelp(output: ReplOutput): void {
	const f = output.formatter;
	output.stdout(bold('Signature Database', f) + italic('  (inspect and extend the databases that resolve library()/`::` calls)', f));
	output.stdout('');
	output.stdout(`  ${bold(':signature query', f)} ${italic('[<package>[@<version>][::<function>] [<function>]] [--param <name>] [--required <n>]', f)}`);
	output.stdout(`      ${italic('inspect the database -- identical to :query @signature; with no package it summarizes the loaded databases and per-shard load state (run :signature query help for the full syntax)', f)}`);
	output.stdout(`  ${bold(':signature add', f)} ${italic('<path-to-.sigs.ndjson|.br|.manifest.json>', f)}`);
	output.stdout(`      ${italic('mount an additional signature database/source (dictionaries + shards); takes precedence over the bundle', f)}`);
	output.stdout(`  ${bold(':signature download', f)} ${italic('[<version>]', f)}`);
	output.stdout(`      ${italic('download the full-history database (all CRAN versions) from the release and mount it', f)}`);
}

/** the analyzer handed to the repl command, reused by every subcommand handler */
type ReplAnalyzer = Parameters<ReplCodeCommand['fn']>[0]['analyzer'];

/** `:signature query ...` -- inspect the database (identical to the signature query run via `:query`) */
async function runQuery(output: ReplOutput, analyzer: ReplAnalyzer, args: readonly string[]): Promise<void> {
	const parsed = SignatureQueryDefinition.fromLine(output, args, analyzer.flowrConfig).query;
	const queries = parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : [];
	if(queries.length === 0) {
		return;   // e.g. `:signature query help` already printed the usage guide
	}
	const start = Date.now();
	const results = await executeQueries({ analyzer }, queries);
	output.stdout(await asciiSummaryOfQueryResult(output.formatter, Date.now() - start, results, analyzer, queries));
}

/** `:signature add <path>` -- mount an additional signature database/source (takes precedence over the bundle) */
async function runAdd(output: ReplOutput, analyzer: ReplAnalyzer, rest: readonly string[]): Promise<void> {
	const f = output.formatter;
	const source = joinArgs(rest);
	if(!source) {
		output.stderr(`Usage: ${italic(':signature add <path-to-.sigs.ndjson|.br|.manifest.json>', f)}`);
		return;
	}
	await analyzer.context().deps.addDatabaseSource(source);
	analyzer.reset();
	output.stdout(`Mounted signature source ${bold(source, f)} (takes precedence over the bundled default).`);
	output.stdout(italic('Inspect it with :signature query.', f));
}

/** `:signature download [<version>]` -- fetch the full-history database from the release and mount it */
async function runDownload(output: ReplOutput, analyzer: ReplAnalyzer, rest: readonly string[]): Promise<void> {
	const f = output.formatter;
	const sigdb = analyzer.flowrConfig.solver.sigdb;
	try {
		const { dir, manifest, files } = await downloadFullSigDb({
			version:    rest.find(a => a.length > 0),
			repo:       sigdb.downloadRepo,
			onProgress: msg => output.stdout(italic(`  ${msg}`, f))
		});
		output.stdout(`Downloaded ${bold(String(files.length), f)} file(s) to ${bold(dir, f)}.`);
		if(manifest) {
			await analyzer.context().deps.addDatabaseSource(manifest);
			analyzer.reset();
			output.stdout(`Mounted ${bold(manifest, f)}.`);
		}
		try {
			output.stdout(`Recorded in ${bold(persistSigDbPathToGlobalConfig(dir), f)}; loads automatically on the next startup.`);
		} catch(e) {
			output.stderr(italic(`Could not update global config (${(e as Error).message}); add ${dir} to solver.sigdb.additionalPaths manually.`, f));
		}
	} catch(e) {
		output.stderr(`Download failed: ${(e as Error).message}`);
	}
}

/** a `:signature` subcommand handler; handlers that do not need the analyzer/args simply ignore them (e.g. `help`) */
type SignatureSubHandler = (output: ReplOutput, analyzer: ReplAnalyzer, rest: readonly string[]) => Promise<void> | void;

/** every `:signature` subcommand keyed by name -- the single source driving both dispatch and completion */
const signatureSubcommands = {
	query:    runQuery,
	add:      runAdd,
	download: runDownload,
	help:     output => printHelp(output),
} satisfies Record<string, SignatureSubHandler>;

/** the `:signature` subcommand names, offered as completions for its first argument */
export const signatureSubcommandNames = Object.keys(signatureSubcommands);

/** completes `:signature`: its subcommands, then a file path for `add` (query args are freeform names) */
export function replSignatureCompleter(splitLine: readonly string[], startingNewArg: boolean): CommandCompletions {
	const subArgs = splitLine.slice(1).map(s => s.trim()).filter(s => s.length > 0);
	const inSubArgs = subArgs.length >= 2 || (subArgs.length === 1 && startingNewArg);
	if(!inSubArgs) {
		return { completions: signatureSubcommandNames.map(s => s + ' ') };
	}
	if(subArgs[0] === 'add') {
		return { completions: [fileProtocol] };
	}
	if(subArgs[0] === 'query') {
		return signatureQueryCompleter(subArgs.slice(1), startingNewArg);
	}
	return { completions: [] };
}

export const signatureCommand: ReplCodeCommand = {
	description:   'Inspect and extend the signature database: `query` (identical to :query @signature), `add <path>` to mount another database/source, `download` to fetch the full-history database.',
	isCodeCommand: true,
	usageExample:  ':signature <query|add|download> ...',
	aliases:       ['sig'],
	script:        false,
	argsParser:    parseArgs,
	fn:            async({ output, analyzer, remainingArgs }) => {
		const [sub = 'help', ...rest] = remainingArgs.filter(a => a.length > 0);
		const handler = signatureSubcommands[sub as keyof typeof signatureSubcommands];
		if(!handler) {
			output.stderr(`Unknown subcommand ${bold(sub, output.formatter)}. Use ${italic(':signature help', output.formatter)}.`);
			return;
		}
		await handler(output, analyzer, rest);
	}
};
