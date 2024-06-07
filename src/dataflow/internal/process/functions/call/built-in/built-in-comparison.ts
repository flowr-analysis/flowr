import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol'
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { processKnownFunctionCall } from '../known-call-handling'
import type { Narrowing } from '../../../../../../abstract-interpretation/domain'
import { AiInfo, Domain, narrowDomain, NarrowKind } from '../../../../../../abstract-interpretation/domain'
import { guard } from '../../../../../../util/assert'

function calculateResult(lhs: AiInfo, rhs: AiInfo, narrowKind: NarrowKind): {
	domain:     Domain,
	narrowings: Narrowing[]
} {
	const lhsNarrowed = narrowDomain(lhs.domain, rhs.domain, narrowKind)
	const rhsNarrowed = narrowDomain(rhs.domain, lhs.domain, narrowKind ^ 0b110)
	const isConditionTrue = lhsNarrowed.isBottom() && rhsNarrowed.isBottom()

	return {
		domain:     isConditionTrue ? Domain.truthy() : Domain.falsy(),
		narrowings: [{
			positive: {
				id:     lhs.id,
				domain: lhsNarrowed
			},
			negative: {
				id:     lhs.id,
				domain: narrowDomain(lhs.domain, rhs.domain, narrowKind ^ 0b111)
			}
		}, {
			positive: {
				id:     rhs.id,
				domain: rhsNarrowed
			},
			negative: {
				id:     rhs.id,
				domain: narrowDomain(rhs.domain, lhs.domain, narrowKind ^ 0b111)
			}
		}]
	}
}

export function processComparison<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const { information: dfgInfo, processedArguments } = processKnownFunctionCall({ name, args, rootId, data })
	const [lhs, rhs] = processedArguments.map(arg => arg?.aiInfo)
	if(lhs === undefined || rhs === undefined) {
		return dfgInfo
	}

	let narrowKind: NarrowKind
	switch(name.content) {
		case '<': narrowKind = NarrowKind.Smaller; break
		case '<=': narrowKind = NarrowKind.Smaller | NarrowKind.Equal; break
		case '>': narrowKind = NarrowKind.Greater; break
		case '>=': narrowKind = NarrowKind.Greater | NarrowKind.Equal; break
		default: guard(false, 'Unknown comparison operator')
	}
	const lhsArg = args[0]
	const rhsArg = args[1]
	guard(lhsArg !== EmptyArgument && rhsArg !== EmptyArgument, 'Comparison operator with empty argument')
	const { domain, narrowings } = calculateResult(lhs, rhs, narrowKind)
	return {
		...dfgInfo,
		aiInfo: new AiInfo(name.content, domain, narrowings)
	}
}
