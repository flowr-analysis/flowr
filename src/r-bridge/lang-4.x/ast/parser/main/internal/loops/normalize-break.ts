import type { NormalizerData } from '../../normalizer-data';
import { parseLog } from '../../../json/parser';
import { expensiveTrace } from '../../../../../../../util/log';
import { retrieveMetaStructure } from '../../normalize-meta';
import { RType } from '../../../../model/type';
import type { RBreak } from '../../../../model/nodes/r-break';
import type { JsonEntry } from '../../../json/format';



/**
 *
 */
export function normalizeBreak(data: NormalizerData, obj: JsonEntry): RBreak {
	expensiveTrace(parseLog, () => `[break] ${JSON.stringify(obj)}`);

	const { location, content } = retrieveMetaStructure(obj);

	return {
		type:   RType.Break,
		location,
		lexeme: content,
		info:   {
			fullRange:  location,
			adToks:     [],
			fullLexeme: content
		}
	};
}
