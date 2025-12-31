import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';
import { guard } from '../../../../util/assert';
import { type Node , Parser } from 'commonmark';
import matter from 'gray-matter';

/**
 * This decorates a text file and parses its contents as a R Markdown file.
 * Finnaly, it provides access to the single cells, and all cells fused together as one R file.
 */
export class FlowrRMarkdownFile extends FlowrFile<string> {
	private data?:            RmdInfo;
	private readonly wrapped: FlowrFileProvider<string>;

	/**
	 * Prefer the static {@link FlowrRMarkdownFile.from} method
	 * @param file - the file to load as R Markdown
	 */
	constructor(file: FlowrFileProvider<string>) {
		super(file.path(), [FileRole.Source]);
		this.wrapped = file;
	}

	get rmd(): RmdInfo {
		if(!this.data) {
			this.loadContent();
		}
		guard(this.data);
		return this.data;
	}

	/**
	 * Loads and parses the content of the wrapped file.
	 * @returns RmdInfo
	 */
	protected loadContent(): string {
		this.data = parseRMarkdownFile(this.wrapped.content());
		return this.data.content;
	}

	public static from(file: FlowrFileProvider<string> | FlowrRMarkdownFile): FlowrRMarkdownFile {
		return file instanceof FlowrRMarkdownFile ? file : new FlowrRMarkdownFile(file);
	}
}

export interface CodeBlock {
	options: string,
	code:    string,
}

export type CodeBlockEx = CodeBlock & {
	startpos: { line: number, col: number }
}

export interface RmdInfo {
	content: string
	blocks:  CodeBlock[]
	options: object
}

/**
 * Parse the contents of a RMarkdown file into complete code and blocks
 * @param raw - the raw file content
 * @returns Rmd Info
 */
export function parseRMarkdownFile(raw: string): RmdInfo {
	// Read and Parse Markdown
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
		content: restoreBlocksWithoutMd(blocks, countNewlines(raw)),
		// eslint-disable-next-line unused-imports/no-unused-vars
		blocks:  blocks.map(({ startpos, ...block }) => block),
		options: frontmatter.data
	};
}

const RTagRegex = /{[rR](?:[\s,][^}]*)?}/;

/**
 * Checks whether a CommonMark node is an R code block
 */
export function isRCodeBlock(node: Node): node is Node & { literal: string, info: string } {
	return node.type === 'code_block' && node.literal !== null && node.info !== null && RTagRegex.test(node.info);
}

const LineRegex = /\r\n|\r|\n/;
function countNewlines(str: string): number {
	return str.split(LineRegex).length - 1;
}

/**
 * Restores an Rmd file from code blocks, filling non-code lines with empty lines
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
 * Parses the options of an R code block from its header and content
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
