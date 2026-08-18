/**
 * Generates the signature browser at `wiki/sigdb/index.html`.
 *
 * Every exported name flowR knows goes into that one file: as plain text the table is 13 MB, so it
 * ships gzipped and base64-encoded inside the page and the browser unpacks it with
 * `DecompressionStream` on the first search. Nothing is fetched, which is what keeps the page working
 * over GitHub Pages and straight off the file system alike.
 *
 * The result is a few megabytes, so it is deliberately not committed: the documentation job builds it
 * and publishes it to the orphan `gh-pages` branch, which keeps it off the repository's history.
 */
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { encode, pack, readSigIndex } from './sigdb-index';
import { flowrVersion } from '../src/util/version';

/**
 * The name ranker as plain script, so this page orders its hits with the very function the playground's
 * completion uses. The page has no bundler of its own, so the build writes the module into it.
 */
async function ranker(): Promise<string> {
	const bundled = await build({
		entryPoints: [path.join('src', 'util', 'text', 'name-rank.ts')],
		bundle:      true,
		write:       false,
		format:      'iife',
		globalName:  'NameRank',
		target:      'es2022',
		logLevel:    'error'
	});
	return `${bundled.outputFiles[0].text}\nconst rankName = NameRank.rankName;`;
}

const Target = path.join('wiki', 'sigdb');

const group = (n: number): string => n.toLocaleString('en-US');

async function main(): Promise<void> {
	/* the wiki job copies `wiki/` into the wiki repository, which has no business carrying megabytes;
	   it therefore asks for the landing page alone and leaves the browser to the documentation job */
	if(process.env.FLOWR_LANDING_ONLY) {
		console.log('  FLOWR_LANDING_ONLY is set, skipping the signature browser');
		return;
	}
	const index = await readSigIndex();
	if(index === undefined) {
		console.log('  no signature database found, skipping the sigdb page');
		return;
	}
	const blobs = encode(index.packages);
	const kinds = JSON.stringify(Object.fromEntries(index.kinds)).replaceAll('</', '<\\/');
	/* what flowR states about the names it defines, so a hit can show its signature next to the database's */
	const stated = JSON.stringify(Object.fromEntries([...index.stated].map(([name, entries]) =>
		[name, entries.map(({ pkg, params, props }) => [pkg, params ?? '', props.join(' ')])]))).replaceAll('</', '<\\/');
	const page = Template
		.replaceAll('<!--VERSION-->', `v${flowrVersion().format()}`)
		.replaceAll('<!--UPDATED-->', index.updated)
		.replaceAll('<!--PACKAGES-->', group(index.packages.length))
		.replaceAll('<!--FUNCTIONS-->', group(blobs.count))
		.replace('<!--RANKER-->', await ranker())
		.replace('"<!--KINDS-->"', kinds)
		.replace('"<!--STATED-->"', stated)
		.replace('"<!--FORMALS-->"', JSON.stringify(Object.fromEntries(index.formals)).replaceAll('</', '<\\/'))
		.replace('<!--DATA-->', pack(blobs.packages, blobs.names));

	fs.mkdirSync(Target, { recursive: true });
	const target = path.join(Target, 'index.html');
	fs.writeFileSync(target, page);
	console.log(`  wrote ${target} (${group(index.packages.length)} packages, ${group(blobs.count)} names, ${group(index.stated.size)} flowR signatures, ${group(index.formals.size)} base R signatures, ${(page.length / 1024 / 1024).toFixed(1)} MB, not committed)`);
}

const Template = fs.readFileSync(path.join('scripts', 'landing-sigdb-template.html'), 'utf8');

void main();
