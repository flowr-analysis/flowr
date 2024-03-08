import type { ParserData } from '../../data'
import type { NamedXmlBasedJson } from '../../input-format'
import type {
	RNode, RUnaryOp
} from '../../../../model'
import {
	RType,
	GroupingOperatorsInRAst
} from '../../../../model'
import { normalizeDelimiter, tryNormalizeSingleNode } from '../structure'
import { retrieveMetaStructure, retrieveOpName } from '../../meta'
import { guard } from '../../../../../../../util/assert'


/**
 * Parses the construct as a {@link RUnaryOp}.
 *
 * @param data   - The data used by the parser (see {@link ParserData})
 * @param tokens - All tokens given
 *
 * @returns The parsed {@link RUnaryOp} or `undefined` if the given construct is not a group
 */
export function tryNormalizeGroup(data: ParserData, tokens: [start: NamedXmlBasedJson, obj: NamedXmlBasedJson, end: NamedXmlBasedJson]): RNode | undefined {
	if(GroupingOperatorsInRAst.has(tokens[0].name)) {
		return parseGroup(data, tokens)
	} else {
		return undefined
	}
}

function parseGroup(data: ParserData, [start, obj, end]: [start: NamedXmlBasedJson, obj: NamedXmlBasedJson, end: NamedXmlBasedJson]): RUnaryOp {
	const parseObj = tryNormalizeSingleNode(data, obj)

	guard(parseObj.type !== RType.Delimiter, () => 'unexpected under-sided unary op')

	const operationName = retrieveOpName(start)
	const { location, content } = retrieveMetaStructure(start.content)

	const endDelim = normalizeDelimiter(data, end)

	return {
		type:     RType.UnaryOp,
		location,
		operator: operationName,
		lexeme:   content,
		operand:  parseObj,
		info:     {
			fullRange:        data.currentRange,
			additionalTokens: [endDelim],
			fullLexeme:       data.currentLexeme
		}
	}
}
