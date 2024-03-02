import type { XmlBasedJson } from '../../../common/input-format'
import type { RNa } from '../../../../../../values'
import { boolean2ts, isBoolean, isNA, number2ts } from '../../../../../../values'
import { retrieveMetaStructure } from '../../../common/meta'
import type { RLogical, RSymbol, NoInfo, RNumber } from '../../../../../model'
import { RType } from '../../../../../model'
import type { ParserData } from '../../data'
import { parseLog } from '../../../../json/parser'

/**
 * Normalize the given object as a R number (see {@link number2ts}), supporting booleans (see {@link boolean2ts}),
 * and special values.
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj  - The json object to extract the meta-information from
 */
export function normalizeNumber(data: ParserData, obj: XmlBasedJson): RNumber | RLogical | RSymbol<NoInfo, typeof RNa> {
	parseLog.debug('[number]')

	const { location, content } = retrieveMetaStructure(obj)
	const common = {
		location,
		lexeme: content,
		info:   {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}

	/* the special symbol */
	if(isNA(content)) {
		return {
			...common,
			namespace: undefined,
			type:      RType.Symbol,
			content
		}
	} else if(isBoolean(content)) {
		return {
			...common,
			type:    RType.Logical,
			content: boolean2ts(content)
		}
	} else {
		return {
			...common,
			type:    RType.Number,
			content: number2ts(content)
		}
	}
}
