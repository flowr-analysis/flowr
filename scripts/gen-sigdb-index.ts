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
import { encode, pack, readSigIndex } from './sigdb-index';

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
	const page = Template
		.replaceAll('<!--UPDATED-->', index.updated)
		.replaceAll('<!--PACKAGES-->', group(index.packages.length))
		.replaceAll('<!--FUNCTIONS-->', group(blobs.count))
		.replace('"<!--KINDS-->"', kinds)
		.replace('<!--DATA-->', pack(blobs.packages, blobs.names));

	fs.mkdirSync(Target, { recursive: true });
	const target = path.join(Target, 'index.html');
	fs.writeFileSync(target, page);
	console.log(`  wrote ${target} (${group(index.packages.length)} packages, ${group(blobs.count)} names, ${(page.length / 1024 / 1024).toFixed(1)} MB, not committed)`);
}

const Template = fs.readFileSync(path.join('scripts', 'landing-sigdb-template.html'), 'utf8');

void main();
