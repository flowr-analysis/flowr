import type { XmlBasedJson } from '../../../common/input-format'
import type { RFunctionDefinition, RParameter } from '../../../../../model'
import { RawRType, RType } from '../../../../../model'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import { guard, isNotUndefined } from '../../../../../../../../util/assert'
import { splitArrayOn } from '../../../../../../../../util/arrays'
import { tryNormalizeParameter } from './parameter'
import { expensiveTrace } from '../../../../../../../../util/log'
import { parseLog } from '../../../../json/parser'
import type { NormalizeConfiguration } from '../../data'
import { normalizeLog } from '../../normalize'
import { normalizeExpression } from '../expression'

/**
 * Tries to parse the given data as a function definition.
 *
 * TODO: produce a call as well
 *
 * @param config - The config used by the parser (see {@link NormalizeConfiguration})
 * @param mappedWithName - The json object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionDefinition} or `undefined` if the given construct is not a function definition
 */
export function tryNormalizeFunctionDefinition(config: NormalizeConfiguration, mappedWithName: readonly XmlBasedJson[]): RFunctionDefinition | undefined {
	const fnBase = getTokenType(mappedWithName[0])
	if(fnBase !== RawRType.Function && fnBase !== RawRType.Lambda) {
		return undefined
	}

	const { content, location } = retrieveMetaStructure(mappedWithName[0])

	const openParen = getTokenType(mappedWithName[1])
	guard(openParen === RawRType.ParenLeft, () => `expected opening parenthesis, yet received ${openParen}`)

	const closingParenIndex = mappedWithName.findIndex(x => getTokenType(x) === RawRType.ParenRight)
	guard(closingParenIndex !== -1, () => `expected closing parenthesis, yet received ${JSON.stringify(mappedWithName)}`)

	const splitParameters = splitArrayOn(mappedWithName.slice(2, closingParenIndex), x => getTokenType(x) === RawRType.Comma)

	const parameters: (undefined | RParameter)[] = splitParameters.map(x => tryNormalizeParameter(config, x))

	if(parameters.some(p => p === undefined)) {
		expensiveTrace(normalizeLog, () => `function had unexpected unknown parameters: ${JSON.stringify(parameters.filter(isNotUndefined))}, aborting.`)
		return undefined
	}

	const bodyStructure = mappedWithName.slice(closingParenIndex + 1)
	guard(bodyStructure.length === 1, () => `expected function body to be unique, yet received ${bodyStructure.length}`)

	const body = normalizeExpression(config, bodyStructure)
	guard(body.length === 1, () => `expected function body to yield one normalized expression, but ${body.length}`)


	return {
		type:       RType.FunctionDefinition,
		location,
		lexeme:     content,
		parameters: parameters as RParameter[],
		body:       body[0],
		info:       {
			additionalTokens: [],
			fullLexeme:       config.currentLexeme
		}
	}
}
