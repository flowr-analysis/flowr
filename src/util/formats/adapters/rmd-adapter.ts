import type { FileAdapter } from '../adapter-format';
import fs from 'fs';
import type { Node } from 'commonmark';
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
			if(!isRCodeBlock(node)) {
				continue;
			}
				
			blocks.push({
				code:     node.literal,
				options:  parseCodeBlockOptions(node.info, node.literal),
				startpos: { line: node.sourcepos[0][0] + 1, col: 0 }
			});
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


const RTagRegex = /{[rR](?:[\s,][^}]*)?}/;
export function isRCodeBlock(node: Node): node is Node & { literal: string, info: string } {
	return node.type === 'code_block' && node.literal !== null && node.info !== null && RTagRegex.test(node.info);
}

const LineRegex = /\r\n|\r|\n/;
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
		return str.split(LineRegex).length - 1;
	};


	for(const block of blocks) {
		goToLine(block.startpos.line);
		output += block.code;
		line += countNewlines(block.code);
	}

	return output;	
}

export function parseCodeBlockOptions(header: string, content: string): string {
	let opts = header.length === 3 
		? '' 
		: header.substring(3, header.length-1).trim();
	
	const lines = content.split('\n');
	for(const line of lines) {
		if(!line.trim().startsWith('#|')) {
			break;
		}

		const opt = line.substring(3);

		opts += opts.length === 0 ? opt : `, ${opt}`;
	}	

	return opts;
}