import { XmlBasedJson } from '../../../common/input-format'
import { boolean2ts, isBoolean, isNA, number2ts, RNa } from '../../../../../../values'
import { RType, RLogical, RSymbol, NoInfo, RNumber } from '../../../../../model'
import { NormalizeConfiguration } from '../../data'
import { retrieveMetaStructure } from '../../../common/meta'

/**
 * Normalize the given object as a R number (see {@link number2ts}), supporting booleans (see {@link boolean2ts}),
 * and special values.
 * This requires you to check the corresponding name beforehand.
 *
 * @param config - The configuration used by the normalizer (see {@link NormalizeConfiguration})
 * @param obj  - The json object to extract the meta-information from
 */
export function normalizeNumber(config: NormalizeConfiguration, obj: XmlBasedJson): RNumber | RLogical | RSymbol<NoInfo, typeof RNa> {
	const { location, content } = retrieveMetaStructure(config, obj)
	const common = {
		location,
		lexeme: content,
		info:   {}
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
