import Parser from 'web-tree-sitter';

import type { RParseRequest } from '../../retriever';
import fs from 'fs';
import type { SyncParser } from '../../parser';
import type { TreeSitterEngineConfig } from '../../../config';
import { log } from '../../../util/log';

export const DEFAULT_TREE_SITTER_R_WASM_PATH = './node_modules/@eagleoutice/tree-sitter-r/tree-sitter-r.wasm';
export const DEFAULT_TREE_SITTER_WASM_PATH = './node_modules/web-tree-sitter/tree-sitter.wasm';

const wasmLog = log.getSubLogger({ name: 'tree-sitter-wasm' });

/**
 * Synchronous and (way) faster alternative to the {@link RShell} using tree-sitter.
 */
export class TreeSitterExecutor implements SyncParser<Parser.Tree> {

	public readonly name = 'tree-sitter';
	public readonly parser:  Parser;
	private static language: Parser.Language;

	/**
	 * Initializes the underlying tree-sitter parser. This only needs to be called once globally.
	 * @param config - The configuration for the tree-sitter engine, which can include paths to the wasm files.
	 * @param overrideWasmPath - The path to the tree-sitter-r wasm file, which takes precedence over the config and default paths if set.
	 * @param overrideTreeSitterWasmPath - The path to the tree-sitter wasm file, which takes precedence over the config and default paths if set.
	 */
	public static async initTreeSitter(config?: TreeSitterEngineConfig, overrideWasmPath?: string, overrideTreeSitterWasmPath?: string): Promise<void> {
		const treeSitterWasmPath = overrideTreeSitterWasmPath ?? config?.treeSitterWasmPath ?? DEFAULT_TREE_SITTER_WASM_PATH;
		// noinspection JSUnusedGlobalSymbols - this is used by emscripten, see https://emscripten.org/docs/api_reference/module.html
		await Parser.init({
			locateFile: treeSitterWasmPath ? (path: string, prefix: string) => {
				// allow setting a custom path for the tree sitter wasm file
				if(path.endsWith('tree-sitter.wasm')) {
					return treeSitterWasmPath;
				}
				return prefix + path;
			} : undefined,
			onAbort:  (s: string | number) => wasmLog.error(`Tree-sitter wasm aborted: ${s}`),
			print:    (s: string) => wasmLog.debug(s),
			printErr: (s: string) => wasmLog.error(s)
		});
		const wasmPath = overrideWasmPath ?? config?.wasmPath ?? DEFAULT_TREE_SITTER_R_WASM_PATH;
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
