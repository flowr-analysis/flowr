// Requires every compiled module of dist/src as the first one of a fresh module cache, as a library user may do,
// and fails if one throws while loading (typically an import cycle that reads a half-initialized module at load time).
// Run `npm run build` first.
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../dist/src');
/* programs that start on import */
const Entries = [/^cli\/.*-app\.js$/, /^cli\/flowr\.js$/, /\.min\.js$/, /^taint-analysis\/eval\/eval\.js$/];

function modules(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? modules(full) : e.name.endsWith('.js') ? [full] : [];
	});
}

if(!fs.existsSync(root)) {
	console.error('check-standalone-load: dist/src is missing, run `npm run build` first');
	process.exit(1);
}
const failures: string[] = [];
const files = modules(root).map(f => path.relative(root, f).replaceAll('\\', '/')).filter(f => !Entries.some(e => e.test(f)));
for(const file of files) {
	for(const key of Object.keys(require.cache)) {
		if(key.startsWith(root)) {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete require.cache[key];
		}
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require(path.join(root, file));
	} catch(e) {
		const frame = (e as Error).stack?.split('\n').find(l => l.includes(root))?.trim() ?? '';
		failures.push(`${file}: ${(e as Error).message.split('\n')[0]} ${frame}`);
	}
}
if(failures.length > 0) {
	console.error(`check-standalone-load: ${failures.length} of ${files.length} modules fail when loaded first:\n${failures.join('\n')}`);
	process.exit(1);
}
console.log(`check-standalone-load: all ${files.length} modules load standalone`);
