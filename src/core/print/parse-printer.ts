import { type QuadSerializationConfiguration , serialize2quads } from '../../util/quads';
import { convertPreparedParsedData, prepareParsedData } from '../../r-bridge/lang-4.x/ast/parser/json/format';

/**
 * Parse R code and serialize it to quads
 * @see {@link serialize2quads}
 * @see {@link QuadSerializationConfiguration}
 */
export function parseToQuads(code: string, config: QuadSerializationConfiguration): string{
	return serialize2quads(convertPreparedParsedData(prepareParsedData(code)), config);
}
