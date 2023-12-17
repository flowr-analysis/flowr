import { log } from '../../../../../../util/log'
import { DEFAULT_XML_PARSER_CONFIG } from '../common/config'
import { NormalizeConfiguration } from './data'
import {
	decorateAst,
	NormalizedAst,
	deterministicCountingIdGenerator,
	IdGenerator,
	NoInfo
} from '../../../model'
import { TokenMap } from '../../../../../retriever'
import { xlm2jsonObject } from '../common/xml-to-json'

export const normalizeLog = log.getSubLogger({ name: 'v2-normalize' })

/**
 * The main entry point to normalize the given R ast (using v2, which desugars the AST to function-calls only).
 *
 * @param xmlString - The XML string obtained probably by {@link retrieveXmlFromRCode} to normalization and desugar.
 * @param tokenMap  - The token replacement map in effect by the XML parser
 * @param getId     - The function to be used to generate unique ids for the nodes of the ast. It is up to you to ensure that the ids are unique!
 *
 * @returns The normalized and decorated AST (i.e., as a doubly linked tree)
 */
export async function normalize(xmlString: string, tokenMap: TokenMap, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Promise<NormalizedAst> {
	const config: NormalizeConfiguration = { ...DEFAULT_XML_PARSER_CONFIG, tokenMap }

	const object = await xlm2jsonObject(config, xmlString)

	return decorateAst(normalizeRootObjToAst(data, object), getId)
}
