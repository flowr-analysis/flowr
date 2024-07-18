import type { QuadSerializationConfiguration } from '../../util/quads'
import { serialize2quads } from '../../util/quads'
import { prepareParsedData , convertPreparedParsedData, type JsonEntry } from '../../r-bridge/lang-4.x/ast/parser/json/format'
import { convertPreparedParsedData } from '../../r-bridge/lang-4.x/ast/parser/json/parser'
import { prepareParsedData } from '../../r-bridge/lang-4.x/ast/parser/json/format'
import type {
	XmlBasedJson
} from '../../r-bridge/lang-4.x/ast/parser/xml/input-format'
import {
	attributesKey,
	childrenKey,
	contentKey
} from '../../r-bridge/lang-4.x/ast/parser/xml/input-format'

function filterObject(obj: JsonEntry): JsonEntry {
	return obj
}

export function parseToQuads(code: string, config: QuadSerializationConfiguration): string{
	const root = convertPreparedParsedData(prepareParsedData(code))
	// recursively filter so that if the object contains one of the keys 'a', 'b' or 'c', all other keys are ignored
	return serialize2quads(
		filterObject(root),
		config
	)
}
