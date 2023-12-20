import { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import {
	RFunctionCall,
	RType
} from '../../../../../model'
import { NormalizeConfiguration } from '../../data'
import { normalizeSingleNode } from '../single-element'

/**
 * Parsing binary operations includes the pipe, even though the produced PIPE construct is not a binary operation,
 * to ensure it is handled separately from the others (especially in the combination of a pipe bind)
 */
export function tryNormalizeBinary(
	config: NormalizeConfiguration,
	[lhs, operator, rhs]: XmlBasedJson[]
): RFunctionCall {
	const { location, content } = retrieveMetaStructure(config, operator)
	const { location: lhsLocation, content: lhsContent } = retrieveMetaStructure(config, lhs)
	const { location: rhsLocation, content: rhsContent } = retrieveMetaStructure(config, rhs)
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
		arguments: [normalizeSingleNode(config, lhs), normalizeSingleNode(config, rhs)],
		info: {}
	}
}
