import type { NormalizerData } from '../../normalizer-data';
import { guard } from '../../../../../../../util/assert';
import { retrieveMetaStructure } from '../../normalize-meta';
import type { RSymbol } from '../../../../model/nodes/r-symbol';
import { isSymbol, RType } from '../../../../model/type';
import type { NamedJsonEntry } from '../../../json/format';
import { Identifier } from '../../../../../../../dataflow/environments/identifier';
import type { SourceRange } from '../../../../../../../util/range';

/**
 * Normalize the given object as an R symbol (incorporating namespace information).
 * @param data - The data used by the parser (see {@link NormalizerData})
 * @param objs - The JSON object to extract the meta-information from
 * @returns The parsed symbol (with populated namespace information) or `undefined` if the given object is not a symbol.
 * @see {@link RSymbol} for more information about R symbols.
 */
export function tryNormalizeSymbol(data: NormalizerData, objs: readonly NamedJsonEntry[]): RSymbol | undefined {
	guard(objs.length > 0, 'to parse symbols we need at least one object to work on!');
	let content: Identifier, location: SourceRange;

	let meta: { location: SourceRange, content: string };

	if(objs.length === 1 && isSymbol(objs[0].name)) {
		meta  = retrieveMetaStructure(objs[0].content);
		location    = meta.location;
		content     = Identifier.make(meta.content);
	} else if(objs.length === 3 && isSymbol(objs[2].name)) {
		meta  = retrieveMetaStructure(objs[2].content);
		location    = meta.location;
		const namespace   = objs[0].content.text;
		const internal =  objs[1].content.text === ':::';
		content     = Identifier.make(meta.content, namespace, internal);
	} else {
		return undefined;
	}

	return {
		type:   RType.Symbol,
		location,
		// remove backticks from symbol
		content,
		lexeme: meta.content,
		info:   {
			fullRange:  data.currentRange,
			adToks:     [],
			fullLexeme: data.currentLexeme
		}
	} satisfies RSymbol;
}
