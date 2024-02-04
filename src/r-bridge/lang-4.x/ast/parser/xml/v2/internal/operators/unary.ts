import type { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import type { RFunctionCall} from '../../../../../model'
import { RType } from '../../../../../model'
import type { NormalizeConfiguration } from '../../data'
import { normalizeSingleToken } from '../single-element'

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
		arguments: [normalizeSingleToken(config, operand)],
		info:      {}
	}
}
