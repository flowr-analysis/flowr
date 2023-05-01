import { deepMergeObject } from '../../../../../util/objects'
import * as Lang from '../../model'
import { log } from "../../../../../util/log"
import { DEFAULT_XML_PARSER_CONFIG, XmlParserConfig } from "./config"
import { xlm2jsonObject } from "./internal/xml2json"
import { parseRootObjToAst } from "./internal/structure/root"
import { ParserData } from "./data"

export const parseLog = log.getSubLogger({ name: 'ast-parser' })

/**
 * The main entry point to normalize the given R ast.
 */
export async function parse (xmlString: string, tokenMap: XmlParserConfig['tokenMap']): Promise<Lang.RExpressionList> {
  const config = deepMergeObject(DEFAULT_XML_PARSER_CONFIG, { tokenMap })
  parseLog.debug(`config for xml parser: ${JSON.stringify(config)}`)

  const data: ParserData = { config }
  const object = await xlm2jsonObject(config, xmlString)

  return parseRootObjToAst(data, object)
}
