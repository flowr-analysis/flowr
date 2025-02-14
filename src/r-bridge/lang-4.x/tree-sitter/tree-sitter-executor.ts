import Parser from 'web-tree-sitter';
import type { RParseRequest } from '../../retriever';
import fs from 'fs';
import type { SyncParser } from '../../parser';
import { getEngineConfig } from '../../../config';

export const DEFAULT_TREE_SITTER_R_WASM_PATH = `${__dirname}/tree-sitter-r.wasm`;
export const DEFAULT_TREE_SITTER_WASM_PATH = `${__dirname}/tree-sitter.wasm`;

/**
 * Synchronous and (way) faster alternative to the {@link RShell} using tree-sitter.
 */
export class TreeSitterExecutor implements SyncParser<Parser.Tree> {

	public readonly name = 'tree-sitter';
	public readonly parser:  Parser;
	private static language: Parser.Language;

	public static async initTreeSitter(): Promise<void> {
		const config = getEngineConfig('tree-sitter');
		const treeSitterWasmPath = config?.treeSitterWasmPath ?? DEFAULT_TREE_SITTER_WASM_PATH;
		// noinspection JSUnusedGlobalSymbols - this is used by emscripten, see https://emscripten.org/docs/api_reference/module.html
		await Parser.init({
			locateFile: (path: string, prefix: string) => {
				// allow setting a custom path for the tree sitter wasm file
				if(path.endsWith('tree-sitter.wasm')) {
					return treeSitterWasmPath;
				}
				return prefix + path;
			}
		});
		const wasmPath = config?.wasmPath ?? DEFAULT_TREE_SITTER_R_WASM_PATH;
		TreeSitterExecutor.language = await Parser.Language.load(wasmPath);
	}

	constructor() {
		this.parser = new Parser();
		this.parser.setLanguage(TreeSitterExecutor.language);
	}

	public rVersion(): Promise<string | 'unknown' | 'none'> {
		return Promise.resolve('none');
	}

	public treeSitterVersion(): number {
		return this.parser.getLanguage().version;
	}

	public parse(request: RParseRequest): Parser.Tree {
		let sourceCode: string;
		if(request.request === 'file' ){
			sourceCode = fs.readFileSync(request.content, 'utf8');
		} else {
			sourceCode = request.content;
		}
		return this.parser.parse(sourceCode);
	}

	public close(): void {
		this.parser.delete();
	}
}
