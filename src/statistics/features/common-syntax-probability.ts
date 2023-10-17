/**
 * Defines the type of syntax constructs that we track (e.g., true, false, 0, 1, T, F, conditions...)
 */
import { RFalse, RNodeWithParent, RTrue, RType } from '../../r-bridge'

export interface CommonSyntaxTypeCounts {
	// does include t and f, as well as NULL etc. (any special symbol)
	singleVar:   Map<string, bigint>
	number:      Map<number, bigint>
	// only explicit integers
	integer:     Map<number, bigint>
	complex:     Map<number, bigint>
	string:      Map<string, bigint>
	logical:     Map<typeof RTrue | typeof RFalse, bigint>,
	call:        Map<string, bigint>,
	unnamedCall: bigint,
	// binop includes all assignments!
	binOp:       Map<string, bigint>,
	unaryOp:     Map<string, bigint>,
	// unknown content, records lexeme (can include break etc. for bodies)
	other:       Map<string, bigint>
}

function incrementEntry<T>(map: Map<T, bigint>, key: T): void {
	map.set(key, (map.get(key) ?? 0n) + 1n)
}

/**
 * Updates the given counts based on the type of the given node.
 */
export function updateCommonSyntaxTypeCounts(current: CommonSyntaxTypeCounts, node: RNodeWithParent): CommonSyntaxTypeCounts {
	switch(node.type) {
		case RType.String:
			incrementEntry(current.string, node.content.str)
			break
		case RType.Symbol:
			incrementEntry(current.singleVar, node.content)
			break
		case RType.Logical:
			incrementEntry(current.logical, node.content ? RTrue : RFalse)
			break
		case RType.Number:
			if(node.content.complexNumber) {
				incrementEntry(current.complex, node.content.num)
			} else if(node.content.markedAsInt) {
				incrementEntry(current.integer, node.content.num)
			} else {
				incrementEntry(current.number, node.content.num)
			}
			break
		case RType.FunctionCall:
			if(node.flavor === 'unnamed') {
				current.unnamedCall++
			} else {
				incrementEntry(current.call, node.functionName.content)
			}
			break
		case RType.BinaryOp:
			incrementEntry(current.binOp, node.operator)
			break
		case RType.UnaryOp:
			incrementEntry(current.unaryOp, node.operator)
			break
		default:
			incrementEntry(current.other, node.fullLexeme ?? node.lexeme)
			break
	}
	return current
}
