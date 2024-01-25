import * as xml2js from 'xml2js'
import { XmlParserConfig } from '../config'
import { XmlBasedJson } from '../input-format'

/**
 * Parse the xml presented by R into a json object that will be used for conversion
 *
 * @param config    - The configuration to use (i.e., what names should be used for the attributes, children, ...)
 * @param xmlString - The xml input to parse
 */
export function xlm2jsonObject(config: XmlParserConfig, xmlString: string): XmlBasedJson {
	let result: XmlBasedJson = {}
	xml2js.parseString(xmlString, {
		// we want this to be strictly synchronous!
		async:                 false,
		attrkey:               config.attributeName,
		charkey:               config.contentName,
		childkey:              config.childrenName,
		charsAsChildren:       false,
		explicitChildren:      true,
		mergeAttrs:            false,
		// we need this for semicolons etc., while we keep the old broken components we ignore them completely
		preserveChildrenOrder: true,
		trim:                  true,
		includeWhiteChars:     true,
		normalize:             false,
		strict:                true
	}, (_, r)=> result = r as XmlBasedJson)
	return result 
}
