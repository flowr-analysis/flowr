import { deepMergeObject } from "../../../../../util/objects"
import { log } from "../../../../../util/log"
import { DEFAULT_XML_PARSER_CONFIG, XmlParserConfig } from "./config"
import { xlm2jsonObject, parseRootObjToAst } from './internal'
import { ParserData } from "./data"
import { RExpressionList } from '../../model'
import { DEFAULT_PARSER_HOOKS, XmlParserHooks } from './hooks'
import { DeepPartial } from 'ts-essentials'

export const parseLog = log.getSubLogger({ name: "ast-parser" })

/**
 * The main entry point to normalize the given R ast.
 */
export async function parse(xmlString: string, tokenMap: XmlParserConfig['tokenMap'], hooks?: DeepPartial<XmlParserHooks>): Promise<RExpressionList> {
  const config = deepMergeObject(DEFAULT_XML_PARSER_CONFIG, { tokenMap })
  const hooksWithDefaults = deepMergeObject(DEFAULT_PARSER_HOOKS, hooks) as XmlParserHooks
  parseLog.debug(`config for xml parser: ${JSON.stringify(config)}`)

  const data: ParserData = { config, hooks: hooksWithDefaults }
  const object = await xlm2jsonObject(config, xmlString)

  return parseRootObjToAst(data, object)
}
