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

type DepthList =  { depth: number, node: XmlBasedJson }[]

function toDepthMap(xml: XmlBasedJson, config: XmlParserConfig): DepthList {
	const root = getKeysGuarded<XmlBasedJson>(xml, Type.ExpressionList)
	const visit: DepthList = [ { depth: 0, node: root } ]
	const result: DepthList = []
	while(visit.length > 0) {
		const current = visit.pop()
		if(current === undefined) {
			continue
		}
		result.push(current)
		const children = current.node[config.childrenName] as XmlBasedJson[] | undefined
		if(children !== undefined) {
			visit.push(...children.map(c => ({
				depth: current.depth + 1,
				node:  c
			})))
		}
	}
	return result
}

const lineStyle = () => formatter.getFormatString({ style: FontStyles.faint })

function depthListToAsciiArt(list: DepthList, config: XmlParserConfig): string {
	let result = ''
	for(let i = 0; i < list.length; i++) {
		const nextDepth = i + 1 < list.length ? list[i + 1].depth : 0
		const { depth, node } = list[i]
		result += `\n${lineStyle()}${'│ '.repeat(Math.max(depth - 1, 0))}`
		if(nextDepth < depth) {
			result += `└ `
		} else {
			result += i === 0 ? '' : `├ `
		}


		// TODO: port this to the normal extraction so it does not fail?
		const raw = objectWithArrUnwrap(node)
		const content = raw[config.contentName] as string | undefined
		const locationRaw = raw[config.attributeName] as XmlBasedJson | undefined
		let location = ''
		if(locationRaw !== undefined) {
			const extracted = extractLocation(locationRaw)
			location = ` (${extracted.start.line}:${extracted.start.column}─${extracted.end.line}:${extracted.end.column})`
		}

		const type = getTokenType(config.tokenMap, node)
		const suffix = `${formatter.format(content ?? '', { style: FontStyles.bold} )}${formatter.format(location, { style: FontStyles.italic })}`
		result += `${formatter.reset()}${type} ${suffix}`
	}
	return result
}


// TODO: aliasses
export const parseCommand: ReplCommand = {
	description:  'Prints ASCII Art of the parsed, unmodified AST. Start with \'file://\' to indicate a file path',
	usageExample: ':parse',
	script:       false,
	fn:           async(shell, tokenMap, remainingLine) => {
		const result = await new SteppingSlicer({
			stepOfInterest: 'parse',
			shell, tokenMap,
			request:        requestFromInput(remainingLine.trim())
		}).allRemainingSteps()

		const config = deepMergeObject<XmlParserConfig>(DEFAULT_XML_PARSER_CONFIG, { tokenMap })
		const object = await xlm2jsonObject(config, result.parse)

		console.log(depthListToAsciiArt(toDepthMap(object, config), config))
	}
}
