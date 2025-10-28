import type { RParseRequest, RParseRequests } from './retriever';
import type { OutputCollectorConfiguration, RShell } from './shell';
import type { RShellExecutor } from './shell-executor';
import type { TreeSitterExecutor } from './lang-4.x/tree-sitter/tree-sitter-executor';
import type { Query, QueryCapture, SyntaxNode } from 'web-tree-sitter';

interface ParserContent<T> {
    readonly name: string;
    rVersion(): Promise<string | 'unknown' | 'none'>;
    parse(request: RParseRequest): T;
    close(): void;
}

export interface TreeSitterMetadata {
    name:           TreeSitterExecutor['name'];
    grammarVersion: number
}

export interface RShellMetadata {
	name:     RShell['name'],
	rVersion: string
}

export interface ParserInformation {

    /**
     * Get the name and optional version information of the parser used by the analyzer.
     */
    metadata():   Promise<TreeSitterMetadata | RShellMetadata>;
    /**
     * Sends a command to the underlying R engine and collects the output.
     * @param command     - The command to send to the R engine.
     * @param addonConfig - Additional configuration for the output collector.
     */
    sendCommandWithOutput(command: string, addonConfig?: Partial<OutputCollectorConfiguration>): Promise<string[]>;
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
export type KnownParserName = KnownParser['name']

export interface ParseRequiredInput<T> {
    /** This is the {@link RShell}, {@link RShellExecutor} or {@link TreeSitterExecutor} connection to be used to obtain the original parses AST of the R code */
    readonly parser:  Parser<T>
    /** The request which essentially indicates the input to extract the AST from */
    readonly request: RParseRequests
}

export interface ParseStepOutput<T> {
    /** The parsed AST of the R code as given by the R parse side */
    readonly parsed:         T
    /** Additional meta information about the parse */
    readonly '.parse-meta'?: {
        /** The number of tokens in the AST */
        readonly tokenCount: number
    }
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
 */
export async function parseRequests<T extends KnownParserType>(_results: unknown, input: Partial<ParseRequiredInput<T>>): Promise<ParseStepOutput<T>> {
	/* in the future, we want to expose all cases */
	const request = (Array.isArray(input.request) ? input.request[0] : input.request) as RParseRequest;

    
	if(input.parser?.async){
		const parsed = await input.parser.parse(request);
		return {
			parsed,
			'.parse-meta': typeof parsed === 'object' && 'rootNode' in parsed ? {
				tokenCount: countChildren(parsed.rootNode),
			} : undefined
		};
	} else {
		const parsed = (input.parser as SyncParser<T>).parse(request);
		return {
			parsed,
			'.parse-meta': typeof parsed === 'object' && 'rootNode' in parsed ? {
				tokenCount: countChildren(parsed.rootNode),
			} : undefined
		};
	}
}
