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
import { fillVersion, versionMarker } from './version-marker';

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

const SiteUrl = 'https://flowr-analysis.github.io/flowr';
const Target = path.join('wiki', 'sigdb');

const group = (n: number): string => n.toLocaleString('en-US');

/**
 * The OpenSearch description, used by browsers to offer the page as a search engine
 */
const OpenSearchDescription = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
	<ShortName>flowR sigdb</ShortName>
	<Description>Search the R functions flowR knows across base R and CRAN packages.</Description>
	<InputEncoding>UTF-8</InputEncoding>
	<!-- browsers pick the first image they can draw, and most of them will not take an svg for this -->
	<Image height="16" width="16" type="image/png">${SiteUrl}/wiki/img/flowR-mark-red-16.png</Image>
	<Image height="32" width="32" type="image/png">${SiteUrl}/wiki/img/flowR-mark-red-32.png</Image>
	<Image height="16" width="16" type="image/svg+xml">${SiteUrl}/wiki/img/flowR-mark-red.svg</Image>
	<Url type="text/html" method="get" template="${SiteUrl}/wiki/sigdb/?q={searchTerms}"/>
	<Url type="application/opensearchdescription+xml" rel="self" template="${SiteUrl}/wiki/sigdb/opensearch.xml"/>
</OpenSearchDescription>
`;

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
	const page = fillVersion(Template, versionMarker())
		.replaceAll('<!--UPDATED-->', index.updated)
		.replaceAll('<!--PACKAGES-->', group(index.packages.length))
		.replaceAll('<!--FUNCTIONS-->', group(blobs.count))
		.replace('<!--RANKER-->', await ranker())
		.replace('"<!--KINDS-->"', kinds)
		.replace('"<!--STATED-->"', stated)
		.replace('"<!--FORMALS-->"', JSON.stringify(Object.fromEntries(index.formals)).replaceAll('</', '<\\/'))
		.replace('"<!--TOPICS-->"', JSON.stringify(Object.fromEntries(index.topics)).replaceAll('</', '<\\/'))
		.replace('<!--DATA-->', pack(blobs.packages, blobs.names));

	fs.mkdirSync(Target, { recursive: true });
	const target = path.join(Target, 'index.html');
	fs.writeFileSync(target, page);
	console.log(`  wrote ${target} (${group(index.packages.length)} packages, ${group(blobs.count)} names, ${group(index.stated.size)} flowR signatures, ${group(index.formals.size)} base R signatures, ${(page.length / 1024 / 1024).toFixed(1)} MB, not committed)`);

	const descriptionTarget = path.join(Target, 'opensearch.xml');
	fs.writeFileSync(descriptionTarget, OpenSearchDescription);
	console.log(`  wrote ${descriptionTarget}`);
}

const Template = fs.readFileSync(path.join('scripts', 'landing-sigdb-template.html'), 'utf8');

void main();
