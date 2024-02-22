import type {DeepPartial} from 'ts-essentials'
import type {XmlBasedJson, XmlParserConfig, XmlParserHooks} from '../xml'
import {DEFAULT_PARSER_HOOKS, DEFAULT_XML_PARSER_CONFIG, type ParserData} from '../xml'
import type {IdGenerator, NoInfo} from '../../model'
import {decorateAst, deterministicCountingIdGenerator, type NormalizedAst} from '../../model'
import {deepMergeObject} from '../../../../../util/objects'
import type {CsvEntry} from './format'
import {csvToRecord, getChildren, type ParsedCsv} from './format'
import {parseCSV} from '../../../values'
import {parseRootObjToAst} from '../xml/internal'
import {log} from '../../../../../util/log'

export const parseLog = log.getSubLogger({name: 'ast-parser'})

export function normalize(csvString: string, hooks?: DeepPartial<XmlParserHooks>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): NormalizedAst {
	const config = { ...DEFAULT_XML_PARSER_CONFIG }
	const hooksWithDefaults = deepMergeObject(DEFAULT_PARSER_HOOKS, hooks) as XmlParserHooks

	const data: ParserData = { config, hooks: hooksWithDefaults, currentRange: undefined, currentLexeme: undefined }
	const object = convertToXmlBasedJson(csvToRecord(parseCSV(csvString)), config)

	return decorateAst(parseRootObjToAst(data, object), getId)
}

export function convertToXmlBasedJson(csv: ParsedCsv, config: XmlParserConfig): XmlBasedJson{
	const exprlist: XmlBasedJson =  {'#name': 'exprlist'}
	exprlist[config.childrenName] = Object.values(csv)
		// we convert all roots, which are entries with parent 0
		.filter(v => v.parent == 0)
		.map(v => convertEntry(v, csv, config))
	console.log('Converted: '+JSON.stringify(exprlist, null, 2))
	return {'exprlist': exprlist}
}

function convertEntry(csvEntry: CsvEntry, csv: ParsedCsv, config: XmlParserConfig): XmlBasedJson {
	const xmlEntry: XmlBasedJson = {}

	xmlEntry[config.attributeName] = {
		'line1': csvEntry.line1,
		'col1':  csvEntry.col1,
		'line2': csvEntry.line2,
		'col2':  csvEntry.col2
	}
	xmlEntry['#name'] = csvEntry.token
	if(csvEntry.text)
		xmlEntry[config.contentName] = csvEntry.text

	// check and recursively iterate children
	const children = getChildren(csv, csvEntry)
	if(children && children.length > 0){
		xmlEntry[config.childrenName] = children
			// we sort children the same way xmlparsedata does (by line, by column, by inverse end line, by inverse end column, by terminal state, by combined "start" tiebreaker value)
			// (https://github.com/r-lib/xmlparsedata/blob/main/R/package.R#L153C72-L153C78)
			.sort((c1,c2) => c1.line1-c2.line1 || c1.col1-c2.col1 || c2.line2-c1.line2 || c2.col2-c1.col2 || Number(c1.terminal)-Number(c2.terminal) || sortTiebreak(c1)-sortTiebreak(c2))
			.map(c => convertEntry(c, csv, config))
	}

	return xmlEntry
}

function sortTiebreak(entry: CsvEntry){
	// see https://github.com/r-lib/xmlparsedata/blob/main/R/package.R#L110C5-L110C11
	return entry.line1 * (Math.max(entry.col1, entry.col2) + 1) + entry.col1
}
