import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { bold, italic } from '../../../util/text/ansi';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { executeQueries } from '../../../queries/query';
import { SignatureQueryDefinition } from '../../../queries/catalog/signature-query/signature-query-format';
import { asciiSummaryOfQueryResult } from '../../../queries/query-print';
import { downloadFullSigDb } from '../../../project/plugins/package-version-plugins/sigdb-download';

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
	output.stdout(`  ${bold(':signature query', f)} ${italic('[<package>[@<version>][::<function>] [<function>]] [--all] [--full]', f)}`);
	output.stdout(`      ${italic('inspect the database -- identical to :query @signature (run :signature query help for the full syntax)', f)}`);
	output.stdout(`  ${bold(':signature analyze', f)} ${italic('<dir>', f)}`);
	output.stdout(`      ${italic('analyze installed R package(s) on disk with flowR and add their signatures as a source', f)}`);
	output.stdout(`  ${bold(':signature add', f)} ${italic('<path-to-.sigs.ndjson|.br|.manifest.json>', f)}`);
	output.stdout(`      ${italic('mount an additional signature database/source (dictionaries + shards); takes precedence over the bundle', f)}`);
	output.stdout(`  ${bold(':signature download', f)} ${italic('[<version>]', f)}`);
	output.stdout(`      ${italic('download the full-history database (all CRAN versions) from the release and mount it', f)}`);
}

async function runQuery(output: ReplOutput, analyzer: Parameters<ReplCodeCommand['fn']>[0]['analyzer'], args: readonly string[]): Promise<void> {
	const parsed = SignatureQueryDefinition.fromLine(output, args, analyzer.flowrConfig).query;
	const queries = parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : [];
	if(queries.length === 0) {
		return;   // e.g. `:signature query help` already printed the usage guide
	}
	const start = Date.now();
	const results = await executeQueries({ analyzer }, queries);
	output.stdout(await asciiSummaryOfQueryResult(output.formatter, Date.now() - start, results, analyzer, queries));
}

export const signatureCommand: ReplCodeCommand = {
	description:   'Inspect and extend the signature database: `query` (identical to :query @signature), `analyze <dir>` to add packages from disk, `add <path>` to mount another database/source, `download` to fetch the full-history database.',
	isCodeCommand: true,
	usageExample:  ':signature <query|analyze|add|download> ...',
	aliases:       ['sig'],
	script:        false,
	argsParser:    parseArgs,
	fn:            async({ output, analyzer, remainingArgs }) => {
		const f = output.formatter;
		const [sub, ...rest] = remainingArgs.filter(a => a.length > 0);
		switch(sub) {
			case undefined:
			case 'help':
				printHelp(output);
				return;
			case 'query':
				await runQuery(output, analyzer, rest);
				return;
			case 'analyze': {
				const dir = joinArgs(rest);
				if(!dir) {
					output.stderr(`Usage: ${italic(':signature analyze <dir>', f)}`);
					return;
				}
				const added = await analyzer.context().deps.addLocalPackages(dir);
				analyzer.reset();   // drop cached analyses so the next one sees the new source
				if(added.length === 0) {
					output.stderr(`No packages could be analyzed at ${bold(dir, f)}.`);
					return;
				}
				output.stdout(`Analyzed and added ${bold(String(added.length), f)} package${added.length === 1 ? '' : 's'}: ${added.join(', ')}`);
				output.stdout(italic('Inspect them with :signature query <package> [<function>].', f));
				return;
			}
			case 'add': {
				const source = joinArgs(rest);
				if(!source) {
					output.stderr(`Usage: ${italic(':signature add <path-to-.sigs.ndjson|.br|.manifest.json>', f)}`);
					return;
				}
				await analyzer.context().deps.addDatabaseSource(source);
				analyzer.reset();
				output.stdout(`Mounted signature source ${bold(source, f)} (takes precedence over the bundled default).`);
				output.stdout(italic('Inspect it with :signature query.', f));
				return;
			}
			case 'download': {
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
					output.stdout(italic(`Add "${dir}" to solver.sigdb.additionalPaths to keep it mounted on every start.`, f));
				} catch(e) {
					output.stderr(`Download failed: ${(e as Error).message}`);
				}
				return;
			}
			default:
				output.stderr(`Unknown subcommand ${bold(sub, f)}. Use ${italic(':signature help', f)}.`);
		}
	}
};
