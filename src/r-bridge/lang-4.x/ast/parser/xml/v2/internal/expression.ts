import type { XmlBasedJson } from '../../common/input-format'
import type { RNode } from '../../../../model'
import { RawRType, RType } from '../../../../model'
import { normalizeLog } from '../normalize'
import { expensiveTrace } from '../../../../../../../util/log'
import { XML_NAME } from '../../common/xml-to-json'
import { normalizeSingleToken } from './single-element'
import type { NormalizeConfiguration } from '../data'
import { normalizeUnary, tryNormalizeBinary } from './operators'
import { tryNormalizeSymbolWithNamespace } from './values/symbol'
import { getTokenType, retrieveMetaStructure } from '../../common/meta'
import { normalizeAccess } from './access'
import { guard } from '../../../../../../../util/assert'
import { jsonReplacer } from '../../../../../../../util/json'


/**
 * Handles semicolons within _and_ braces at the start and end of the expression
 * @param tokens - The tokens to split
 * @param config - The normalizer config to use
 */
function handleExpressionList(tokens: XmlBasedJson[], config: NormalizeConfiguration): { segments: XmlBasedJson[][], braces: undefined | [start: XmlBasedJson, end: XmlBasedJson] } {
	if(getTokenType(config.tokenMap, tokens[0]) === RawRType.BraceLeft) {
		const endType = getTokenType(config.tokenMap, tokens[tokens.length - 1])
		guard(endType === RawRType.BraceRight, () => `expected a brace at the end of the expression list as well, but ${endType} :: ${JSON.stringify(tokens[tokens.length - 1], jsonReplacer)}`)
		const nested = handleExpressionList(tokens.slice(1, tokens.length - 1), config)
		return { segments: nested.segments, braces: [tokens[0], tokens[tokens.length - 1]] }
	} else {
		let last = 0, i = 0
		const segments: XmlBasedJson[][] = []
		for(const token of tokens) {
			if(token[XML_NAME] === RawRType.Semicolon) {
				segments.push(tokens.slice(last, i++))
				last = i + 1
			}
		}
		if(last < tokens.length) {
			segments.push(tokens.slice(last, tokens.length))
		}
		return { segments: segments, braces: undefined }
	}
}


export function normalizeExpression(
	config: NormalizeConfiguration,
	tokens: XmlBasedJson[]
): RNode[] {
	if(tokens.length === 0) {
		// if there are no tokens, there is no expression to parse, and we can skip it!
		return []
	}

	expensiveTrace(normalizeLog,() => `[expr] ${tokens.map(x => x[XML_NAME]).join(', ')}`)

	if(tokens.length > 1) {
		// iterate over types, find all semicolons, and segment the tokens based on them.
		// we could potentially optimize as not all expr may have semicolons but not for now
		const { segments, braces } = handleExpressionList(tokens, config)

		if(segments.length > 1 || braces) {
			normalizeLog.trace(`found ${segments.length} ';' segments`)
			const processed = segments.flatMap(segment => normalizeExpression(config, segment))
			if(braces) {
				const { location, content } = retrieveMetaStructure(config, braces[0])
				return [{
					type:         RType.FunctionCall,
					lexeme:       content,
					flavor:       'named',
					location,
					info:         {},
					functionName: {
						type:      RType.Symbol,
						info:      {},
						lexeme:    content,
						namespace: undefined,
						content,
						location
					},
					arguments: processed
				}]
			} else {
				return processed
			}
		}

		/*
		 * if splitOnSemicolon.length === 1, we can continue with the normal parsing, but we may have had a trailing semicolon, with this, it is removed as well.
		 * splitOnSemicolon.length === 0 is not possible, as we would have had an empty array before, split does not add elements.
		 */
		tokens = segments[0]
	}

	// const types = tokens.map(x => x[XML_NAME] as string)
	return [normalizeElems(config, tokens)]
}

const todo = (...x: unknown[]) => { throw new Error('not implemented: ' + JSON.stringify(x)) }

/**
 * Parses a single structure in the ast based on its type (e.g., a constant, function call, symbol, ...)
 * @param config - The data used to normalize (see {@link NormalizeConfiguration})
 * @param tokens - The non-empty list of tokens to parse
 */
function normalizeElems(config: NormalizeConfiguration, tokens: readonly XmlBasedJson[]): RNode {
	const length = tokens.length
	if(length === 1) {
		return normalizeSingleToken(config, tokens[0])
	} else if(length === 2) {
		return normalizeUnary(config, tokens as [XmlBasedJson, XmlBasedJson])
	}
	// otherwise, before we check for fixed-length constructs we have to check for the *second* element
	// in case we have a function-call, access, ...
	const second = getTokenType(config.tokenMap, tokens[1])

	// TODO: use internal functions directly and not named if they can not be overwritten!
	switch(second) {
		case RawRType.ParenLeft:
			return todo(tokens)
		case RawRType.Dollar:
		case RawRType.At:
		case RawRType.BracketLeft:
		case RawRType.DoubleBracketLeft:
			return normalizeAccess(config, tokens, second)
	}


	switch(length) {
		case 3: // TODO: for
			return tryNormalizeSymbolWithNamespace(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson])
				?? tryNormalizeBinary(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson])
		case 5:
			return todo(tokens)
		case 7:
			return todo(tokens)
		default:
			return todo(tokens)
	}
}


/*export function parseNodesWithUnknownType(data: ParserData, mappedWithName: NamedXmlBasedJson[]): (RNode | RDelimiter)[] {
	const parsedNodes: (RNode | RDelimiter)[] = []
	// used to indicate the new root node of this set of nodes
	for(const elem of mappedWithName) {
		const retrieved = tryNormalizeSingleNode(data, elem)
		parsedNodes.push(retrieved)
	}
	return parsedNodes
}*/
