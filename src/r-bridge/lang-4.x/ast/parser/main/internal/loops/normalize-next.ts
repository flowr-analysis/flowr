import type { NormalizerData } from '../../normalizer-data';
import { expensiveTrace } from '../../../../../../../util/log';
import { parseLog } from '../../../json/parser';
import { retrieveMetaStructure } from '../../normalize-meta';
import { RType } from '../../../../model/type';
import type { RNext } from '../../../../model/nodes/r-next';
import type { JsonEntry } from '../../../json/format';

export function normalizeNext(data: NormalizerData, obj: JsonEntry): RNext {
	expensiveTrace(parseLog, () => `[next] ${JSON.stringify(obj)}`);

	const { location, content } = retrieveMetaStructure(obj);

	return {
		type:   RType.Next,
		location,
		lexeme: content,
		info:   {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	};
}
