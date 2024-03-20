import type { QuadSerializationConfiguration } from '../../util/quads'
import { serialize2quads } from '../../util/quads'
import type { XmlBasedJson } from '../../r-bridge'
import { attributesKey, childrenKey, contentKey } from '../../r-bridge'
import { prepareParsedData , convertPreparedParsedData, type JsonEntry } from '../../r-bridge/lang-4.x/ast/parser/json/format'

function filterObject(obj: JsonEntry, keys: Set<string>): JsonEntry {
	return obj
}

export function parseToQuads(code: string, config: QuadSerializationConfiguration): string{
	const root = convertPreparedParsedData(prepareParsedData(code))
	// recursively filter so that if the object contains one of the keys 'a', 'b' or 'c', all other keys are ignored
	return serialize2quads(
		filterObject(root, new Set([attributesKey, childrenKey, contentKey])),
		config
	)
}
