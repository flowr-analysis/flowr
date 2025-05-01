import type { NormalizerData } from '../../normalizer-data';
import { guard } from '../../../../../../../util/assert';
import { retrieveMetaStructure } from '../../normalize-meta';
import { startAndEndsWith } from '../../../../../../../util/text/strings';
import type { RSymbol } from '../../../../model/nodes/r-symbol';
import { isSymbol, RType } from '../../../../model/type';
import type { NamedJsonEntry } from '../../../json/format';

/**
 * Normalize the given object as an R symbol (incorporating namespace information).
 * <p>
 * The special symbols `T` and `F` are parsed as logic values.
 *
 * @param data - The data used by the parser (see {@link NormalizerData})
 * @param objs - The JSON object to extract the meta-information from
 *
 * @returns The parsed symbol (with populated namespace information) or `undefined` if the given object is not a symbol.
 */
export function tryNormalizeSymbol(data: NormalizerData, objs: readonly NamedJsonEntry[]): RSymbol | undefined {
	guard(objs.length > 0, 'to parse symbols we need at least one object to work on!');

	let location, content, namespace;

	if(objs.length === 1 && isSymbol(objs[0].name)) {
		const meta  = retrieveMetaStructure(objs[0].content);
		location    = meta.location;
		content     = meta.content;
		namespace   = undefined;
	} else if(objs.length === 3 && isSymbol(objs[2].name)) {
		const meta  = retrieveMetaStructure(objs[2].content);
		location    = meta.location;
		content     = meta.content;
		namespace   = retrieveMetaStructure(objs[0].content).content;
	} else {
		return undefined;
	}

	return {
		type:    RType.Symbol,
		namespace,
		location,
		// remove backticks from symbol
		content: startAndEndsWith(content, '`') ? content.substring(1, content.length - 1) : content,
		lexeme:  content,
		info:    {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	};
}
