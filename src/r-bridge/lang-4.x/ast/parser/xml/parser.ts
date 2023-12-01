import { deepMergeObject } from '../../../../../util/objects'
import { log } from '../../../../../util/log'
import { DEFAULT_XML_PARSER_CONFIG, XmlParserConfig } from './config'
import { xlm2jsonObject, parseRootObjToAst } from './internal'
import { ParserData } from './data'
import {
	decorateAst,
	NormalizedAst,
	deterministicCountingIdGenerator,
	IdGenerator,
	NoInfo
} from '../../model'
import { DEFAULT_PARSER_HOOKS, XmlParserHooks } from './hooks'
import { DeepPartial } from 'ts-essentials'
import { TokenMap } from '../../../../retriever'

export const parseLog = log.getSubLogger({ name: 'ast-parser' })

/**
 * The main entry point to normalize the given R ast.
 * You probably want to use {@link retrieveNormalizedAstFromRCode} to directly normalize a piece of code.
 *
 * @param xmlString - The XML string obtained probably by {@link retrieveXmlFromRCode} for normalization.
 * @param tokenMap  - The token replacement map in effect by the XML parser
 * @param hooks     - Optional hooks to customize the normalization process (see {@link XmlParserHooks} for details)
 * @param getId     - The function to be used to generate unique ids for the nodes of the ast. It is up to you to ensure that the ids are unique!
 *
 * @returns The normalized and decorated AST (i.e., as a doubly linked tree)
 */
export async function normalize(xmlString: string, tokenMap: TokenMap, hooks?: DeepPartial<XmlParserHooks>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Promise<NormalizedAst> {
	const config = { ...DEFAULT_XML_PARSER_CONFIG, tokenMap }
	const hooksWithDefaults = deepMergeObject(DEFAULT_PARSER_HOOKS, hooks) as XmlParserHooks

	const data: ParserData = { config, hooks: hooksWithDefaults, currentRange: undefined, currentLexeme: undefined }
	const object = await xlm2jsonObject(config, xmlString)

	return decorateAst(parseRootObjToAst(data, object), getId)
}
