import type { XmlBasedJson } from '../../common/input-format'
import { childrenKey, contentKey, getKeyGuarded, XmlParseError } from '../../common/input-format'
import type { RNode } from '../../../../model'
import { RawRType } from '../../../../model'
import type { NormalizeConfiguration } from '../data'
import { normalizeExpression } from './expression'
import { normalizeNumber } from './values'
import { normalizeString } from './values/string'
import { tryNormalizeSymbolNoNamespace } from './values/symbol'
import { guard } from '../../../../../../../util/assert'
import { normalizeComment } from './other'
import { normalizeLineDirective } from './other/line-directive'
import { getTokenType } from '../../common/meta'
import { normalizeNextAndBreak } from './loops/next-break'

const SingleTokenHandler: Partial<Record<RawRType, typeof normalizeSingleToken>>  = {
	[RawRType.NumericConst]:       normalizeNumber,
	[RawRType.StringConst]:        normalizeString,
	[RawRType.ParenLeft]:          () => undefined,
	[RawRType.ParenRight]:         () => undefined,
	[RawRType.Comment]:            normalizeComment,
	[RawRType.LineDirective]:      normalizeLineDirective,
	[RawRType.ExpressionList]:     normalizeExpressionList,
	[RawRType.Expression]:         normalizeExpressionList,
	[RawRType.ExprOfAssignOrHelp]: normalizeExpressionList,
	[RawRType.Break]:              normalizeNextAndBreak,
	[RawRType.Next]:               normalizeNextAndBreak,
	[RawRType.SymbolFunctionCall]: tryNormalizeSymbolNoNamespace,
	[RawRType.Symbol]:             tryNormalizeSymbolNoNamespace,
	[RawRType.Slot]:               tryNormalizeSymbolNoNamespace,
	[RawRType.NullConst]:          tryNormalizeSymbolNoNamespace
}

function normalizeExpressionList(config: NormalizeConfiguration, token: XmlBasedJson): RNode {
	config.currentLexeme = token[contentKey] as string
	const res = normalizeExpression(config, getKeyGuarded(token, childrenKey))
	guard(res.length === 1, () => `expected only one element in the expression list, yet received ${JSON.stringify(res)}`)
	return res[0]
}

/**
 * Parses a single structure in the ast based on its type (e.g., a string, a number, a symbol, ...)
 *
 * @param config - The data used by the parser (see {@link ParserData})
 * @param token  - The element to parse
 *
 * @returns The parsed element as an `RNode` or an `RDelimiter` if it is such.
 */
export function normalizeSingleToken(config: NormalizeConfiguration, token: XmlBasedJson): RNode | undefined {
	const name = getTokenType(token)
	const handler = SingleTokenHandler[name]
	if(handler === undefined) {
		throw new XmlParseError(`unknown token type: ${name}`)
	}
	return handler(config, token)
}
