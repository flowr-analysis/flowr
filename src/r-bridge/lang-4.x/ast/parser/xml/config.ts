import { MergeableRecord } from "../../../../../util/objects"

/**
 * Configures the settings for the xml parser (like what names should be used to represent the given objects,
 * and what replacements are active with `xmlparsedata` on the R-side of things).
 *
 * @see DEFAULT_XML_PARSER_CONFIG
 */
export interface XmlParserConfig extends MergeableRecord {
	/** attributes (line, col, ...) are referenced by the given name */
	attributeName: string
	/** the content (lexeme) is referenced by the given name */
	contentName:   string
	/** the children are referenced by the given name */
	childrenName:  string
	/** Mapping from xml tag name to the real operation of the node */
	tokenMap:      Record<string, string /* TODO: change this to OP enum or so */>
}

/**
 * Default configuration to be used for the {@link XmlParserConfig}.
 * <p>
 * Note, that this does not include a sensible {@link XmlParserConfig#tokenMap}, as this must be provided by the corresponding
 * shell environment.
 */
export const DEFAULT_XML_PARSER_CONFIG: XmlParserConfig = {
	attributeName: '@attributes',
	contentName:   '@content',
	childrenName:  '@children',
	tokenMap:      { /* this should not be used, but just so that we can omit null-checks */ }
}
