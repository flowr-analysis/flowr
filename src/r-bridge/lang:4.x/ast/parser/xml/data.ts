import { MergeableRecord } from "../../../../../util/objects"
import { DeepReadonly } from "ts-essentials"
import { XmlParserConfig } from "./config"
import { XmlParserHooks } from './hooks'

/**
 * Contains all information populated and present during parsing and normalization of the R AST.
 */
export interface ParserData extends MergeableRecord {
  /** @see XmlParserConfig */
  readonly config: DeepReadonly<XmlParserConfig>
  /** @see XmlParserHooks */
  readonly hooks:  DeepReadonly<XmlParserHooks>
}
