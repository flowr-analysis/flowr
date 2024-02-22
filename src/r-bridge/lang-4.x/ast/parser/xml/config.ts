import type { MergeableRecord } from '../../../../../util/objects'

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
}

/**
 * Default configuration to be used for the {@link XmlParserConfig}.
 * <p>
 * Note, that this does not include a sensible {@link XmlParserConfig#tokenMap}, as this must be provided by the corresponding
 * shell environment.
 */
export const DEFAULT_XML_PARSER_CONFIG: XmlParserConfig = {
	attributeName: '@a',
	contentName:   '@v',
	childrenName:  '@c'
}
