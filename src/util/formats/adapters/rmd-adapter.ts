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

export const RmdAdapter = {
	readFile: (p: string) => {
		// Read and Parse Markdown
		const raw = fs.readFileSync(p, 'utf-8').toString();
		const parser = new Parser();
		const ast = parser.parse(raw);
		
		// Parse Frontmatter
		const frontmatter = matter(raw);

		// Parse Codeblocks
		const walker = ast.walker();
		const blocks: CodeBlock[] = [];
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
					code:    node.literal,
					options: parseOptions(node.info, node.literal)
				});
			} else if(node.type === 'code') {
				if(node.literal && node.literal.startsWith('r ')) {
					blocks.push({
						code:    node.literal.substring(2),
						options: ''
					});
				}
			}
		}

		return {
			type:    '.Rmd',
			code:    blocks.map(b => b.code).join('\n'),
			blocks:  blocks,
			options: frontmatter.data
		};
	}
} as FileAdapter<RmdInfo>;


function parseOptions(header: string, content: string): string {
	let opts = header.length === 3 
		? '' 
		: header.substring(3, header.length-1).trim();
	
	const lines = content.split('\n');
	for(const line of lines) {
		if(!line.trim().startsWith('#|')) {
			break;
		}

		const opt = line.substring(3);

		opts += opts.length === 0 ? `${opt}` : `, ${opt}`;
	}	

	return opts;
}