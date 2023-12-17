import * as xml2js from 'xml2js'
import { XmlParserConfig } from './config'
import { XmlBasedJson } from './input-format'

const xml2jsOptions: xml2js.OptionsV2 = {
	charsAsChildren:       false,
	explicitChildren:      true,
	mergeAttrs:            false,
	// we need this for semicolons etc., while we keep the old broken components we ignore them completely
	preserveChildrenOrder: true,
	trim:                  true,
	includeWhiteChars:     true,
	normalize:             false,
	normalizeTags:         false,
	validator:             undefined,
	xmlns:                 false,
	strict:                true
}

/**
 * Parse the xml presented by R into a json object that will be used for conversion
 *
 * @param config    - The configuration to use (i.e., what names should be used for the attributes, children, ...)
 * @param xmlString - The xml input to parse
 */
export function xlm2jsonObject(config: XmlParserConfig, xmlString: string): Promise<XmlBasedJson> {
	return xml2js.parseStringPromise(xmlString, {
		...xml2jsOptions,
		attrkey:  config.attr,
		charkey:  config.content,
		childkey: config.children

	}) as Promise<XmlBasedJson>
}
