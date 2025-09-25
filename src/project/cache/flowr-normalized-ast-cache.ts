import { FlowrCache } from './flowr-cache';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrParseCache } from './flowr-parse-cache';
import type { KnownParser } from '../../r-bridge/parser';

/**
 * Flowr normalized AST specific cache.
 */
export class FlowrNormalizeCache<Parser extends KnownParser = KnownParser> extends FlowrCache<
    NormalizedAst
> {

	protected constructor(parser: FlowrParseCache<Parser>) {
		super();
		parser.registerDependent(this);
	}

	public static create<Parser extends KnownParser = KnownParser>(parser: FlowrParseCache<Parser>): FlowrNormalizeCache<Parser> {
		/* in the future, with e.g. incrementality, we want to specialize based on the parser */
		return new FlowrNormalizeCache<Parser>(parser);
	}
}