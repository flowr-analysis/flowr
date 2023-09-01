import {
	DEFAULT_XML_PARSER_CONFIG,
	getKeysGuarded,
	requestFromInput,
	Type,
	XmlBasedJson,
	XmlParserConfig
} from '../../../r-bridge'
import {
	extractLocation,
	getTokenType,
	objectWithArrUnwrap,
	xlm2jsonObject
} from '../../../r-bridge/lang-4.x/ast/parser/xml/internal'
import { FontStyles, formatter } from '../../../statistics'
import { ReplCommand } from './main'
import { SteppingSlicer } from '../../../core'
import { deepMergeObject } from '../../../util/objects'

type DepthList =  { depth: number, node: XmlBasedJson, leaf: boolean }[]

function toDepthMap(xml: XmlBasedJson, config: XmlParserConfig): DepthList {
	const root = getKeysGuarded<XmlBasedJson>(xml, Type.ExpressionList)
	const visit = [ { depth: 0, node: root } ]
	const result: DepthList = []

	while(visit.length > 0) {
		const current = visit.pop()
		if(current === undefined) {
			continue
		}

		const children = current.node[config.childrenName] as XmlBasedJson[] | undefined ?? []
		result.push({ ...current, leaf: children.length === 0 })
		children.reverse()

		const nextDepth = current.depth + 1

		visit.push(...children.map(c => ({ depth: nextDepth, node: c })))
	}
	return result
}

function lastElementInNesting(i: number, list: Readonly<DepthList>, depth: number): boolean {
	for(let j = i + 1; j < list.length; j++) {
		if(list[j].depth < depth) {
			return true
		}
		if(list[j].depth === depth) {
			return false
		}
	}
	// only more deeply nested come after
	return true
}


function initialIndentation(i: number, depth: number, deadDepths: Set<number>, nextDepth: number, list: Readonly<DepthList>): string {
	let result = `${i === 0 ? '' : '\n'}${formatter.getFormatString({ style: FontStyles.faint })}`
	// we know there never is something on the same level as the expression list
	for(let d = 1; d < depth; d++) {
		result += deadDepths.has(d) ? '  ' : '│ '
	}

	if(nextDepth < depth) {
		result += `╰ `
	} else if(i > 0) {
		// check if we are maybe the last one with this depth until someone with a lower depth comes around
		const isLast = lastElementInNesting(i, list, depth)
		result += isLast ? '╰ ' : '├ '
		if(isLast) {
			deadDepths.add(depth)
		}
	}
	return result
}

function retrieveLocationString(locationRaw: XmlBasedJson) {
	const extracted = extractLocation(locationRaw)
	if(extracted.start.line === extracted.end.line && extracted.start.column === extracted.end.column) {
		return ` (${extracted.start.line}:${extracted.start.column})`
	} else {
		return ` (${extracted.start.line}:${extracted.start.column}─${extracted.end.line}:${extracted.end.column})`
	}
}

function depthListToTextTree(list: Readonly<DepthList>, config: XmlParserConfig): string {
	let result = ''

	const deadDepths = new Set<number>()
	let i = 0
	for(const { depth, node, leaf } of list) {
		const nextDepth = i + 1 < list.length ? list[i + 1].depth : 0

		deadDepths.delete(depth)
		result += initialIndentation(i, depth, deadDepths, nextDepth, list)

		result += formatter.reset()

		const raw = objectWithArrUnwrap(node)
		const content = raw[config.contentName] as string | undefined
		const locationRaw = raw[config.attributeName] as XmlBasedJson | undefined
		let location = ''
		if(locationRaw !== undefined) {
			location = retrieveLocationString(locationRaw)
		}

		const type = getTokenType(config.tokenMap, node)

		if(leaf) {
			const suffix = `${formatter.format(content ? JSON.stringify(content) : '', { style: FontStyles.bold })}${formatter.format(location, { style: FontStyles.italic })}`
			result += `${type} ${suffix}`
		} else {
			result += formatter.format(type, { style: FontStyles.bold })
		}

		i ++
	}
	return result
}


export const parseCommand: ReplCommand = {
	description:  'Prints ASCII Art of the parsed, unmodified AST. Start with \'file://\' to indicate a file path',
	usageExample: ':parse',
	aliases:      [ 'p' ],
	script:       false,
	fn:           async(shell, tokenMap, remainingLine) => {
		const result = await new SteppingSlicer({
			stepOfInterest: 'parse',
			shell, tokenMap,
			request:        requestFromInput(remainingLine.trim())
		}).allRemainingSteps()

		const config = deepMergeObject<XmlParserConfig>(DEFAULT_XML_PARSER_CONFIG, { tokenMap })
		const object = await xlm2jsonObject(config, result.parse)

		console.log(depthListToTextTree(toDepthMap(object, config), config))
	}
}
