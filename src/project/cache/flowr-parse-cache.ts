import { FlowrCache } from './flowr-cache';
import type { KnownParser, ParseStepOutput } from '../../r-bridge/parser';
import type { PipelinePerStepMetaInformation } from '../../core/steps/pipeline/pipeline';

/**
 * Flowr Parser specific cache.
 */
export class FlowrParseCache<Parser extends KnownParser> extends FlowrCache<
    ParseStepOutput<Awaited<ReturnType<Parser['parse']>>> & PipelinePerStepMetaInformation
> {
	private readonly parser: Parser;

	protected constructor(parser: Parser) {
		super();
		this.parser = parser;
	}

	public static create<Parser extends KnownParser>(parser: Parser): FlowrParseCache<Parser> {
		/* in the future, with e.g. incrementality, we want to specialize based on the parser */
		return new FlowrParseCache<Parser>(parser);
	}

	public getParser(): Parser {
		return this.parser;
	}
}