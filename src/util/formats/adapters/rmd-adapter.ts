import type { FileAdapter } from '../adapter-format';
import fs from 'fs';
import { Parser } from 'commonmark';
import matter from 'gray-matter';

export interface CodeBlock {
	options: string,
	code:    string
}

export interface RmdInfo {
	blocks:  CodeBlock[]
	options: object
}

// TODO: Also parse inline code 
// TODO: Parse Options
// TODO: Parse InBody Options

export const RmdAdapter = {
	readFile: (p: string) => {
		const raw = fs.readFileSync(p).toString();
		const parser = new Parser();
		const ast = parser.parse(raw);
		
		const frontmatter = matter(raw);

		const blocks: CodeBlock[] = [];
	
		const walker = ast.walker();
		let e;
		while((e = walker.next())) {
			const node = e.node;
			if(node.type === 'code_block') {
				if(!node.info || 
				   !node.literal ||
				   !node.info.startsWith('{r') || 
				   !node.info.endsWith('}')) {
					continue;
				}

				blocks.push({
					code:    node.literal ?? '',
					options: node.info ?? ''
				});
			}
		}

		return {
			type:    '.Rmd',
			code:    blocks.map(b => b.code).join(),
			blocks:  blocks,
			options: frontmatter.data
		};
	}
} as FileAdapter<RmdInfo>;
