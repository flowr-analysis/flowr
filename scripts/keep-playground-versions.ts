/**
 * Keeps the playgrounds of the last releases next to the current one, under `wiki/playground/v/<version>/`, which the
 * playground offers to switch to. Each is the self-contained page of its release (a few megabytes, loaded only when
 * opened), taken from the site before it is replaced. Usage: `ts-node scripts/keep-playground-versions.ts <previous>`,
 * with `<previous>` the `wiki/playground` folder the site served so far.
 */
import fs from 'fs';
import path from 'path';
import semver from 'semver';

const Target = path.join('wiki', 'playground');
const Keep = 4;

/** the release a playground page was built from, as its version link names it */
const releaseOf = (dir: string): string | undefined =>
	/data-release="v?([^"]+)"/.exec(fs.existsSync(path.join(dir, 'index.html')) ? fs.readFileSync(path.join(dir, 'index.html'), 'utf8') : '')?.[1];

const previous = process.argv[2];
const current = releaseOf(Target);
const found = new Map<string, string>();
if(previous !== undefined && fs.existsSync(previous)) {
	for(const version of fs.existsSync(path.join(previous, 'v')) ? fs.readdirSync(path.join(previous, 'v')) : []) {
		found.set(version, path.join(previous, 'v', version));
	}
	const release = releaseOf(previous);
	if(release !== undefined) {
		found.set(release, previous);
	}
}
const kept = [...found.keys()].filter(v => v !== current && semver.valid(v) !== null).sort(semver.rcompare).slice(0, Keep);
for(const version of kept) {
	fs.cpSync(found.get(version) as string, path.join(Target, 'v', version), { recursive: true, filter: from => path.relative(found.get(version) as string, from) !== 'v' });
}
fs.mkdirSync(path.join(Target, 'v'), { recursive: true });
fs.writeFileSync(path.join(Target, 'v', 'index.json'), JSON.stringify(kept));
console.log(`  kept the playgrounds of ${kept.length > 0 ? kept.join(', ') : 'no earlier release'}`);
