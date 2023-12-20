import { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import { isSymbol, RType, RSymbol } from '../../../../../model'
import { startAndEndsWith } from '../../../../../../../../util/strings'
import { NormalizeConfiguration } from '../../data'
import { XML_NAME } from '../../../common/xml-to-json'

// remove backticks from symbol

function removeBackticks(content: string) {
	return startAndEndsWith(content, '`') ? content.substring(1, content.length - 1) : content
}

/**
 * Normalize the given object as an R symbol without namespace information.
 * For the variant with namespace information, see {@link tryNormalizeSymbolWithNamespace}.
 *
 * @param config - The configuration used by the normalizer
 * @param symbol - The json object to extract the symbol from
 *
 * @returns The parsed symbol or `undefined` if the given object is not a symbol.
 */
export function tryNormalizeSymbolNoNamespace(config: NormalizeConfiguration, symbol: XmlBasedJson): RSymbol | undefined {
	const name = symbol[XML_NAME] as string
	if(!isSymbol(name)) {
		return undefined
	}

	const { location, content }  = retrieveMetaStructure(config, symbol)

	return {
		type:      RType.Symbol,
		namespace: undefined,
		location,
		content:   removeBackticks(content),
		lexeme:    content,
		info:      {}
	}
}

/**
 * Normalize the given object as an R symbol without namespace information.
 * For the variant without namespace information, see {@link tryNormalizeSymbolNoNamespace}.
 *
 * @param config - The configuration used by the normalizer
 * @param namespace - The json object to extract the namespace from
 * @param symbol - The json object to extract the symbol from
 *
 * @returns The parsed symbol (with populated namespace information) or `undefined` if the given object is not a symbol.
 */
export function tryNormalizeSymbolWithNamespace(config: NormalizeConfiguration, [namespace, , symbol]: XmlBasedJson[]): RSymbol | undefined {
	const name = symbol[XML_NAME] as string
	if(!isSymbol(name)) {
		return undefined
	}

	const { location, content }  = retrieveMetaStructure(config, symbol)

	return {
		type:      RType.Symbol,
		namespace: namespace[config.content] as string,
		location,
		content:   removeBackticks(content),
		lexeme:    content,
		info:      {}
	}
}
