import type { FileAdapter } from '../adapter-format';
import fs from 'fs';
import { Parser } from 'commonmark';
import matter from 'gray-matter';
import { guard } from '../../assert';

export interface CodeBlock {
	options: string,
	code:    string,
}

type CodeBlockEx = CodeBlock & {
	startpos: { line: number, col: number }
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
		const blocks: CodeBlockEx[] = [];
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
					code:     node.literal,
					options:  parseOptions(node.info, node.literal),
					startpos: { line: node.sourcepos[0][0] + 1, col: 0 }
				});
			} 
			// else if(node.type === 'code') {
			// 	if(node.literal && node.literal.startsWith('r ')) {
			// 		blocks.push({
			// 			code:     node.literal.substring(2),
			// 			options:  '',
			// 			startpos: { line: node.sourcepos[0][0], col: node.sourcepos[0][1] }
			// 		});
			// 	}
			// }
		}

		return {
			type:    '.Rmd',
			code:    restoreBlocksWithoutMd(blocks),
			// eslint-disable-next-line unused-imports/no-unused-vars
			blocks:  blocks.map(({ startpos, ...block }) => block), 
			options: frontmatter.data
		} as RmdInfo;
	}
} as FileAdapter<RmdInfo>;


function restoreBlocksWithoutMd(blocks: CodeBlockEx[]): string {
	let line = 1;
	let output = '';


	const goToLine = (n: number) => {
		const diff = n - line;
		guard(diff >= 0);
		line += diff;
		output += '\n'.repeat(diff);
	};


	const countNewlines = (str: string) => {
		return str.split(/\r\n|\r|\n/).length - 1;
	};


	for(const block of blocks) {
		goToLine(block.startpos.line);
		output += block.code;
		line += countNewlines(block.code);
	}

	return output;	
}

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