import { NamedXmlBasedJson, XmlBasedJson } from "../../input-format"
import { splitArrayOn } from "../../../../../../../util/arrays"
import { parseLog } from "../../parser"
import { getWithTokenType } from "../meta"
import { ParserData } from "../../data"
import { tryNormalizeSingleNode } from "./single-element"
import { tryNormalizeSymbol } from '../values'
import { tryNormalizeUnary, tryNormalizeBinary } from '../operators'
import {
	tryNormalizeRepeat,
	tryNormalizeFor,
	tryNormalizeWhile
} from '../loops'
import { tryNormalizeIfThenElse, tryNormalizeIfThen } from '../control'
import { Type, RNode } from '../../../../model'
import { log } from '../../../../../../../util/log'
import { normalizeComment } from '../other'

function normalizeMappedWithoutSemicolonBasedOnType(mappedWithName: NamedXmlBasedJson[], data: ParserData) {
	if (mappedWithName.length === 1) {
		const parsed = tryNormalizeSingleNode(data, mappedWithName[0])
		return parsed !== undefined ? [parsed] : []
	} else if (mappedWithName.length === 2) {
		const unaryOp = tryNormalizeUnary(
			data,
			mappedWithName[0],
			mappedWithName[1]
		)
		if (unaryOp !== undefined) {
			return [unaryOp]
		}
		const repeatLoop = tryNormalizeRepeat(
			data,
			mappedWithName[0],
			mappedWithName[1]
		)
		if (repeatLoop !== undefined) {
			return [repeatLoop]
		}
	} else if (mappedWithName.length === 3) {
		const binary = tryNormalizeBinary(
			data,
			mappedWithName[0],
			mappedWithName[1],
			mappedWithName[2]
		)
		if (binary !== undefined) {
			return [binary]
		} else {
			// TODO: maybe-monad pass through? or just use undefined (see ts-fp)
			const forLoop = tryNormalizeFor(
				data,
				mappedWithName[0],
				mappedWithName[1],
				mappedWithName[2]
			)
			if (forLoop !== undefined) {
				return [forLoop]
			} else {
				// could be a symbol with namespace information
				const symbol = tryNormalizeSymbol(data, mappedWithName)
				if (symbol !== undefined) {
					return [symbol]
				}
			}
			// TODO: try to parse symbols with namespace information
		}
	} else if (mappedWithName.length === 5) {
		const ifThen = tryNormalizeIfThen(data, [
			mappedWithName[0],
			mappedWithName[1],
			mappedWithName[2],
			mappedWithName[3],
			mappedWithName[4]
		])
		if (ifThen !== undefined) {
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
			if (whileLoop !== undefined) {
				return [whileLoop]
			}
		}
	} else if (mappedWithName.length === 7) {
		const ifThenElse = tryNormalizeIfThenElse(data, [
			mappedWithName[0],
			mappedWithName[1],
			mappedWithName[2],
			mappedWithName[3],
			mappedWithName[4],
			mappedWithName[5],
			mappedWithName[6]
		])
		if (ifThenElse !== undefined) {
			return [ifThenElse]
		}
	}

	// otherwise perform default parsing
	return parseNodesWithUnknownType(data, mappedWithName)
}

export function splitComments(mappedWithName: NamedXmlBasedJson[]) {
	const comments = []
	const others = []
	for (const elem of mappedWithName) {
		if (elem.name === Type.Comment) {
			comments.push(elem)
		} else {
			others.push(elem)
		}
	}
	return { comments, others }
}

export function normalizeBasedOnType(
	data: ParserData,
	obj: XmlBasedJson[] | NamedXmlBasedJson[]
): RNode[] {
	if (obj.length === 0) {
		parseLog.warn("no children received, skipping")
		return []
	}

	let mappedWithName: NamedXmlBasedJson[]

	if(obj[0].name) {
		mappedWithName = obj as NamedXmlBasedJson[]
	} else {
		mappedWithName = getWithTokenType(
			data.config.tokenMap,
      obj as XmlBasedJson[]
		)
	}

	log.trace(`[parseBasedOnType] names: [${mappedWithName.map(({ name }) => name).join(", ")}]`)

	const splitOnSemicolon = splitArrayOn(
		mappedWithName,
		({ name }) => name === Type.Semicolon
	)

	if (splitOnSemicolon.length > 1) {
		// TODO: check if non-wrapping expr list is correct
		log.trace(`found ${splitOnSemicolon.length} expressions by semicolon-split, parsing them separately`)
		const flattened = []
		for (const sub of splitOnSemicolon) {
			const result = normalizeBasedOnType(data, sub)
			if(result.length === 1 && result[0].type === Type.ExpressionList) {
				flattened.push(...result[0].children)
			} else {
				flattened.push(...result)
			}
		}
		return flattened
	}

	/*
   * if splitOnSemicolon.length === 1, we can continue with the normal parsing, but we may have had a trailing semicolon, with this, it is removed as well.
   * splitOnSemicolon.length === 0 is not possible, as we would have had an empty array before, split does not add elements.
   */
	mappedWithName = splitOnSemicolon[0]
	const { comments, others } = splitComments(mappedWithName)

	const parsedComments = comments.map(c => normalizeComment(data, c.content))

	const result = normalizeMappedWithoutSemicolonBasedOnType(others, data)
	// we hoist comments
	return [...parsedComments, ...result]
}

export function parseNodesWithUnknownType(data: ParserData, mappedWithName: NamedXmlBasedJson[]) {
	const parsedNodes: RNode[] = []
	// used to indicate the new root node of this set of nodes
	// TODO: refactor?
	// TODO: allow to configure #name
	for (const elem of mappedWithName) {
		const retrieved = tryNormalizeSingleNode(data, elem)
		if (retrieved !== undefined) {
			parsedNodes.push(retrieved)
		}
	}
	return parsedNodes
}
