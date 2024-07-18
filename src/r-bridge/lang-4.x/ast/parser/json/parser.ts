import { prepareParsedData, convertPreparedParsedData } from './format'
import { log } from '../../../../../util/log'
import type { IdGenerator, NormalizedAst } from '../../model/processing/decorate'
import { decorateAst , deterministicCountingIdGenerator } from '../../model/processing/decorate'
import type { NoInfo } from '../../model/model'
import { normalizeRootObjToAst } from '../xml/internal/structure/normalize-root'
import type { NormalizerData } from '../xml/normalizer-data'

export const parseLog = log.getSubLogger({ name: 'ast-parser' })

export function normalize(jsonString: string, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): NormalizedAst {
	const data: NormalizerData = { currentRange: undefined, currentLexeme: undefined }
	const object = convertPreparedParsedData(prepareParsedData(jsonString))

	return decorateAst(normalizeRootObjToAst(data, object), getId)
}
