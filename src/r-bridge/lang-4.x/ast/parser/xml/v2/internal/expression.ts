import type { XmlBasedJson } from '../../common/input-format'
import type { RComment, RNode } from '../../../../model'
import { RawRType, RType } from '../../../../model'
import { normalizeLog } from '../normalize'
import { expensiveTrace } from '../../../../../../../util/log'
import { normalizeSingleToken } from './single-element'
import type { NormalizeConfiguration } from '../data'
import { normalizeBinary, normalizeUnary } from './operators'
import { tryNormalizeSymbolWithNamespace } from './values/symbol'
import { getTokenType, retrieveMetaStructure } from '../../common/meta'
import { normalizeAccess } from './access'
import { guard } from '../../../../../../../util/assert'
import { jsonReplacer } from '../../../../../../../util/json'
import { tryNormalizeIfThen } from './control/if-then'
import { tryNormalizeIfThenElse } from './control/if-then-else'
import { tryNormalizeFor } from './loops/for'
import { tryNormalizeFunctionCall } from './functions/function-call'
import { tryNormalizeFunctionDefinition } from './functions/function-definition'
import { normalizeComment } from './other'

interface HandledExpressionList {
	segments: XmlBasedJson[][]
	comments: XmlBasedJson[]
	braces:   undefined | [start: XmlBasedJson, end: XmlBasedJson]
}

function splitComments(tokens: readonly XmlBasedJson[]) {
	const comments = []
	const others = []
	for(const elem of tokens) {
		if(getTokenType(elem) === RawRType.Comment) {
			comments.push(elem)
		} else {
			others.push(elem)
		}
	}
	return { comments, others }
}


function splitExprs(tokens: readonly XmlBasedJson[]) {
	let last = 0, i = 0
	let lastExpr = false
	const segments: XmlBasedJson[][] = []
	const types = tokens.map(getTokenType)
	for(const type of types) {
		if(type === RawRType.Semicolon) {
			segments.push(tokens.slice(last, i))
			lastExpr = false
			last = i + 1
		} else {
			const thisExpr = type === RawRType.Expression || type === RawRType.ExprOfAssignOrHelp
			if(thisExpr && lastExpr) {
				if(i > last) {
					segments.push(tokens.slice(last, i))
				}
				segments.push([tokens[i]])
				last = i + 1
			}
			lastExpr = thisExpr
		}
		i++
	}
	if(last < tokens.length) {
		segments.push(tokens.slice(last, tokens.length))
	}
	return segments
}

/**
 * Handles semicolons within _and_ braces at the start and end of the expression
 * @param raw - The tokens to split
 */
function handleExpressionList(raw: readonly XmlBasedJson[]): HandledExpressionList {
	if(raw.length === 0) {
		return { segments: [], comments: [], braces: undefined }
	}
	const { comments, others: tokens } = splitComments(raw)
	const first = getTokenType(tokens[0])
	if(first === RawRType.BraceLeft) {
		const endType = getTokenType(tokens[tokens.length - 1])
		guard(endType === RawRType.BraceRight, () => `expected a brace at the end of the expression list as well, but ${endType} :: ${JSON.stringify(tokens[tokens.length - 1], jsonReplacer)}`)
		return {
			segments: [tokens.slice(1, tokens.length - 1)],
			comments,
			braces:   [tokens[0], tokens[tokens.length - 1]]
		}
	} else if(first === RawRType.ParenLeft) {
		const endType = getTokenType(tokens[tokens.length - 1])
		guard(endType === RawRType.ParenRight, () => `expected a parenthesis at the end of the expression list as well, but ${endType} :: ${JSON.stringify(tokens[tokens.length - 1], jsonReplacer)}`)
		return {
			segments: [tokens.slice(1, tokens.length - 1)],
			comments,
			braces:   [tokens[0], tokens[tokens.length - 1]]
		}
	} else {
		return { segments: splitExprs(tokens), comments, braces: undefined }
	}
}


function processBraces(braces: [start: XmlBasedJson, end: XmlBasedJson], processed: RNode[], comments: RComment[]) : [RNode] {
	const { location, content } = retrieveMetaStructure(braces[0])
	return [{
		type:   RType.FunctionCall,
		lexeme: content,
		flavor: 'named',
		location,
		info:   {
			additionalTokens: comments,
		},
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
}

export function normalizeExpression(
	config: NormalizeConfiguration,
	tokens: readonly XmlBasedJson[]
): RNode[] {
	if(tokens.length === 0) {
		// if there are no tokens, there is no expression to parse, and we can skip it!
		return []
	}

	expensiveTrace(normalizeLog,() => `[expr] ${tokens.map(t => getTokenType(t) + ' - ' + retrieveMetaStructure(t).content).join(', ')}`)

	let parsedComments: RComment[] = []

	if(tokens.length > 1) {
		// iterate over types, find all semicolons, and segment the tokens based on them.
		// we could potentially optimize as not all expr may have semicolons but not for now
		const { segments, braces, comments } = handleExpressionList(tokens)
		parsedComments = comments.map(c => normalizeComment(config, c))

		if(segments.length > 1 || braces) {
			const processed = segments.flatMap(s => normalizeExpression(config, s))
			if(braces) {
				return processBraces(braces, processed, parsedComments)
			} else if(processed.length > 0) {
				if(parsedComments) {
					processed[0].info.additionalTokens ??= []
					processed[0].info.additionalTokens.push(...parsedComments)
				}
				return processed
			} else {
				return parsedComments
			}
		}

		/*
		 * if splitOnSemicolon.length === 1, we can continue with the normal parsing, but we may have had a trailing semicolon, with this, it is removed as well.
		 * splitOnSemicolon.length === 0 is not possible, as we would have had an empty array before, split does not add elements.
		 */
		tokens = segments[0]
	}

	const elem = tryNormalizeElems(config, tokens)
	if(parsedComments) {
		elem.info.additionalTokens ??= []
		elem.info.additionalTokens.push(...parsedComments)
	}
	return [elem]
}

const todo = (...x: unknown[]) => {
	throw new Error('not implemented: ' + JSON.stringify(x))
}

/**
 * Parses a single structure in the ast based on its type (e.g., a constant, function call, symbol, ...)
 * @param config - The data used to normalize (see {@link NormalizeConfiguration})
 * @param tokens - The non-empty list of tokens to parse
 *
 * @returns The parsed structure or undefined if the structure could not be parsed
 */
function tryNormalizeElems(config: NormalizeConfiguration, tokens: readonly XmlBasedJson[]): RNode {
	const length = tokens.length
	if(length === 1) {
		const res = normalizeSingleToken(config, tokens[0])
		guard(res !== undefined, () => `expected to parse a single token, but received undefined for ${JSON.stringify(tokens[0])}`)
		return res
	} else if(length === 2) {
		const unary = normalizeUnary(config, tokens as [XmlBasedJson, XmlBasedJson])
		if(unary !== undefined) {
			return unary
		}
	}

	const ret = tryNormalizeFunctionCall(config, tokens) ?? tryNormalizeFunctionDefinition(config, tokens)
	if(ret !== undefined) {
		return ret
	}

	// otherwise, before we check for fixed-length constructs we have to check for the *second* element
	// in case we have a function-call, access, ...
	const second = getTokenType(tokens[1])

	switch(second) {
		case RawRType.Dollar:
		case RawRType.At:
		case RawRType.BracketLeft:
		case RawRType.DoubleBracketLeft:
			return normalizeAccess(config, tokens, second)
	}

	switch(length) {
		case 3:
			return tryNormalizeSymbolWithNamespace(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson])
				?? tryNormalizeFor(config, tokens[0], tokens[1], tokens[2])
				?? normalizeBinary(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson])
		case 5: // TODO: while
			return tryNormalizeIfThen(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson]) ?? todo(tokens)
		case 7: // TODO: other cases?
			return tryNormalizeIfThenElse(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson, XmlBasedJson]) ?? todo(tokens)
		default:
			return todo(tokens)
	}
}
