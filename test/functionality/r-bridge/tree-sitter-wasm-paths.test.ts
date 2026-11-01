import { assert, describe, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
	DEFAULT_TREE_SITTER_R_WASM_PATH,
	DEFAULT_TREE_SITTER_WASM_PATH
} from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

describe('Tree-sitter wasm default paths', () => {
	for(const [name, wasm] of [['tree-sitter-r', DEFAULT_TREE_SITTER_R_WASM_PATH], ['tree-sitter', DEFAULT_TREE_SITTER_WASM_PATH]]) {
		test(`${name} does not depend on the working directory`, () => {
			assert.isTrue(path.isAbsolute(wasm), `${wasm} is relative`);
			assert.isTrue(fs.existsSync(wasm), `${wasm} does not exist`);
		});
	}
});
