/**
 * Stages the built library in `dist/src`, which is what `publish-library` and `pack-library` pack from.
 *
 * The package's root is `dist/src`, so `main` and `types` cannot read the same in both places: the repository's
 * own manifest points into the build (`dist/src/index.js`), and a consumer of the package needs that same file
 * named from the package root (`index.js`). This writes the staged manifest with the prefix taken off, and
 * leaves out what only the repository has any use for.
 * @module
 */
import fs from 'fs';
import path from 'path';
import { guard } from '../src/util/assert';

/** where the build puts the library, and with it the root of the published package */
const Staged = path.join('dist', 'src');

/** copied beside the manifest: what a consumer reads, and what decides the tarball's contents */
const Alongside = ['.npmignore', 'README.md', 'LICENSE'];

/** the manifest fields that only say something to someone working on flowR itself */
const RepositoryOnly = new Set(['scripts', 'devDependencies', 'release-it', 'typedocOptions', 'allowScripts']);

/** The manifest as the package needs it: entry points named from the package root, tooling fields dropped. */
function stagedManifest(): string {
	const manifest = JSON.parse(fs.readFileSync('package.json', 'utf-8')) as Record<string, unknown> & { main?: string, types?: string };
	const fromPackageRoot = (field: 'main' | 'types') => {
		const value = manifest[field];
		if(value === undefined) {
			return;
		}
		const prefix = `${Staged.replaceAll(path.sep, '/')}/`;
		guard(value.startsWith(prefix), `package.json "${field}" has to point into ${prefix}, got "${value}"`);
		manifest[field] = value.slice(prefix.length);
	};
	fromPackageRoot('main');
	fromPackageRoot('types');
	const kept = Object.fromEntries(Object.entries(manifest).filter(([field]) => !RepositoryOnly.has(field)));
	return JSON.stringify(kept, null, 2) + '\n';
}

function main(): void {
	guard(fs.existsSync(path.join(Staged, 'index.js')), `${Staged}/index.js is missing, run \`npm run build\` first`);
	for(const file of Alongside) {
		fs.copyFileSync(file, path.join(Staged, file));
	}
	fs.writeFileSync(path.join(Staged, 'package.json'), stagedManifest());
	console.log(`  staged ${Staged} (${Alongside.join(', ')}, package.json)`);
}

main();
