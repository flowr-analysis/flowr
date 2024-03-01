import type { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import type { RSymbol } from '../../../../../model'
import { RType } from '../../../../../model'
import type { NormalizeConfiguration } from '../../data'

export function normalizeNextAndBreak(config: NormalizeConfiguration, obj: XmlBasedJson): RSymbol {
	const { location, content } = retrieveMetaStructure(obj)
	return {
		type:      RType.Symbol,
		lexeme:    content,
		content,
		location,
		namespace: undefined,
		info:      {}
	}
}
