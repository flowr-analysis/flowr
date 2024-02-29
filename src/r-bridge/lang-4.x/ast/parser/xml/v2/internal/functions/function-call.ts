import type { XmlBasedJson } from '../../../common/input-format'
import { childrenKey, getKeyGuarded } from '../../../common/input-format'
import { guard } from '../../../../../../../../util/assert'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import { splitArrayOn } from '../../../../../../../../util/arrays'
import type {
	RNode,
	RFunctionCall,
	RUnnamedFunctionCall,
	RNamedFunctionCall, RSymbol, RString } from '../../../../../model'
import { EmptyArgument
} from '../../../../../model'
import {
	RType, RawRType
} from '../../../../../model'
import { tryToNormalizeArgument } from './argument'
import type { SourceRange } from '../../../../../../../../util/range'
import { parseLog } from '../../../../json/parser'
import type { NormalizeConfiguration } from '../../data'
import { expensiveTrace } from '../../../../../../../../util/log'
import { normalizeLog } from '../../normalize'
import { normalizeExpression } from '../expression'

/**
 * Tries to parse the given data as a function call.
 *
 * @param config - The config used by the parser (see {@link NormalizeConfiguration})
 * @param tokens - The json object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionCall} (either named or unnamed) or `undefined` if the given construct is not a function call.
 */
export function tryNormalizeFunctionCall(config: NormalizeConfiguration, tokens: readonly XmlBasedJson[]): RFunctionCall | undefined {
	const first = getTokenType(tokens[0])
	if(first !== RawRType.Expression && first !== RawRType.ExprOfAssignOrHelp) {
		parseLog.trace(`expected function call name to be wrapped an expression, yet received ${first}`)
		return undefined
	}

	if(tokens.length < 3 || getTokenType(tokens[1]) !== RawRType.ParenLeft || getTokenType(tokens[tokens.length - 1]) !== RawRType.ParenRight) {
		parseLog.trace('expected function call to have parenthesis for a call, but was not')
		return undefined
	}

	const { unwrappedObj, content, location } = retrieveMetaStructure(tokens[0])
	const symbolContent: XmlBasedJson[] = getKeyGuarded(unwrappedObj, childrenKey)

	const symbols = normalizeExpression(config, symbolContent)
	if(symbols.length !== 1) {
		parseLog.trace(`expected exactly one symbol, but received ${symbols.length}`)
		return undefined
	}
	const symbol = symbols[0]

	let result: RFunctionCall

	if(symbolContent.length === 1 && symbol.type === RType.String) {
		// special handling when someone calls a function by string
		result = parseNamedFunctionCall(config, symbol, tokens, location, content)
	} else if(symbol.type !== RType.Symbol) {
		expensiveTrace(normalizeLog, () => `is not named function call, as the name is not of type ${RType.Symbol}, but: ${symbolContent.map(getTokenType).join(',')}`)
		const mayResult = tryParseUnnamedFunctionCall(config, symbol, tokens, location, content)
		if(mayResult === undefined) {
			return undefined
		}
		result = mayResult
	} else {
		result = parseNamedFunctionCall(config, symbol, tokens, location, content)
	}

	return result
}

function parseArguments(tokens: readonly XmlBasedJson[], config: NormalizeConfiguration): (RNode | undefined)[] {
	const argContainer = tokens.slice(1)
	guard(argContainer.length > 1 && getTokenType(argContainer[0]) === RawRType.ParenLeft && getTokenType(argContainer[argContainer.length - 1]) === RawRType.ParenRight, 'expected args in parenthesis')
	const splitArgumentsOnComma = splitArrayOn(argContainer.slice(1, argContainer.length - 1), x => getTokenType(x) === RawRType.Comma)
	return splitArgumentsOnComma.map(x => {
		parseLog.trace('trying to parse argument')
		return tryToNormalizeArgument(config, x)
	})
}

function tryParseUnnamedFunctionCall(config: NormalizeConfiguration, calledFunction: RNode, tokens: readonly XmlBasedJson[], location: SourceRange, content: string): RUnnamedFunctionCall | undefined {
	const parsedArguments = parseArguments(tokens, config)

	return {
		type:           RType.FunctionCall,
		flavor:         'unnamed',
		location,
		lexeme:         content,
		calledFunction: calledFunction,
		arguments:      parsedArguments.map(x => x ?? EmptyArgument),
		info:           {
			additionalTokens: [],
			fullLexeme:       config.currentLexeme
		}
	}
}


function parseNamedFunctionCall(
	config: NormalizeConfiguration,
	symbol: RSymbol | RString,
	tokens: readonly XmlBasedJson[],
	location: SourceRange,
	content: string
): RNamedFunctionCall {
	let functionName: RNode | undefined
	if(symbol.type === RType.String) {
		functionName = {
			type:      RType.Symbol,
			namespace: undefined,
			lexeme:    symbol.lexeme,
			info:      symbol.info,
			location:  symbol.location,
			content:   symbol.content.str
		}
	} else {
		functionName = symbol
	}
	guard(functionName?.type === RType.Symbol, () => `expected function name to be a symbol, yet received ${JSON.stringify(functionName)}`)

	const parsedArguments = parseArguments(tokens, config)

	return {
		type:      RType.FunctionCall,
		flavor:    'named',
		location,
		lexeme:    content,
		functionName,
		arguments: parsedArguments.map(x => x ?? EmptyArgument),
		info:      {
			additionalTokens: [],
			fullLexeme:       config.currentLexeme
		}
	}
}
