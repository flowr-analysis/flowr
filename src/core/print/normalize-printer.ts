import { jsonReplacer } from '../../util/json';
import { type QuadSerializationConfiguration , serialize2quads } from '../../util/quads';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../util/mermaid/ast';

/** Should work with larger things as well */
export function normalizedAstToJson(ast: NormalizedAst): string {
	// we never serialize the idmap, as it just duplicates the ast, additionally we now miss the full-lexeme to further safe memory
	return JSON.stringify({ ...ast.ast, idMap: undefined }, (k, v) => {
		if(k === 'fullLexeme') {
			return undefined;
		}

		return jsonReplacer(k, v);
	});
}

/**
 * Normalized AST to quads serialization
 * @see {@link serialize2quads}
 * @see {@link QuadSerializationConfiguration}
 * @see {@link normalizedAstToMermaid}
 * @see {@link normalizedAstToMermaidUrl}
 * @see {@link printNormalizedAstToMermaidUrl}
 */
export function normalizedAstToQuads(ast: NormalizedAst, config: QuadSerializationConfiguration): string {
	return serialize2quads(ast.ast, config);
}

/**
 * Serialize the normalized AST to mermaid format
 * @see {@link normalizedAstToMermaid}
 * @see {@link normalizedAstToMermaidUrl}
 * @see {@link printNormalizedAstToMermaidUrl}
 */
export function printNormalizedAstToMermaid(ast: NormalizedAst): string {
	return normalizedAstToMermaid(ast.ast);
}

/**
 * Serialize the normalized AST to a mermaid URL
 * @see {@link normalizedAstToMermaid}
 * @see {@link normalizedAstToMermaidUrl}
 * @see {@link printNormalizedAstToMermaid}
 */
export function printNormalizedAstToMermaidUrl(ast: NormalizedAst): string {
	return normalizedAstToMermaidUrl(ast.ast);
}
