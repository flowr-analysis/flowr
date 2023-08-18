import { MergeableRecord } from "../../../../../util/objects"
import { DeepReadonly } from "ts-essentials"
import { XmlParserConfig } from "./config"
import { XmlParserHooks } from './hooks'
import { SourceRange } from '../../../../../util/range'

/**
 * Contains all information populated and present during parsing and normalization of the R AST.
 */
export interface ParserData extends MergeableRecord {
	/** @see XmlParserConfig */
	readonly config: DeepReadonly<XmlParserConfig>
	/** @see XmlParserHooks */
	readonly hooks:  DeepReadonly<XmlParserHooks>
	/**
   * The currently active source range during parsing, i.e. the full range of the current element.
   */
	currentRange:    SourceRange | undefined
	/**
   * The currently active lexeme during parsing, i.e. the full lexeme of the current element.
   */
	currentLexeme:   string | undefined
}
