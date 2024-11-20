import TreeSitter from 'web-tree-sitter';
import type { RParseRequest } from '../../retriever';
import fs from 'fs';

export class TreeSitterExecutor {

	private static language: TreeSitter.Language;
	private readonly parser: TreeSitter;

	public static async initTreeSitter(): Promise<void> {
		await TreeSitter.init();
		// TODO pass config variable to specify where the wasm is
		TreeSitterExecutor.language = await TreeSitter.Language.load(`${__dirname}/tree-sitter-r.wasm`);
	}

	constructor() {
		this.parser = new TreeSitter();
		this.parser.setLanguage(TreeSitterExecutor.language);
	}

	public parse(request: RParseRequest): TreeSitter.Tree {
		let sourceCode: string;
		if(request.request === 'file' ){
			// TODO what base path should this be based on (pass one like in RShell?)
			sourceCode = fs.readFileSync(request.content, 'utf8');
		} else {
			sourceCode = request.content;
		}
		return this.parser.parse(sourceCode);
	}
}
