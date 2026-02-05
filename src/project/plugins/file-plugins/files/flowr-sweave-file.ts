import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FileRole, FlowrFile } from '../../../context/flowr-file';
import { guard } from '../../../../util/assert';

/**
 * This decorates a text file and parses its contents as a Sweave (latex with R code) file.
 * Finally, it provides access to the single cells, and all cells fused together as one R file.
 * So far, this does *not* support `\Sexpr` calls.
 */
export class FlowrSweaveFile extends FlowrFile<string> {
	private readonly wrapped: FlowrFileProvider<string>;
	private data?:            SweaveInfo;

	/**
	 * Prefer the static {@link FlowrRMarkdownFile.from} method
	 * @param file - the file to load as R Markdown
	 */
	constructor(file: FlowrFileProvider<string>) {
		super(file.path(), file.roles ? [...file.roles, FileRole.Source] : [FileRole.Source]);
		this.wrapped = file;
	}

	/**
	 * The content of the Sweave file.
	 */
	get rnw(): SweaveInfo {
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
		this.data = parseSweave(this.wrapped.content());
		return this.data.content;
	}

	public static from(file: FlowrFileProvider<string> | FlowrSweaveFile): FlowrSweaveFile {
		return file instanceof FlowrSweaveFile ? file : new FlowrSweaveFile(file);
	}
}

export interface SweaveInfo {
	/**
	 * The R code without the latex code, no-eval blocks, ...
	 */
	content: string;
	/**
	 * All code blocks, including those that should not be evaluated and the latex code.
	 */
	blocks:  SweaveCodeBlock[];
}

interface SweaveBlockBasis {
	type:      'content' | 'reuse';
	startLine: number;
}

export interface SweaveCodeBlockContent extends SweaveBlockBasis {
	type:    'content';
	content: string;
	options: SweaveBlockOptions;
}

export interface SweaveCodeBlockReuse extends SweaveBlockBasis {
	type:  'reuse';
	reuse: string;
}

type SweaveCodeBlock = SweaveCodeBlockContent | SweaveCodeBlockReuse;

export interface SweaveBlockOptions {
	name?: string;
	eval?: boolean;
}

export interface SweaveReuseOptions {
	reuse: string;
}


const CodeBlockStartPattern = /^<<([^>]*)>>(?<reuse>=)?/;
const ReusePattern = /^<<([^>]*)>>/;
/**
 * Parse a Sweave file into joined content and blocks
 * @param raw - raw contents of file
 * @returns Joined Content and Blocks
 */
export function parseSweave(raw: string): SweaveInfo {
	const lines = raw.split(/\r?\n/);
	const blocks: SweaveCodeBlock[] = [];
	let currentBlock: SweaveCodeBlockContent | undefined = undefined;

	let lineNum = 0;
	for(const line of lines) {
		lineNum++;
		if(currentBlock) { // Inside Code Block
			if(isEndOfCodeBlock(line)) {
				// drop the last '\n' and push the block
				if(currentBlock.content.endsWith('\n')) {
					currentBlock.content = currentBlock.content.slice(0, -1);
				}
				blocks.push(currentBlock);
				currentBlock = undefined;
				continue;
			} else {
				const reuseMatch = line.match(ReusePattern);
				if(reuseMatch) {
					// we found a reuse inside a code block, we inline the content!
					const reuseName = reuseMatch[1].trim();
					const reuseBlock = blocks.find(b => 'options' in b && b.options.name === reuseName);
					if(reuseBlock && 'options' in reuseBlock) {
						currentBlock.content += reuseBlock.content + '\n';
					}
					continue;
				}
			}
			currentBlock.content += line + '\n';
		} else { // Latex Code / Outside Code Block
			const result = parseSweaveCodeblockStart(line);
			if(result) {
				if('reuse' in result) {
					blocks.push({ type: 'reuse', reuse: result.reuse, startLine: lineNum });
					continue;
				}
				currentBlock = {
					type:      'content',
					options:   result,
					content:   '',
					startLine: lineNum
				};
			}
		}
	}

	const content: string[] = [];
	for(const block of blocks) {
		// add empty lines until startline is met; the start line is still exclusive!
		while(content.length < block.startLine) {
			content.push('');
		}
		if('reuse' in block) {
			const reuseBlock = blocks.find(b => 'options' in b && b.options.name === block.reuse);
			if(reuseBlock && 'options' in reuseBlock) {
				content.push(...reuseBlock.content.split('\n'));
			}
		} else if(block.options.eval !== false) {
			content.push(...block.content.split('\n'));
		}
	}

	return {
		content: content.join('\n'),
		blocks:  blocks
	};
}

const evalWithFlagPattern = /eval\s*=\s*(TRUE|FALSE)/i;

/**
 * Parses a Sweave Code Block Start if it can find one
 * @param line - the line to ParserState
 * @returns info about options and name if code block start was found
 */
export function parseSweaveCodeblockStart(line: string): SweaveBlockOptions | SweaveReuseOptions | undefined {
	const match = line.match(CodeBlockStartPattern);

	if(match) {
		// No options provided (i.e <<>>=)
		if(match[1] === '') {
			return {};
		}

		const options = match[1].split(',');

		let name = undefined;
		let evalOpt = undefined;

		// The first option can have no key and is then interpreted as the label of the block
		if(!options[0].includes('=')) {
			name = options[0];
		}

		if(match.groups?.reuse === undefined) {
			// this reuses!
			return name ? { reuse: name } : {};
		}

		// Search for eval option
		for(let i = name ? 1 : 0; i < options.length; i++) {
			const opt = options[i].trim();
			const evalMatch = opt.match(evalWithFlagPattern);
			if(evalMatch) {
				evalOpt = evalMatch[1].toUpperCase() === 'TRUE';
			}
		}

		return {
			name, eval: evalOpt
		};
	}

	return undefined;
}

function isEndOfCodeBlock(line: string): boolean {
	return line.startsWith('@');
}
