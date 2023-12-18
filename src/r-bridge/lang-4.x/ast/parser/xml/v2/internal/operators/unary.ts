import { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import { RFunctionCall, RType } from '../../../../../model'
import { NormalizeConfiguration } from '../../data'
import { normalizeSingleNode } from '../single-element'

/**
 * Parses the construct as a unary op.
 *
 * @param config   - The normalizer config
 * @param operator - The operator token
 * @param operand  - The operand of the unary operator
 *
 * @returns The parsed unary op function call
 */
export function normalizeUnary(config: NormalizeConfiguration, [operator, operand]: XmlBasedJson[]): RFunctionCall {
	const { location, content } = retrieveMetaStructure(config, operator)
	const { location: opLocation, content: opContent } = retrieveMetaStructure(config, operand)
	return {
		type:         RType.FunctionCall,
		lexeme:       config.currentLexeme ?? content,
		location,
		flavor:       'named',
		functionName: {
			type:      RType.Symbol,
			namespace: undefined,
			location,
			content,
			lexeme:    content,
			info:      {}
		},
		arguments: [{
			type:     RType.Argument,
			location: opLocation,
			lexeme:   opContent,
			name:     undefined,
			value:    normalizeSingleNode(config, operand),
			info:     {}
		}],
		info: {}
	}
}
