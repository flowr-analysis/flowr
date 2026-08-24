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
 * This decorates a text file and parses its contents as an R Markdown file.
 * Finally, it provides access to the single cells, and all cells fused together as one R file.
 */
export class FlowrRMarkdownFile extends FlowrFile {
	private data?:       RmdInfo;
	private mergedCode?: string;

	private readonly wrapped:  FlowrFileProvider<string>;
	private readonly context:  FlowrAnalyzerContext;
	private readonly included: string[] = [];

	/**
	 * Prefer the static {@link FlowrRMarkdownFile.from} method
	 * @param file - the file to load as R Markdown
	 * @param ctx  - the analyzer context the chunks are read with
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

	get executableCells(): CodeBlock[] {
		const defaults = globalChunkOptions(this.rmd.options);
		return this.rmd.blocks.filter(b => isExecutableCell(b, defaults));
	}

	/**
	 * Loads and parses the content of the wrapped file.
	 * @returns RmdInfo
	 */
	protected loadContent(): string {
		const raw = this.wrapped.content();
		this.data = parseRMarkdownFile(raw);
		this.postProcessCodeBlocks();
		const defaults = globalChunkOptions(this.data.options);
		this.mergedCode = restoreBlocksWithoutMd(
			this.executableCells.map(b => continuesAfterError(b, defaults) ? { ...b, code: wrapErrorTolerant(b.code) } : b),
			countNewlines(raw)
		);
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

			// register but do not request, the content is spliced in here
			const rawChildFile = (this.context.files.getFileByPath(childPath[0])
				?? this.context.files.addFile(childPath[0])) as FlowrFileProvider<string> | undefined;
			if(rawChildFile !== undefined) {
				this.included.push(childPath[0]);
				block.code = FlowrRMarkdownFile.from(rawChildFile, this.context).content().toString();
			} else {
				log.warn(`Child file '${childPath[0]}' of '${this.path()}' did not load as RMD.`);
			}
		}
	}

	/** The paths this document splices into itself, only known once the content is loaded */
	public get includedFiles(): readonly string[] {
		guard(this.rmd !== undefined);
		return this.included;
	}

	/**
	 * Lifts a file to a {@link FlowrRMarkdownFile}, reusing it if already one and assigning roles.
	 * @param file - The file to lift or return if already an R Markdown file
	 * @param ctx  - The analyzer context the chunks are read with
	 * @param role - An optional role to assign to the file
	 */
	public static from(file: FlowrFileProvider<string> | FlowrRMarkdownFile, ctx: FlowrAnalyzerContext, role?: FileRole): FlowrRMarkdownFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRMarkdownFile ? file : new FlowrRMarkdownFile(file, ctx);
	}
}

export type CodeBlockOptions = Map<string, string>;

export interface CodeBlock {
	options:  CodeBlockOptions,
	code:     string,
	header:   string,
	startpos: { line: number, col: number }
}

export interface RmdInfo {
	blocks:  CodeBlock[]
	options: object
}

/* knitr accepts R literals (`FALSE`, `F`), quarto yaml options accept `false` */
const NonExecutableEvalValues = new Set(['F', 'FALSE', 'false', 'False']);

/**
 * Checks whether a code block is evaluated when the document is knitted (i.e. not `eval=FALSE`),
 * falling back to the document-wide default of {@link globalChunkOptions} if the chunk says nothing
 */
export function isExecutableCell(block: CodeBlock, defaults: CodeBlockOptions): boolean {
	const opt = block.options.get('eval') ?? defaults.get('eval');
	return opt === undefined || !NonExecutableEvalValues.has(opt);
}

const ErrorTolerantValues = new Set(['T', 'TRUE', 'true', 'True']);

/** Checks whether knitr keeps going when the chunk raises an error (i.e. `error=TRUE`) */
export function continuesAfterError(block: CodeBlock, defaults: CodeBlockOptions): boolean {
	const opt = block.options.get('error') ?? defaults.get('error');
	return opt !== undefined && ErrorTolerantValues.has(opt);
}

/** As `error=TRUE` keeps knitting, the chunk must not cut the document short. Adds no lines, so all following positions hold. */
function wrapErrorTolerant(code: string): string {
	return `tryCatch({${code}}, error = function(e) NULL)`;
}

/**
 * The chunk option defaults of the document, which quarto collects under `execute:` in the
 * frontmatter and rmarkdown under `knitr: opts_chunk:`
 */
export function globalChunkOptions(frontmatter: object): CodeBlockOptions {
	const knitr = (frontmatter as { knitr?: { opts_chunk?: unknown } }).knitr;
	const options: CodeBlockOptions = new Map();
	for(const source of [(frontmatter as { execute?: unknown }).execute, knitr?.opts_chunk]) {
		if(typeof source !== 'object' || source === null) {
			continue;
		}
		for(const [key, value] of Object.entries(source)) {
			if(value !== null && typeof value !== 'object') {
				options.set(key, String(value));
			}
		}
	}
	return options;
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
			header:   node.info,
			startpos: { line: node.sourcepos[0][0] + 1, col: 0 }
		});
	}

	blocks.push(...parseIncludeShortcodes(raw));
	blocks.sort((a, b) => a.startpos.line - b.startpos.line);

	return {
		blocks:  blocks,
		options: frontmatter?.data ?? {}
	};
}

const IncludeShortcodeRegex = /{{<\s*include\s+["']?(.+?)["']?\s*>}}/;

/** Collects quarto's `{{< include other.qmd >}}` as blocks carrying a `child`, resolved like knitr's option */
function parseIncludeShortcodes(raw: string): CodeBlock[] {
	const blocks: CodeBlock[] = [];
	const lines = raw.split(LineRegex);
	for(let i = 0; i < lines.length; i++) {
		const match = IncludeShortcodeRegex.exec(lines[i]);
		if(match) {
			blocks.push({
				code:     '',
				options:  new Map([['child', match[1]]]),
				header:   '',
				startpos: { line: i + 1, col: 0 }
			});
		}
	}
	return blocks;
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
	const headerOpts = header.length === 3 // '{r}' => header.length=3 (no options in header)
		? ''
		: header.slice(3, -1).trim();

	const cellLines: string[] = [];
	for(const line of content.split('\n')) {
		if(!line.trim().startsWith('#|')) {
			break;
		}
		// keep the indentation, yaml block scalars rely on it
		cellLines.push(line.trim().slice(2).replace(/^ /, ''));
	}

	const options = parseOptionString(headerOpts);
	for(const [key, value] of parseCellOptions(cellLines)) {
		options.set(key, value);
	}

	return options;
}

/** Parses knitr's `key=value` option syntax as used in the chunk header */
function parseOptionString(opts: string): CodeBlockOptions {
	const parsedOptions = new Map<string, string>();
	for(const match of opts.matchAll(OptionsRegex)) {
		if(match[1] && match[2] !== undefined) { // key must not be empty, but value can be empty string for example
			parsedOptions.set(match[1], match[2].trim());
		}
	}

	return parsedOptions;
}

/** Parses the `#|` options quarto writes as yaml, falling back to knitr's `key=value` syntax */
function parseCellOptions(lines: readonly string[]): CodeBlockOptions {
	if(lines.length === 0) {
		return new Map();
	}

	try {
		const parsed: unknown = matter(`---\n${lines.join('\n')}\n---\n`).data;
		// a bare scalar is knitr's `key=value` syntax, not yaml
		if(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
			const options: CodeBlockOptions = new Map();
			for(const [key, value] of Object.entries(parsed)) {
				if(value !== null && typeof value !== 'object') {
					options.set(key, String(value));
				}
			}
			return options;
		}
	} catch(e) {
		log.warn(`Failed to parse cell options as yaml, falling back to the header syntax. Error was: ${JSON.stringify(e)}`);
	}

	return parseOptionString(lines.join(', '));
}
