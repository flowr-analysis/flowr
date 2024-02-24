import type { XmlBasedJson } from '../../../common/input-format'
import { tryNormalizeIfThen } from './if-then'
import { getTokenType } from '../../../common/meta'
import type { RFunctionCall } from '../../../../../model'
import { RawRType } from '../../../../../model'
import { guard } from '../../../../../../../../util/assert'
import type { NormalizeConfiguration } from '../../data'
import { normalizeSingleToken } from '../single-element'

/**
 * Try to parse the construct as a <pre> `if`(condition, then, otherwise) </pre> function call.
 */
export function tryNormalizeIfThenElse(
	config: NormalizeConfiguration,
	tokens: [
		 ifToken:    XmlBasedJson,
		 leftParen:  XmlBasedJson,
		 condition:  XmlBasedJson,
		 rightParen: XmlBasedJson,
		 then:       XmlBasedJson,
		 elseToken:  XmlBasedJson,
		 elseBlock:  XmlBasedJson
	]): RFunctionCall | undefined {
	// we start by parsing a regular if-then structure

	const parsedIfThen = tryNormalizeIfThen(config, tokens.slice(0, 5) as [XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson])
	if(parsedIfThen === undefined) {
		return undefined
	}

	guard(getTokenType(tokens[5]) === RawRType.Else, () => `expected else token for if-then-else but found ${JSON.stringify(tokens[5])}`)

	const parsedElse = normalizeSingleToken(config, tokens[6])

	return {
		...parsedIfThen,
		arguments: [...parsedIfThen.arguments, parsedElse],
	}
}
