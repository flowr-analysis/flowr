import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';
import { guard } from '../../../../util/assert';
import { type Node, Parser } from 'commonmark';
import type { GrayMatterFile } from 'gray-matter';
import matter from 'gray-matter';
import { log } from '../../../../util/log';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import { findSource } from '../../../../dataflow/internal/process/functions/call/built-in/built-in-source';

/**
 * This decorates a text file and parses its contents as a R Markdown file.
 * Finally, it provides access to the single cells, and all cells fused together as one R file.
 */
export class FlowrRMarkdownFile extends FlowrFile<string> {
	private data?:       RmdInfo;
	private mergedCode?: string;

	private readonly wrapped: FlowrFileProvider<string>;
	private readonly context: FlowrAnalyzerContext;

	/**
	 * Prefer the static {@link FlowrRMarkdownFile.from} method
	 * @param file - the file to load as R Markdown
	 */
	constructor(file: FlowrFileProvider<string>, ctx: FlowrAnalyzerContext) {
		super(file.path(), file.roles ? [...file.roles, FileRole.Source] : [FileRole.Source]);
		this.wrapped = file;
		this.context = ctx;
	}

	/**
	 * Gets the parsed R Markdown information
	 */
	get rmd(): RmdInfo {
		if(!this.data) {
			this.loadContent();
		}
		guard(this.data !== undefined);
		return this.data;
	}

	/**
	 * Loads and parses the content of the wrapped file.
	 * @returns RmdInfo
	 */
	protected loadContent(): string {
		const raw = this.wrapped.content();
		this.data = parseRMarkdownFile(raw);
		this.postProcessCodeBlocks();
		this.mergedCode = restoreBlocksWithoutMd(this.data.blocks, countNewlines(raw));
		guard(this.mergedCode !== undefined);
		return this.mergedCode;
	}

	/**
 	* Postprocess blocks with options like child='other.Rmd'
  */
	private postProcessCodeBlocks() {
		guard(this.data !== undefined);

		for(const block of this.data.blocks) {
			const childOpt = block.options.get('child');
			if(childOpt === undefined) {
				continue;
			}

			const childPath = findSource(this.context.config.solver.resolveSource, childOpt, {
				ctx:            this.context,
				referenceChain: [this.path()]
			});

			if(childPath === undefined) {
				continue;
			}

			if(childPath.length > 1) {
				log.warn(`Found more than one path for child '${childOpt}' in rmd file '${this.path()}'. Only using the first path: '${childPath[0]}'`);
			}

			this.context.files.resolveRequest({
				request: 'file',
				content: childPath[0]
			});

			const rawChildFile = this.context.files.getFileByPath(childPath[0]) as FlowrFileProvider<string>;
			if(rawChildFile !== undefined) {
				block.code = FlowrRMarkdownFile.from(rawChildFile, this.context).content();
			} else {
				log.warn(`Child file '${childPath[0]}' of '${this.path()}' did not load as RMD.`);
			}
		}
	}

	public static from(file: FlowrFileProvider<string> | FlowrRMarkdownFile, ctx: FlowrAnalyzerContext): FlowrRMarkdownFile {
		return file instanceof FlowrRMarkdownFile ? file : new FlowrRMarkdownFile(file, ctx);
	}
}

export type CodeBlockOptions = Map<string, string>;

export interface CodeBlock {
	options:  CodeBlockOptions,
	code:     string,
	startpos: { line: number, col: number }
}

export interface RmdInfo {
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
	let frontmatter: GrayMatterFile<string> | undefined;
	try {
		frontmatter = matter(raw);
	} catch(e) {
		log.warn(`Failed to parse frontmatter of Rmd file, ignoring it. Error was: ${JSON.stringify(e)}`);
		frontmatter = undefined;
	}


	// Parse Codeblocks
	const walker = ast.walker();
	const blocks: CodeBlock[] = [];
	let e;
	while((e = walker.next())) {
		const node = e.node;
		if(!isRCodeBlock(node)) {
			continue;
		}

		const options = parseCodeBlockOptions(node.info, node.literal);
		const engineOpt = options.get('engine');
		if(engineOpt !== undefined && engineOpt.trim().toLowerCase() !== 'r') {
			continue;
		}

		blocks.push({
			code:     node.literal,
			options:  options,
			startpos: { line: node.sourcepos[0][0] + 1, col: 0 }
		});
	}

	return {
		blocks:  blocks,
		options: frontmatter?.data ?? {}
	};
}

// We need the [\s,] part, otherwise {rust} would also match
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
export function restoreBlocksWithoutMd(blocks: readonly CodeBlock[], totalLines: number): string {
	let line = 1;
	let output = '';

	const goToLine = (n: number) => {
		const diff = Math.max(n - line, 0);
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

const OptionsRegex = /([\w_.-]*)\s*[:=]\s*["']?([^,"']*)/g;

/**
 * Parses the options of an R code block from its header and content
 */
export function parseCodeBlockOptions(header: string, content: string): CodeBlockOptions {
	let opts = header.length === 3 // '{r}' => header.length=3 (no options in header)
		? ''
		: header.substring(3, header.length - 1).trim();

	const lines = content.split('\n');
	for(const line of lines) {
		if(!line.trim().startsWith('#|')) {
			break;
		}

		const opt = line.substring(2).trim();

		opts += opts.length === 0 ? opt : `, ${opt}`;
	}

	const parsedOptions = new Map<string, string>();
	for(const match of opts.matchAll(OptionsRegex)) {
		if(match[1] && match[2] !== undefined) { // key must not be empty, but value can be empty string for example
			parsedOptions.set(match[1], match[2]);
		}
	}

	return parsedOptions;
}
