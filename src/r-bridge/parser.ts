import type { RParseRequest, RParseRequests } from './retriever';
import type { RShell } from './shell';
import type { RShellExecutor } from './shell-executor';
import type { TreeSitterExecutor } from './lang-4.x/tree-sitter/tree-sitter-executor';

interface ParserContent<T> {

    readonly name: string;

    rVersion(): Promise<string | 'unknown' | 'none'>;

    parse(request: RParseRequest): T;

    close(): void;
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
    readonly parsed: T
}

export async function parseRequests<T extends KnownParserType>(_results: unknown, input: Partial<ParseRequiredInput<T>>): Promise<ParseStepOutput<T>> {
	/* in the future, we want to expose all cases */
	const request = (Array.isArray(input.request) ? input.request[0] : input.request) as RParseRequest;
	if(input.parser?.async){
		return { parsed: await input.parser.parse(request) };
	} else {
		return { parsed: (input.parser as SyncParser<T>).parse(request) };
	}
}
