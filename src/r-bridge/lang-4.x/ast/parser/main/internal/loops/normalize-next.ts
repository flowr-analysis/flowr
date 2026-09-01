import type { NormalizerData } from '../../normalizer-data';
import { expensiveTrace } from '../../../../../../../util/log';
import { parseLog } from '../../../json/parser';
import { retrieveMetaStructure } from '../../normalize-meta';
import { RType } from '../../../../model/type';
import type { RNext } from '../../../../model/nodes/r-next';
import type { JsonEntry } from '../../../json/format';


/**
 * Normalizes a `next`, which carries nothing beyond where it is written.
 * @param data - the normalizer's state
 * @param obj  - the parsed entry to normalize
 */
export function normalizeNext(data: NormalizerData, obj: JsonEntry): RNext {
	expensiveTrace(parseLog, () => `[next] ${JSON.stringify(obj)}`);

	const { location, content } = retrieveMetaStructure(obj);

	return {
		type:   RType.Next,
		location,
		lexeme: content,
		info:   {
			fullRange:  data.currentRange,
			adToks:     [],
			fullLexeme: data.currentLexeme
		}
	};
}
