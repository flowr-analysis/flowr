import type { RParseRequest, RParseRequests } from './retriever';

interface ParserContent<T = unknown> {

    // TODO use this for the server response message & repl output
    // description(): string;

    parse(request: RParseRequest): T;

    close(): void;
}
export type SyncParser<T = unknown> = ParserContent<Awaited<T>> & {readonly async?: false};
export type AsyncParser<T = unknown> = ParserContent<Promise<T>> & {readonly async: true};
export type Parser<T = unknown> = SyncParser<T> | AsyncParser<T>;

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

export async function parseRequests<T>(_results: unknown, input: Partial<ParseRequiredInput<T>>): Promise<ParseStepOutput<T>> {
	/* in the future, we want to expose all cases */
	const request = (Array.isArray(input.request) ? input.request[0] : input.request) as RParseRequest;
	if(input.parser?.async){
		return { parsed: await input.parser.parse(request) };
	} else {
		return { parsed: (input.parser as SyncParser<T>).parse(request) };
	}
}
