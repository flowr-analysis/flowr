import type { NamedXmlBasedJson, XmlBasedJson } from '../../input-format'
import type { ParserData } from '../../data'
import type { RComment, RExpressionList, RNode } from '../../../../model'
import { RawRType, RType } from '../../../../model'
import type { RDelimiter } from '../../../../model/nodes/info'
import { normalizeDelimiter, tryNormalizeSingleNode } from './single-element'
import { tryNormalizeBinary, tryNormalizeUnary } from '../operators'
import { tryNormalizeFor, tryNormalizeRepeat, tryNormalizeWhile } from '../loops'
import { tryNormalizeSymbol } from '../values'
import { tryNormalizeIfThen, tryNormalizeIfThenElse } from '../control'
import { parseLog } from '../../../json/parser'
import { getWithTokenType } from '../../meta'
import { expensiveTrace, log } from '../../../../../../../util/log'
import { normalizeComment } from '../other'
import { guard } from '../../../../../../../util/assert'
import { jsonReplacer } from '../../../../../../../util/json'
import { normalizeExpression } from '../expression'

function normalizeMappedWithoutSemicolonBasedOnType(mappedWithName: readonly NamedXmlBasedJson[], data: ParserData): (RNode | RDelimiter)[] {
	if(mappedWithName.length === 1) {
		return [tryNormalizeSingleNode(data, mappedWithName[0])]
	} else if(mappedWithName.length === 2) {
		const unaryOp = tryNormalizeUnary(
			data,
			mappedWithName[0],
			mappedWithName[1]
		)
		if(unaryOp !== undefined) {
			return [unaryOp]
		}
		const repeatLoop = tryNormalizeRepeat(
			data,
			mappedWithName[0],
			mappedWithName[1]
		)
		if(repeatLoop !== undefined) {
			return [repeatLoop]
		}
	} else if(mappedWithName.length === 3) {
		const binary = tryNormalizeBinary(
			data,
			mappedWithName[0],
			mappedWithName[1],
			mappedWithName[2]
		)
		if(binary !== undefined) {
			return [binary]
		} else {
			const forLoop = tryNormalizeFor(
				data,
				mappedWithName[0],
				mappedWithName[1],
				mappedWithName[2]
			)
			if(forLoop !== undefined) {
				return [forLoop]
			} else {
				// could be a symbol with namespace information
				const symbol = tryNormalizeSymbol(data, mappedWithName)
				if(symbol !== undefined) {
					return [symbol]
				}
			}
		}
	} else if(mappedWithName.length === 5) {
		const ifThen = tryNormalizeIfThen(data, [
			mappedWithName[0],
			mappedWithName[1],
			mappedWithName[2],
			mappedWithName[3],
			mappedWithName[4]
		])
		if(ifThen !== undefined) {
			return [ifThen]
		} else {
			const whileLoop = tryNormalizeWhile(
				data,
				mappedWithName[0],
				mappedWithName[1],
				mappedWithName[2],
				mappedWithName[3],
				mappedWithName[4]
			)
			if(whileLoop !== undefined) {
				return [whileLoop]
			}
		}
	} else if(mappedWithName.length === 7) {
		const ifThenElse = tryNormalizeIfThenElse(data, [
			mappedWithName[0],
			mappedWithName[1],
			mappedWithName[2],
			mappedWithName[3],
			mappedWithName[4],
			mappedWithName[5],
			mappedWithName[6]
		])
		if(ifThenElse !== undefined) {
			return [ifThenElse]
		}
	}

	// otherwise perform default parsing
	return parseNodesWithUnknownType(data, mappedWithName)
}

interface HandledExpressionList {
	segments: readonly NamedXmlBasedJson[][]
	comments: readonly NamedXmlBasedJson[]
	braces:   undefined | [start: NamedXmlBasedJson, end: NamedXmlBasedJson]
}

export function splitComments(tokens: readonly NamedXmlBasedJson[]) {
	const comments = []
	const others = []
	for(const elem of tokens) {
		if(elem.name === RawRType.Comment) {
			comments.push(elem)
		} else {
			others.push(elem)
		}
	}
	return { comments, others }
}


function splitExprs(tokens: readonly NamedXmlBasedJson[]) {
	let last = 0, i = 0
	let lastExpr = false
	const segments: NamedXmlBasedJson[][] = []
	for(const token of tokens) {
		if(token.name === RawRType.Semicolon) {
			segments.push(tokens.slice(last, i))
			lastExpr = false
			last = i + 1
		} else {
			const thisExpr = token.name === RawRType.Expression || token.name === RawRType.ExprOfAssignOrHelp
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
function handleExpressionList(raw: readonly NamedXmlBasedJson[]): HandledExpressionList {
	if(raw.length === 0) {
		return { segments: [], comments: [], braces: undefined }
	}
	const { comments, others: tokens } = splitComments(raw)
	const first = tokens[0].name
	if(first === RawRType.BraceLeft) {
		const endType = tokens[tokens.length - 1].name
		guard(endType === RawRType.BraceRight, () => `expected a brace at the end of the expression list as well, but ${endType} :: ${JSON.stringify(tokens[tokens.length - 1], jsonReplacer)}`)
		return {
			segments: [tokens.slice(1, tokens.length - 1)],
			comments,
			braces:   [tokens[0], tokens[tokens.length - 1]]
		}
	} else if(first === RawRType.ParenLeft) {
		const endType = tokens[tokens.length - 1].name
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


function processBraces([start, end]: [start: NamedXmlBasedJson, end: NamedXmlBasedJson], processed: readonly RNode[], comments: RComment[]) : RExpressionList {
	return {
		type:     RType.ExpressionList,
		children: processed,
		braces:   [ normalizeDelimiter(start), normalizeDelimiter(end) ],
		lexeme:   undefined,
		info:     {
			additionalTokens: comments,
		}
	}

}

export function normalizeElements(
	data: ParserData,
	tokens: readonly XmlBasedJson[] | readonly NamedXmlBasedJson[]
): (RNode | RDelimiter)[] {
	if(tokens.length === 0) {
		parseLog.warn('no children received, skipping')
		return []
	}

	let mappedWithName = tokens[0].name ? tokens as readonly NamedXmlBasedJson[] : getWithTokenType(tokens as XmlBasedJson[])

	expensiveTrace(log, () => `[parseBasedOnType] names: [${mappedWithName.map(({ name }) => name).join(', ')}]`)

	let parsedComments: RComment[] = []

	if(mappedWithName.length > 1) {
		// iterate over types, find all semicolons, and segment the tokens based on them.
		// we could potentially optimize as not all expr may have semicolons but not for now
		const { segments, braces, comments } = handleExpressionList(mappedWithName)
		parsedComments = comments.map(c => normalizeComment(data, c.content))

		if(segments.length > 1 || braces) {
			const processed = segments.flatMap(xs => xs.map(s => normalizeExpression(data, s.content)))
			if(braces) {
				return [processBraces(braces, processed, parsedComments)]
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
		mappedWithName = segments[0]
	}


	return [...parsedComments, ...normalizeMappedWithoutSemicolonBasedOnType(mappedWithName, data)]
}

export function parseNodesWithUnknownType(data: ParserData, mappedWithName: readonly NamedXmlBasedJson[]): (RNode | RDelimiter)[] {
	const parsedNodes: (RNode | RDelimiter)[] = []
	// used to indicate the new root node of this set of nodes
	for(const elem of mappedWithName) {
		const retrieved = tryNormalizeSingleNode(data, elem)
		parsedNodes.push(retrieved)
	}
	return parsedNodes
}
