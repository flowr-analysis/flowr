import { retrieveMetaStructure } from '../../normalize-meta'
import { RType } from '../../../../model/type'
import type { RDelimiter } from '../../../../model/nodes/info/r-delimiter'
import type { NamedJsonEntry } from '../../../json/format'

export function normalizeDelimiter(elem: NamedJsonEntry): RDelimiter {
	const { location, content } = retrieveMetaStructure(elem.content)
	return {
		type:    RType.Delimiter,
		location,
		lexeme:  content,
		subtype: elem.name
	}
}
