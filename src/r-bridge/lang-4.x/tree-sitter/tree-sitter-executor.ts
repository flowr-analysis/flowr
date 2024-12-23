import Parser from 'web-tree-sitter';
import type { RParseRequest } from '../../retriever';
import fs from 'fs';
import type { SyncParser } from '../../parser';
import { getEngineConfig } from '../../../config';

export const DEFAULT_TREE_SITTER_WASM_PATH = `${__dirname}/tree-sitter-r.wasm`;

export class TreeSitterExecutor implements SyncParser<Parser.Tree> {

	public readonly name = 'tree-sitter';
	public readonly parser:  Parser;
	private static language: Parser.Language;

	public static async initTreeSitter(): Promise<void> {
		await Parser.init();
		const path = getEngineConfig('tree-sitter')?.wasmPath ?? DEFAULT_TREE_SITTER_WASM_PATH;
		TreeSitterExecutor.language = await Parser.Language.load(path);
	}

	constructor() {
		this.parser = new Parser();
		this.parser.setLanguage(TreeSitterExecutor.language);
	}

	public rVersion(): Promise<string | 'unknown' | 'none'> {
		return Promise.resolve('none');
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
