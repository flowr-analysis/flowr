import type { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import type {
	RFunctionCall} from '../../../../../model'
import {
	RType
} from '../../../../../model'
import type { NormalizeConfiguration } from '../../data'
import { normalizeSingleToken } from '../single-element'

/**
 * Parsing binary operations includes the pipe, even though the produced PIPE construct is not a binary operation,
 * to ensure it is handled separately from the others (especially in the combination of a pipe bind)
 */
export function tryNormalizeBinary(
	config: NormalizeConfiguration,
	[lhs, operator, rhs]: XmlBasedJson[]
): RFunctionCall {
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
		arguments: [normalizeSingleToken(config, lhs), normalizeSingleToken(config, rhs)],
		info:      {}
	}
}
