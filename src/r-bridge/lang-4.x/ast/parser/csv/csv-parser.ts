import type {TokenMap} from '../../../../retriever'
import type {DeepPartial} from 'ts-essentials'
import type { XmlParserHooks} from '../xml'
import {DEFAULT_PARSER_HOOKS, DEFAULT_XML_PARSER_CONFIG, type ParserData} from '../xml'
import type { IdGenerator, NoInfo} from '../../model'
import {decorateAst, deterministicCountingIdGenerator, type NormalizedAst} from '../../model'
import {deepMergeObject} from '../../../../../util/objects'
import {csvToRecord} from './format'
import {parseCSV} from '../../../values'
import {parseRootObjToAst} from '../xml/internal'

export function normalize(csvString: string, tokenMap: TokenMap, hooks?: DeepPartial<XmlParserHooks>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): NormalizedAst {
	const config = { ...DEFAULT_XML_PARSER_CONFIG, tokenMap }
	const hooksWithDefaults = deepMergeObject(DEFAULT_PARSER_HOOKS, hooks) as XmlParserHooks

	const data: ParserData = { config, hooks: hooksWithDefaults, currentRange: undefined, currentLexeme: undefined }
	const object = csvToRecord(parseCSV(csvString))

	return decorateAst(parseRootObjToAst(data, object), getId)
}
