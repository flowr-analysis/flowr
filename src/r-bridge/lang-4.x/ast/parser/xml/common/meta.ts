import {
	getKeyGuarded,
	NamedXmlBasedJson,
	XmlBasedJson,
	XmlParseError
} from './input-format'
import { rangeFrom, rangeStartsCompletelyBefore, SourceRange } from '../../../../../../util/range'
import { XmlParserConfig } from './config'
import { RawRType, RExpressionList, RNode, RType } from '../../../model'
import { guard } from '../../../../../../util/assert'
import { XML_NAME } from './xml-to-json'

/**
 * if the passed object is an array with only one element, remove the array wrapper
 */
export function objectWithArrUnwrap(obj: XmlBasedJson[] | XmlBasedJson): XmlBasedJson {
	if(Array.isArray(obj)) {
		if(obj.length !== 1) {
			throw new XmlParseError(`expected only one element in the wrapped array, yet received ${JSON.stringify(obj)}`)
		}
		return obj[0]
	} else if(typeof obj === 'object') {
		return obj
	} else {
		throw new XmlParseError(`expected array or object, yet received ${JSON.stringify(obj)}`)
	}
}

/**
 * given a xml element, extract the source location of the corresponding element in the R-ast
 */
export function extractLocation(ast: XmlBasedJson): SourceRange {
	return rangeFrom(
		ast['line1'] as string,
		ast['col1'] as string,
		ast['line2'] as string,
		ast['col2'] as string
	)
}

/**
 * The json object that represents the input xml contains various meta-information.
 * This function extracts the meta-information and returns it.
 *
 * @param config - The configuration of the parser to use to retrieve the corresponding name fields
 * @param obj    - The json object to extract the meta-information from
 */
export function retrieveMetaStructure(config: XmlParserConfig, obj: XmlBasedJson): {
	/** the obj passed in, but potentially without surrounding array wrappers (see {@link objectWithArrUnwrap}) */
	unwrappedObj: XmlBasedJson
	/** location information of the corresponding R-ast element */
	location:     SourceRange
	content:      string
} {
	const unwrappedObj = objectWithArrUnwrap(obj)
	const attributes = obj[config.attr] as XmlBasedJson | undefined
	guard(attributes !== undefined, () => `expected attributes to be defined for ${JSON.stringify(obj)}`)
	const content = obj[config.content] as string | undefined ?? ''
	const location = extractLocation(attributes)
	return {
		unwrappedObj,
		location,
		content
	}
}

export function revertTokenReplacement(tokenMap: XmlParserConfig['tokenMap'], token: string): string {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- it is still necessary as we do not know if we have a replacement for the given token
	return tokenMap[token] ?? token
}

export function assureTokenType(tokenMap: XmlParserConfig['tokenMap'], obj: XmlBasedJson, expectedName: RawRType): void {
	const name = getTokenType(tokenMap, obj)
	if(name !== expectedName) {
		throw new XmlParseError(`expected name to be ${expectedName}, yet received ${name} for ${JSON.stringify(obj)}`)
	}
}

/**
 * Extract the token-type of the given object. This is based on the knowledge, that all json objects created
 * from the R xml have a name attached.
 *
 * @param tokenMap - used to revert token types (i.e., revert `xmlparsedata`)
 * @param content  - the json object to extract the token-type from
 */
export function getTokenType(tokenMap: XmlParserConfig['tokenMap'], content: XmlBasedJson): RawRType {
	return revertTokenReplacement(tokenMap, getKeyGuarded(content, XML_NAME)) as RawRType
}

export function getWithTokenType(tokenMap: XmlParserConfig['tokenMap'], obj: XmlBasedJson[]) {
	return obj.map(content => ({
		name: getTokenType(tokenMap, content),
		content
	}))
}

export function retrieveOpName(config: XmlParserConfig, operator: NamedXmlBasedJson): string {
	/*
   * only real arithmetic ops have their operation as their own name, the others identify via content
   */
	return operator.content[config.content] as string
}

/**
 * Ensure that the first child is completely before the second child.
 *
 * @param config - the configuration of the parser to use to retrieve the corresponding name fields
 * @param first  - the first child which should be the lhs
 * @param second - the second child which should be the rhs
 */
export function ensureChildrenAreLhsAndRhsOrdered(config: XmlParserConfig, first: XmlBasedJson, second: XmlBasedJson): void {
	const firstOtherLoc = extractLocation(first[config.attr] as XmlBasedJson)
	const secondOtherLoc = extractLocation(second[config.attr] as XmlBasedJson)
	if(!rangeStartsCompletelyBefore(firstOtherLoc, secondOtherLoc)) {
		throw new XmlParseError(`expected the first child to be the lhs, yet received ${JSON.stringify(first)} & ${JSON.stringify(second)}`)
	}
}

export function ensureExpressionList<Info>(node: RNode<Info>): RExpressionList<Info> {
	if(node.type !== RType.ExpressionList) {
		return {
			type:     RType.ExpressionList,
			location: node.location,
			info:     node.info,
			lexeme:   undefined,
			children: [node]
		}
	}
	return node
}
