import { QuadSerializationConfiguration, serialize2quads } from '../../util/quads'
import { xlm2jsonObject } from '../../r-bridge/lang-4.x/ast/parser/xml/internal'
import { XmlParserConfig } from '../../r-bridge'

export async function parseToQuads(code: string, config: QuadSerializationConfiguration, parseConfig: XmlParserConfig): Promise<string> {
	return serialize2quads(await xlm2jsonObject(parseConfig, code), config)
}
