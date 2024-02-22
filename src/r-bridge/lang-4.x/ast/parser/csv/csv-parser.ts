import type {TokenMap} from '../../../../retriever'
import type {DeepPartial} from 'ts-essentials'
import type {XmlBasedJson, XmlParserConfig, XmlParserHooks} from '../xml'
import {DEFAULT_PARSER_HOOKS, DEFAULT_XML_PARSER_CONFIG, type ParserData} from '../xml'
import type {IdGenerator, NoInfo} from '../../model'
import {decorateAst, deterministicCountingIdGenerator, type NormalizedAst} from '../../model'
import {deepMergeObject} from '../../../../../util/objects'
import type {CsvEntry} from './format'
import { getChildren} from './format'
import { csvToRecord, type ParsedCsv} from './format'
import {parseCSV} from '../../../values'
import {parseRootObjToAst} from '../xml/internal'
import {guard} from '../../../../../util/assert'

export function normalize(csvString: string, tokenMap: TokenMap, hooks?: DeepPartial<XmlParserHooks>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): NormalizedAst {
	const config = { ...DEFAULT_XML_PARSER_CONFIG, tokenMap }
	const hooksWithDefaults = deepMergeObject(DEFAULT_PARSER_HOOKS, hooks) as XmlParserHooks

	const data: ParserData = { config, hooks: hooksWithDefaults, currentRange: undefined, currentLexeme: undefined }
	const object = convertToXmlBasedJson(csvToRecord(parseCSV(csvString)), config)

	return decorateAst(parseRootObjToAst(data, object), getId)
}

export function convertToXmlBasedJson(csv: ParsedCsv, config: XmlParserConfig): XmlBasedJson{
	// find the root, which is the expression with parent 0
	const root = Object.values(csv).find(v => v.parent == 0)
	guard(root != null, `No root element found in ${JSON.stringify(csv)}`)

	const exprlist: XmlBasedJson =  {'#name': 'exprlist'}
	exprlist[config.childrenName] = [convertEntry(root, csv, config)]
	exprlist['expr'] = [convertEntry(root, csv, config, false)]
	return {'exprlist': exprlist}
}

function convertEntry(csvEntry: CsvEntry, csv: ParsedCsv, config: XmlParserConfig, includeName = true): XmlBasedJson {
	const xmlEntry: XmlBasedJson = {}

	xmlEntry[config.attributeName] = {
		'line1': csvEntry.line1,
		'col1':  csvEntry.col1,
		'line2': csvEntry.line2,
		'col2':  csvEntry.col2
	}
	if(includeName)
		xmlEntry['#name'] = csvEntry.token

	const children = getChildren(csv, csvEntry)
	if(children && children.length > 0){
		// this element has child tokens
		const xmlChildren: XmlBasedJson[] = []
		for(const child of children) {
			xmlChildren.push(convertEntry(child, csv, config))
			xmlEntry[child.token] = [...(xmlEntry[child.token] ?? []) as XmlBasedJson[], convertEntry(child, csv, config, false)]
		}
		xmlEntry[config.childrenName] = xmlChildren
	} else {
		// this element just has text content
		xmlEntry[config.contentName] = csvEntry.text
	}

	return xmlEntry
}
