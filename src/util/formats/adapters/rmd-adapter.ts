import fs from 'fs';
import { type Node , Parser } from 'commonmark';
import matter from 'gray-matter';
import { guard } from '../../assert';
import type { FileAdapter } from '../adapter-format';
import type { RParseRequest, RParseRequestFromText } from '../../../r-bridge/retriever';

export interface CodeBlock {
	options: string,
	code:    string,
}

export type CodeBlockEx = CodeBlock & {
	startpos: { line: number, col: number }
}

export interface RmdInfo {
	type:    'Rmd'
	blocks:  CodeBlock[]
	options: object
}

export const RmdAdapter = {
	convertRequest: (request: RParseRequest) => {
		// Read and Parse Markdown
		const raw = request.request === 'text'
			? request.content
			: fs.readFileSync(request.content, 'utf-8').toString();

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
			request: 'text',
			content: restoreBlocksWithoutMd(blocks, countNewlines(raw)),
			info:    {
				// eslint-disable-next-line unused-imports/no-unused-vars
				blocks:  blocks.map(({ startpos, ...block }) => block),
				options: frontmatter.data,
				type:    'Rmd'
			}
		} as RParseRequestFromText<RmdInfo>;

	}
} satisfies FileAdapter;


const RTagRegex = /{[rR](?:[\s,][^}]*)?}/;
/**
 *
 */
export function isRCodeBlock(node: Node): node is Node & { literal: string, info: string } {
	return node.type === 'code_block' && node.literal !== null && node.info !== null && RTagRegex.test(node.info);
}

const LineRegex = /\r\n|\r|\n/;
function countNewlines(str: string): number {
	return str.split(LineRegex).length - 1;
}

/**
 *
 */
export function restoreBlocksWithoutMd(blocks: CodeBlockEx[], totalLines: number): string {
	let line = 1;
	let output = '';

	const goToLine = (n: number) => {
		const diff = n - line;
		guard(diff >= 0);
		line += diff;
		output += '\n'.repeat(diff);
	};

	for(const block of blocks) {
		goToLine(block.startpos.line);
		output += block.code;
		line += countNewlines(block.code);
	}

	// Add remainder of file
	goToLine(totalLines + 1);

	return output;
}

/**
 *
 */
export function parseCodeBlockOptions(header: string, content: string): string {
	let opts = header.length === 3 // '{r}' => header.length=3 (no options in header)
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