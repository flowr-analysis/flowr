// Copy the corpus CSVs the type inference reads into dist so they ship with npm; found at runtime by
// `corpusFile` in src/typing/adapter/load-type-signatures.ts.
import fs from 'fs';
import path from 'path';
import { info } from './script-log';

const src = 'src/typing/adapter';
const dst = 'dist/src/typing/adapter';
const files = ['traced-function-types.csv', 'turcotte-types.csv'] as const;

fs.mkdirSync(dst, { recursive: true });
let bytes = 0;
for(const file of files) {
	const from = path.join(src, file), to = path.join(dst, file);
	const fromStat = fs.statSync(from);
	bytes += fromStat.size;
	if(fs.existsSync(to) && fs.statSync(to).mtimeMs >= fromStat.mtimeMs) {
		continue;
	}
	fs.copyFileSync(from, to);
	info(`  typing corpus ${file} (${(fromStat.size / 1e6).toFixed(2)} MB)`);
}
info(`typing corpus: ${files.length} files (${(bytes / 1e6).toFixed(2)} MB) -> ${dst}`);
