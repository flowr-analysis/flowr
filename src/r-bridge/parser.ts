import type { RParseRequestFromText } from './retriever';
import type { OutputCollectorConfiguration, RShell } from './shell';
import type { RShellExecutor } from './shell-executor';
import type { TreeSitterExecutor } from './lang-4.x/tree-sitter/tree-sitter-executor';
import type { Query, QueryCapture, SyntaxNode } from 'web-tree-sitter';
import type { FlowrAnalysisProvider } from '../project/flowr-analyzer';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';

interface ParserContent<T> {
    readonly name: string;
    information(analyzer: FlowrAnalysisProvider): BaseParserInformation;
    parse(request: RParseRequestFromText): T;
    close(): void;
}

export interface BaseParserInformation {
    readonly name: KnownParserName
}

export interface BaseRShellInformation extends BaseParserInformation {
    readonly name: 'r-shell'
    rVersion(): Promise<string>
}

export interface RShellInformation extends BaseRShellInformation {
    /**
     * Sends a command to the underlying R engine and collects the output.
     * @param command     - The command to send to the R engine.
     * @param addonConfig - Additional configuration for the output collector.
     */
    sendCommandWithOutput(command: string, addonConfig?: Partial<OutputCollectorConfiguration>): Promise<string[]>;
}

export interface TreeSitterInformation extends BaseParserInformation {
    readonly name:           'tree-sitter'
    readonly grammarVersion: number
    /**
     * Runs the given tree-sitter query using the underlying tree-sitter parser and returns the resulting capture.
     * @param source - The tree-sitter query to run.
     * @param force  - Do not use the cache, instead force a new parse.
     */
    treeSitterQuery(source: Query | string, force?: boolean): Promise<QueryCapture[]>;
}

export type SyncParser<T> = ParserContent<Awaited<T>> & {readonly async?: false};
export type AsyncParser<T> = ParserContent<Promise<T>> & {readonly async: true};
export type Parser<T> = SyncParser<T> | AsyncParser<T>;

export type KnownParser = RShell | RShellExecutor | TreeSitterExecutor;
export type KnownParserType = Awaited<ReturnType<KnownParser['parse']>>;
export type KnownParserInformation = ReturnType<KnownParser['information']>
export type KnownParserName = KnownParser['name']

export interface ParseRequiredInput<T> {
	/** This is the {@link RShell}, {@link RShellExecutor} or {@link TreeSitterExecutor} connection to be used to obtain the original parses AST of the R code */
	readonly parser:  Parser<T>
	/**
	 * The context from which to derive the requests from,
	 * please either relay on the {@link FlowrAnalyzer}
	 * or construct one with {@link contextFromInput}
	 */
	readonly context: FlowrAnalyzerContext
}

export interface ParseStepOutputSingleFile<T> {
	/** The parsed AST of the R code as given by the R parse side */
	readonly parsed:         T
	readonly filePath:       string | undefined
	/** Additional meta information about the parse */
	readonly '.parse-meta'?: {
		/** The number of tokens in the AST */
		readonly tokenCount: number
	}
}

export interface ParseStepOutput<T> {
	readonly files: ParseStepOutputSingleFile<T>[]
}

function countChildren(node: SyntaxNode): number {
	let ret = 1;
	for(const child of node.children) {
		ret += countChildren(child);
	}
	return ret;
}

/**
 * Takes an input program and parses it using the given parser.
 * @param _results - just a proxy for the pipeline, signifies that this function does not need prior knowledge of the pipeline
 * @param input    - the input to the parse step
 * @returns The parsed AST per request in the loading order obtained from the {@link FlowrAnalyzerFilesContext|files context} of the given {@link FlowrAnalyzerContext}.
 */
export async function parseRequests<T extends KnownParserType>(_results: unknown, input: Partial<ParseRequiredInput<T>>):
		Promise<ParseStepOutput<T>> {
	const loadingOrder = (input.context as FlowrAnalyzerContext).files.loadingOrder.getLoadingOrder();
	/* in the future, we want to expose all cases */
	const translatedRequests = loadingOrder.map(r => (input.context as FlowrAnalyzerContext).files.resolveRequest(r));

	if(input.parser?.async){
		/* sadly we cannot Promise.all with the Rshell as it has to process commands in order and is not thread safe */
		const files: ParseStepOutputSingleFile<T>[] = [];
		for(const req of translatedRequests) {
			const parsed = await (input.parser).parse(req.r);
			files.push({
				parsed,
				filePath:      req.path,
				'.parse-meta': typeof parsed === 'object' && 'rootNode' in parsed ? {
					tokenCount: countChildren(parsed.rootNode),
				} : undefined
			});
		}
		return { files };
	} else {
		const p = input.parser as SyncParser<T>;
		return {
			files: translatedRequests.map(r => {
				const parsed = p.parse(r.r);
				return {
					parsed,
					filePath:      r.path,
					'.parse-meta': typeof parsed === 'object' && 'rootNode' in parsed ? {
						tokenCount: countChildren(parsed.rootNode),
					} : undefined
				};
			})
		};
	}
}
