import { XmlBasedJson } from '../../common/input-format'
import { RawRType, RNode } from '../../../../model'
import { XmlParserConfig } from '../../common/config'
import { normalizeLog } from '../normalize'
import { expensiveTrace } from '../../../../../../../util/log'
import { XML_NAME } from '../../common/xml-to-json'

/*

function normalizeMappedWithoutSemicolonBasedOnType(mappedWithName: NamedXmlBasedJson[], data: ParserData): (RNode | RDelimiter)[] {
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
*/

function handleSemicolons(tokens: XmlBasedJson[]) {
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
	return segments
}

export function normalizeExpression(
	config: XmlParserConfig,
	tokens: XmlBasedJson[]
): RNode[] {
	if(tokens.length === 0) {
		// if there are no tokens, there is no expression to parse, and we can skip it!
		return []
	}

	expensiveTrace(normalizeLog,() => `[expr] ${tokens.map(x => x[XML_NAME]).join(', ')}`)

	// iterate over types, find all semicolons, and segment the tokens based on them
	const segments = handleSemicolons(tokens)

	if(segments.length > 1) {
		normalizeLog.trace(`found ${segments.length} ';' segments`)
		return segments.flatMap(segment => normalizeExpression(config, segment))
	}

	/*
   * if splitOnSemicolon.length === 1, we can continue with the normal parsing, but we may have had a trailing semicolon, with this, it is removed as well.
   * splitOnSemicolon.length === 0 is not possible, as we would have had an empty array before, split does not add elements.
   */
	tokens = segments[0]

	console.log(tokens)
	return []
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
