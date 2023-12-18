import { XmlBasedJson } from '../../common/input-format'
import { RawRType, RNode } from '../../../../model'
import { normalizeLog } from '../normalize'
import { expensiveTrace } from '../../../../../../../util/log'
import { XML_NAME } from '../../common/xml-to-json'
import { normalizeSingleNode } from './single-element'
import { NormalizeConfiguration } from '../data'
import { normalizeUnary } from './operators'
import { tryNormalizeSymbolWithNamespace } from './values/symbol'
import { tryNormalizeBinary } from './operators/binary'

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

function normalizeElems(config: NormalizeConfiguration, tokens: readonly XmlBasedJson[]): RNode {
	switch(tokens.length) {
		case 1:
			return normalizeSingleNode(config, tokens[0])
		case 2: // TODO: repeat
			return normalizeUnary(config, tokens as [XmlBasedJson, XmlBasedJson])
		case 3: // TODO: for
			return tryNormalizeSymbolWithNamespace(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson]) ?? tryNormalizeBinary(config, tokens as [XmlBasedJson, XmlBasedJson, XmlBasedJson])
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
