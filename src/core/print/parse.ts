/**
 * Contains all non-internal {@link StepOutputFormat} printers for the `parse` step.
 *
 * @see STEPS_PER_FILE
 * @module
 */

import { ISubStepPrinter, StepOutputFormat } from './print'
import { SubStepProcessor } from '../steps'
import { DEFAULT_XML_PARSER_CONFIG, TokenMap, XmlParserConfig } from '../../r-bridge'
import { deepMergeObject } from '../../util/objects'
import { xlm2jsonObject } from '../../r-bridge/lang-4.x/ast/parser/xml/internal'

/**
 * Receives the xml of the parsed R code AST and returns my attempt at an ASCII Art representation.
 */
export const parseResultToText: ISubStepPrinter<SubStepProcessor<'parse'>, StepOutputFormat.text, [TokenMap]> = async(input: string, tokenMap: TokenMap): Promise<string> => {
	const config = deepMergeObject<XmlParserConfig>(DEFAULT_XML_PARSER_CONFIG, { tokenMap })
	const object = await xlm2jsonObject(config, input)

	return JSON.stringify(object)
}
