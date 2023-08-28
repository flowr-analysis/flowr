import { NamedXmlBasedJson } from '../../input-format'
import { guard } from '../../../../../../../util/assert'
import { retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { isSymbol, Type, RSymbol, RLogical, RNode } from '../../../../model'
import { ParserData } from '../../data'
import { executeHook, executeUnknownHook } from '../../hooks'
import { startAndEndsWith } from '../../../../../../../util/strings'

/**
 * Normalize the given object as an R symbol (incorporating namespace information).
 * <p>
 * The special symbols `T` and `F` are parsed as logic values.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param objs - The json object to extract the meta-information from
 *
 * @returns The parsed symbol (with populated namespace information) or `undefined` if the given object is not a symbol.
 */
export function tryNormalizeSymbol(data: ParserData, objs: NamedXmlBasedJson[]): RNode | undefined {
	guard(objs.length > 0, 'to parse symbols we need at least one object to work on!')
	parseLog.debug(`trying to parse symbol`)
	objs = executeHook(data.hooks.values.onSymbol.before, data, objs)

	let location, content, namespace

	if(objs.length === 1 && isSymbol(objs[0].name)) {
		const meta  = retrieveMetaStructure(data.config, objs[0].content)
		location    = meta.location
		content     = meta.content
		namespace   = undefined
	} else if(objs.length === 3 && isSymbol(objs[2].name)) {
		const meta  = retrieveMetaStructure(data.config, objs[2].content)
		location    = meta.location
		content     = meta.content
		namespace   = retrieveMetaStructure(data.config, objs[0].content).content
	} else {
		return executeUnknownHook(data.hooks.values.onSymbol.unknown, data, objs)
	}

	let result: RSymbol | RLogical

	if(namespace === undefined && (content === 'T' || content === 'F')) {
		result = {
			type:    Type.Logical,
			content: content === 'T',
			location,
			lexeme:  content,
			info:    {
				fullRange:        data.currentRange,
				additionalTokens: [],
				fullLexeme:       data.currentLexeme
			}
		}
	} else {
		result = {
			type:    Type.Symbol,
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
		}
	}

	return executeHook(data.hooks.values.onSymbol.after, data, result)
}
