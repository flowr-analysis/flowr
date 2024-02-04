import type { XmlBasedJson } from '../../common/input-format'
import type { RNode } from '../../../../model'
import { RawRType } from '../../../../model'
import { normalizeLog } from '../normalize'
import { expensiveTrace } from '../../../../../../../util/log'
import { XML_NAME } from '../../common/xml-to-json'
import { normalizeSingleToken } from './single-element'
import type { NormalizeConfiguration } from '../data'
import { normalizeUnary, tryNormalizeBinary } from './operators'
import { tryNormalizeSymbolWithNamespace } from './values/symbol'
import { getTokenType } from '../../common/meta'
import { normalizeAccess } from './access'

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


// TODO: guard with and without semicolon?
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
