import type { ParserData } from '../../data'
import type { XmlBasedJson } from '../../input-format'
import type { NoInfo, RLogical, RNumber, RSymbol } from '../../../../model'
import { RType } from '../../../../model'
import type { RNa } from '../../../../../values'
import { number2ts, boolean2ts, isBoolean, isNA } from '../../../../../values'
import { retrieveMetaStructure } from '../../meta'


/**
 * Normalize the given object as a R number (see {@link number2ts}), supporting booleans (see {@link boolean2ts}),
 * and special values.
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj  - The json object to extract the meta-information from
 */
export function normalizeNumber(data: ParserData, obj: XmlBasedJson): RNumber | RLogical | RSymbol<NoInfo, typeof RNa> {
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
