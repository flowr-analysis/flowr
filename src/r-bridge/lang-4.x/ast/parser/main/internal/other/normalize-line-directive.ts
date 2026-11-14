import type { NormalizerData } from '../../normalizer-data';
import { parseLog } from '../../../json/parser';
import { guard } from '../../../../../../../util/assert';
import { RType } from '../../../../model/type';
import type { RLineDirective } from '../../../../model/nodes/r-line-directive';
import type { RComment } from '../../../../model/nodes/r-comment';
import type { JsonEntry } from '../../../json/format';
import { normalizeComment } from './normalize-comment';


const LineDirectiveRegex = /^#line\s+(\d+)\s+"([^"]+)"\s*$/;

/**
 * Normalize the given object as an R line directive (`#line <number> "<file>"`).
 * This requires you to check the corresponding name beforehand.
 * If the given object turns out to be no line directive, this returns a normal comment instead.
 * @param data - The data used by the parser (see {@link NormalizerData})
 * @param obj  - The JSON object to extract the meta-information from
 */
export function normalizeLineDirective(data: NormalizerData, obj: JsonEntry): RLineDirective | RComment {
	const { type, location, lexeme, info } = normalizeComment(data, obj);
	guard(lexeme.startsWith('#line'), 'line directive must start with #line');
	const match = LineDirectiveRegex.exec(lexeme);
	if(match === null) {
		parseLog.debug(`[line-directive] does not match the regex ${LineDirectiveRegex.source} given ${JSON.stringify(lexeme)}`);
		return { type, location, lexeme, info, content: lexeme.slice(1) };
	}
	return { type: RType.LineDirective, location, line: parseInt(match[1]), file: match[2], lexeme, info };
}
