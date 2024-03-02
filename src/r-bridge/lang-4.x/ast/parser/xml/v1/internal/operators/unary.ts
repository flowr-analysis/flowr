import type { NamedXmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure, retrieveOpName } from '../../../common/meta'
import { tryNormalizeSingleNode } from '../structure'
import type { ParserData } from '../../data'
import { guard } from '../../../../../../../../util/assert'
import type {
	RNode,
	RUnaryOp,
	UnaryOperatorFlavor
} from '../../../../../model'
import {
	ArithmeticOperatorsRAst,
	LogicalOperatorsRAst,
	ModelFormulaOperatorsRAst,
	RType
} from '../../../../../model'
import { parseLog } from '../../../../json/parser'

/**
 * Parses the construct as a {@link RUnaryOp} (automatically identifies the flavor).
 *
 * @param data     - The data used by the parser (see {@link ParserData})
 * @param operator - The operator token
 * @param operand  - The operand of the unary operator
 *
 * @returns The parsed {@link RUnaryOp} or `undefined` if the given construct is not a unary operator
 */
export function tryNormalizeUnary(data: ParserData, operator: NamedXmlBasedJson, operand: NamedXmlBasedJson): RNode | undefined {
	parseLog.trace(`unary op for ${operator.name} ${operand.name}`)
	let flavor: UnaryOperatorFlavor
	if(ArithmeticOperatorsRAst.has(operator.name)) {
		flavor = 'arithmetic'
	} else if(LogicalOperatorsRAst.has(operator.name)) {
		flavor = 'logical'
	} else if(ModelFormulaOperatorsRAst.has(operator.name)) {
		flavor = 'model formula'
	} else {
		return undefined
	}
	return parseUnaryOp(data, flavor, operator, operand)
}

function parseUnaryOp(data: ParserData, flavor: UnaryOperatorFlavor, operator: NamedXmlBasedJson, operand: NamedXmlBasedJson): RUnaryOp {
	parseLog.debug(`[unary op] parse ${flavor}`) // <- semicolon sadly required for not miss-interpreting the destructuring match as call

	const parsedOperand = tryNormalizeSingleNode(data, operand)

	guard(parsedOperand.type !== RType.Delimiter, () => 'unexpected under-sided unary op')

	const operationName = retrieveOpName(operator)
	const { location, content } = retrieveMetaStructure(operator.content)

	return {
		type:     RType.UnaryOp,
		flavor,
		location,
		operator: operationName,
		lexeme:   content,
		operand:  parsedOperand,
		info:     {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
}
