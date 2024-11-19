import type { Language, Tree } from 'web-tree-sitter';
import Parser from 'web-tree-sitter';
import type { RParseRequest } from '../../retriever';
import { guard } from '../../../util/assert';
import fs from 'fs';

export class TreeSitterExecutor {

	private static language: Language;
	private parser:          Parser | undefined;

	public async init(): Promise<void> {
		if(!TreeSitterExecutor.language) {
			await Parser.init();
			TreeSitterExecutor.language = await Parser.Language.load(`${__dirname}/tree-sitter-r.wasm`);
		}
		this.parser = new Parser();
		this.parser.setLanguage(TreeSitterExecutor.language);
	}

	public parse(request: RParseRequest): Tree {
		guard(this.parser !== undefined, 'Parser not initialized');

		let sourceCode: string;
		if(request.request === 'file' ){
			// TODO should we be using fs here?
			// TODO what base path should this be based on (pass one like in RShell?)
			sourceCode = fs.readFileSync(request.content, 'utf8');
		} else {
			sourceCode = request.content;
		}

		return this.parser.parse(sourceCode);
	}
}
