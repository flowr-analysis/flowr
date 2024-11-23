import Parser from 'web-tree-sitter';
import type { RParseRequest } from '../../retriever';
import fs from 'fs';
import type { SyncParser } from '../../parser';

export class TreeSitterExecutor implements SyncParser<Parser.Tree> {

	public readonly parser:  Parser;
	private static language: Parser.Language;

	public static async initTreeSitter(): Promise<void> {
		await Parser.init();
		// TODO pass config variable to specify where the wasm is
		TreeSitterExecutor.language = await Parser.Language.load(`${__dirname}/tree-sitter-r.wasm`);
	}

	constructor() {
		this.parser = new Parser();
		this.parser.setLanguage(TreeSitterExecutor.language);
	}

	public parse(request: RParseRequest): Parser.Tree {
		let sourceCode: string;
		if(request.request === 'file' ){
			// TODO what base path should this be based on (pass one like in RShell?)
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
