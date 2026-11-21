// Copy the tree-sitter wasm binaries into dist so they ship with npm and are found at runtime.
import fs from 'fs';
import path from 'path';
import { info } from './script-log';

const files = [
	['node_modules/@davisvaughan/tree-sitter-r/tree-sitter-r.wasm', 'dist/node_modules/@davisvaughan/tree-sitter-r/tree-sitter-r.wasm'],
	['node_modules/web-tree-sitter/tree-sitter.wasm',               'dist/node_modules/web-tree-sitter/tree-sitter.wasm']
] as const;

for(const [from, to] of files) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(from, to);
	info(`  copied ${from} -> ${to}`);
}
