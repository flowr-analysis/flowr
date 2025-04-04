import type { NormalizerData } from '../../normalizer-data';
import { parseLog } from '../../../json/parser';
import { retrieveMetaStructure } from '../../normalize-meta';
import { guard } from '../../../../../../../util/assert';
import type { RArgument } from '../../../../model/nodes/r-argument';
import type { RDelimiter } from '../../../../model/nodes/info/r-delimiter';
import type { RNode } from '../../../../model/model';
import type { RSymbol } from '../../../../model/nodes/r-symbol';
import { RawRType, RType } from '../../../../model/type';
import { normalizeSingleNode } from '../structure/normalize-single-node';
import type { NamedJsonEntry } from '../../../json/format';
import { startAndEndsWith } from '../../../../../../../util/strings';


/**
 * Either parses `[expr]` or `[SYMBOL_SUB, EQ_SUB, expr]` as an argument of a function call in R.
 * Probably directly called by the function call parser as otherwise, we do not expect to find arguments.
 *
 * @param data - The data used by the parser (see {@link NormalizerData})
 * @param objs - Either `[expr]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]`
 *
 * @returns The parsed argument or `undefined` if the given object is not an argument.
 */
export function tryToNormalizeArgument(data: NormalizerData, objs: readonly NamedJsonEntry[]): RArgument | undefined {
	if(objs.length < 1 || objs.length > 3) {
		parseLog.warn(`Either [expr|value], [SYMBOL_SUB, EQ_SUB], or [SYMBOL_SUB, EQ_SUB, expr], but got: ${objs.map(o => o.name).join(', ')}`);
		return undefined;
	}

	const symbolOrExpr = objs[0];
	const { location, content } = retrieveMetaStructure(symbolOrExpr.content);

	let parsedValue: RNode | RDelimiter | undefined |  null;
	let name: RSymbol | undefined;
	if(symbolOrExpr.name === RawRType.Expression) {
		name = undefined;
		parsedValue = normalizeSingleNode(data, symbolOrExpr);
	} else if(symbolOrExpr.name === RawRType.SymbolSub || symbolOrExpr.name === RawRType.StringConst) {
		name =    {
			type:      RType.Symbol,
			location,
			content:   symbolOrExpr.name === RawRType.StringConst ? content.slice(1,-1) : (startAndEndsWith(content, '`') ? content.slice(1, -1) : content),
			namespace: undefined,
			lexeme:    content,
			info:      {
				fullRange:        location,
				additionalTokens: [],
				fullLexeme:       content
			}
		};
		parsedValue = parseWithValue(data, objs);
	} else {
		parseLog.warn(`expected symbol or expr for argument, yet received ${objs.map(o => o.name).join(',')}`);
		return undefined;
	}

	guard(parsedValue !== undefined && parsedValue?.type !== RType.Delimiter, () => `[argument] parsed value must not be undefined, yet: ${JSON.stringify(objs)}`);

	return {
		type:   RType.Argument,
		location,
		lexeme: content,
		name,
		value:  parsedValue ?? undefined,
		info:   {
			fullRange:        location,
			fullLexeme:       content,
			additionalTokens: []
		}
	};
}

function parseWithValue(data: NormalizerData, objs: readonly NamedJsonEntry[]): RNode | RDelimiter | undefined | null{
	guard(objs[1].name === RawRType.EqualSub, () => `[arg-default] second element of parameter must be ${RawRType.EqualFormals}, but: ${JSON.stringify(objs)}`);
	const snd = objs[2];
	guard(objs.length === 2 || snd.name === RawRType.Expression, () => `[arg-default] third element of parameter must be an Expression or undefined (for 'x=') but: ${JSON.stringify(objs)}`);
	return snd ? normalizeSingleNode(data, snd) : null;
}
