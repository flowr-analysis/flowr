import type { DeepPartial } from 'ts-essentials'
import type { XmlBasedJson, XmlParserHooks , ParserData } from '../xml'
import { nameKey , DEFAULT_PARSER_HOOKS , attributesKey, contentKey , childrenKey } from '../xml'
import { decorateAst, deterministicCountingIdGenerator } from '../../model'
import type { IdGenerator, NoInfo , NormalizedAst } from '../../model'
import { deepMergeObject } from '../../../../../util/objects'
import type { Entry } from './format'
import { RootId, prepareParsedData } from './format'
import { parseRootObjToAst } from '../xml/internal'
import { log } from '../../../../../util/log'
import type { IdGenerator, NormalizedAst } from '../../model/processing/decorate'
import { decorateAst , deterministicCountingIdGenerator } from '../../model/processing/decorate'
import type { NormalizerData } from '../xml/normalizer-data'
import type { NoInfo } from '../../model/model'
import { normalizeRootObjToAst } from '../xml/internal/structure/normalize-root'
import type { XmlBasedJson } from '../xml/input-format'
import { childrenKey , contentKey , attributesKey, nameKey } from '../xml/input-format'
import { RawRType } from '../../model/type'

export const parseLog = log.getSubLogger({ name: 'ast-parser' })

export function normalize(jsonString: string, hooks?: DeepPartial<ParserHooks>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): NormalizedAst {
	const hooksWithDefaults = deepMergeObject(DEFAULT_PARSER_HOOKS, hooks) as ParserHooks

	const data: ParserData = { hooks: hooksWithDefaults, currentRange: undefined, currentLexeme: undefined }
	const object = convertPreparedParsedData(prepareParsedData(jsonString))

	return decorateAst(normalizeRootObjToAst(data, object), getId)
}
