/**
 * Recompute the R-core / base-package store from the bundled flowr-sigdb, run automatically when flowR is
 * bundled (see `build:copy-data`). For every base package it records the R-version range it was part of
 * core, so at runtime flowR can list the base packages available at the assumed R version without touching
 * the (large) signature database. Writes `src/data/r-base-packages.generated.ts`.
 *
 * Run: `npx ts-node scripts/gen-base-packages.ts`. A no-op (keeps the committed store) if no bundle is found.
 */
import fs from 'fs';
import path from 'path';
import { SigDatabase, SigDatabaseSet, defaultSigDbPath } from '../src/project/plugins/package-version-plugins/sigdb';
import type { PackageSignatureSource } from '../src/project/plugins/package-version-plugins/sigdb';
import { RVersion } from '../src/util/r-version';

const compareRVersion = (a: string, b: string): number => RVersion.compare(a, b);

async function openDefault(): Promise<PackageSignatureSource | undefined> {
	// FLOWR_SIGDB_BUNDLE lets a maintainer generate the store from a richer bundle (e.g. the full-history dump)
	// that is not shipped inside flowR; without it we use the bundle discovered on flowR's search path
	const src = process.env.FLOWR_SIGDB_BUNDLE || defaultSigDbPath();
	if(!src) {
		return undefined;
	}
	return src.endsWith('.manifest.json') || src.endsWith('.manifest.json.br')
		? SigDatabaseSet.openManifest(src)
		: SigDatabase.open(src);
}

/** bump when the emitted store *format* changes, so a regeneration is forced even if the bundle is unchanged */
const formatVersion = 2;

/** a cheap identity of the bundle (read from the manifest/header, no shard decompression) to detect changes */
function bundleFingerprint(db: PackageSignatureSource): string {
	if(db instanceof SigDatabaseSet) {
		return `${db.manifest.date}|${db.manifest.shards.map(s => s.hash).join(',')}`;
	}
	if(db instanceof SigDatabase) {
		return db.content?.hash ?? db.content?.date ?? '';
	}
	return '';
}

async function main(): Promise<void> {
	const out = path.join(__dirname, '..', 'src', 'data', 'r-base-packages.generated.ts');
	const db = await openDefault();
	if(db === undefined) {
		console.log('gen-base-packages: no bundled sigdb found; keeping the committed store');
		return;
	}
	// skip the (expensive) extraction when neither the bundle nor the emitted format has changed since last time
	const fingerprint = `v${formatVersion}|${bundleFingerprint(db)}`;
	if(fs.existsSync(out)) {
		const existing = fs.readFileSync(out, 'utf8').match(/bundle: (.+)/)?.[1]?.trim();
		if(existing === fingerprint) {
			db.close();
			console.log('gen-base-packages: bundle unchanged; store is up to date');
			return;
		}
	}
	const packages: Record<string, [string, string]> = {};
	let newest = '0.0.0';
	const base = db.packageNames().filter(pkg => db.isBaseR(pkg)).sort();
	for(const pkg of base) {
		const versions = db.coreVersions(pkg);
		if(versions && versions.length > 0) {
			const last = versions[versions.length - 1].str;
			packages[pkg] = [versions[0].str, last];
		}
	}
	for(const [, last] of Object.values(packages)) {
		newest = compareRVersion(last, newest) > 0 ? last : newest;
	}
	// the packages that are part of the newest R release (precomputed so the common case needs no filtering)
	const current = Object.keys(packages).filter(pkg => packages[pkg][1] === newest).sort();
	// the exports of each current base package (each export listed under its first owner, so no name repeats),
	// used to answer base-R qualification (`sd` -> `stats`); grouped by package so a package name is written once
	const claimed = new Set<string>();
	const exportsByPackage: Record<string, string[]> = {};
	let exportCount = 0;
	for(const pkg of current) {   // `current` is sorted, so `base` claims shared names first (first-owner-wins)
		const names: string[] = [];
		for(const name of db.lookup(pkg)?.exported ?? []) {
			if(!claimed.has(name)) {
				claimed.add(name);
				names.push(name);
			}
		}
		exportsByPackage[pkg] = names.sort();
		exportCount += names.length;
	}
	db.close();

	// one line per package: `pkg: ["first", "last"],`
	const packageLines = Object.keys(packages).sort()
		.map(pkg => `\t\t${JSON.stringify(pkg)}: [${JSON.stringify(packages[pkg][0])}, ${JSON.stringify(packages[pkg][1])}],`)
		.join('\n');
	// one block per package: the exports as a single whitespace-separated template literal, 8 per line -- this
	// drops the per-name quotes and commas of a string[] (~13% smaller) while staying greppable and diff-friendly.
	// The loader splits on whitespace on first use. Safe because no base export name contains whitespace, a
	// backtick, or `${` (asserted below).
	const exportLines = current.map(pkg => {
		const names = exportsByPackage[pkg];
		if(names.length === 0) {
			return `\t\t${JSON.stringify(pkg)}: '',`;
		}
		const rows: string[] = [];
		for(let i = 0; i < names.length; i += 8) {
			rows.push('\t\t\t' + names.slice(i, i + 8).join(' '));
		}
		return `\t\t${JSON.stringify(pkg)}: \`\n${rows.join('\n')}\`,`;
	}).join('\n');
	const unsafe = current.flatMap(pkg => exportsByPackage[pkg]).filter(n => /[\s`]/.test(n) || n.includes('${'));
	if(unsafe.length > 0) {
		throw new Error(`export names unsafe for a template literal (contain whitespace/backtick/\${): ${unsafe.slice(0, 5).join(', ')}`);
	}
	const body = '/* eslint-disable */\n'
		+ '/*\n'
		+ ` * GENERATED from the flowr-sigdb bundle by scripts/gen-base-packages.ts on ${new Date().toISOString().slice(0, 10)} -- do not edit.\n`
		+ ` * bundle: ${fingerprint}\n`
		+ ' * newestRVersion: newest R release in the database. current: its base packages. packages: [first, last]\n'
		+ ' * core R-version per package. exportsByPackage: each current base package to its whitespace-separated\n'
		+ ' * exports (inverted to an export -> owning-package lookup on first use, so a package name is not repeated).\n'
		+ ' */\n'
		+ 'export const RBasePackageStore: {\n'
		+ '\treadonly newestRVersion:   string;\n'
		+ '\treadonly current:          readonly string[];\n'
		+ '\treadonly packages:         Readonly<Record<string, readonly [first: string, last: string]>>;\n'
		+ '\treadonly exportsByPackage: Readonly<Record<string, string>>;\n'
		+ '} = {\n'
		+ `\tnewestRVersion: ${JSON.stringify(newest)},\n`
		+ `\tcurrent: [${current.map(n => JSON.stringify(n)).join(', ')}],\n`
		+ '\tpackages: {\n'
		+ packageLines + '\n'
		+ '\t},\n'
		+ '\texportsByPackage: {\n'
		+ exportLines + '\n'
		+ '\t}\n'
		+ '} as const;\n';
	fs.writeFileSync(out, body);
	console.log(`gen-base-packages: wrote ${Object.keys(packages).length} base packages (${current.length} current, ${exportCount} exports) to ${path.relative(process.cwd(), out)}`);
}

void main();
