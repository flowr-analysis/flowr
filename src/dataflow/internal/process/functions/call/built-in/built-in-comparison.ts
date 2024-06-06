import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol'
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { processKnownFunctionCall } from '../known-call-handling'
import { Domain, narrowDomain, NarrowKind } from '../../../../../../abstract-interpretation/domain'
import { guard } from '../../../../../../util/assert'

function calculateResult(lhs: Domain, rhs: Domain, narrowKind: NarrowKind): Domain {
	const lhsNarrowed = narrowDomain(lhs, rhs, narrowKind)
	const rhsNarrowed = narrowDomain(rhs, lhs, narrowKind ^ 0b110)
	const isConditionTrue = lhsNarrowed.isBottom() && rhsNarrowed.isBottom()

	// TODO: kann ich durch kluges Schneiden der Domains in then und else fall das Generieren von beiden Fällen im
	//       Vergleich vermeiden?
	// then: mit top schneiden -> kommt top raus?
	// else:
	return isConditionTrue ? Domain.bottom() : Domain.top()
	// TODO: narrowings
	/*return new AINode(isConditionTrue ? Domain.bottom() : Domain.top(), node, node.info.id, node.info.id, [
		{
			positive: AINodeStore.from([
				new AINode(lhsNarrowed, node, node.info.id, lhs.nodeId),
				new AINode(rhsNarrowed, node, node.info.id, rhs.nodeId),
			]),
			negative: AINodeStore.from([
				new AINode(narrowDomain(lhs.domain, rhs.domain, narrowKind ^ 0b111), node, node.info.id, lhs.nodeId),
				new AINode(narrowDomain(rhs.domain, lhs.domain, narrowKind ^ 0b111 ^ 0b110), node, node.info.id, rhs.nodeId),
			])
		}
	])*/
}

export function processComparison<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const { information: dfgInfo, processedArguments } = processKnownFunctionCall({ name, args, rootId, data })
	const [lhsDomain, rhsDomain] = processedArguments.map(arg => arg?.domain)
	let domain: Domain | undefined
	if(lhsDomain !== undefined && rhsDomain !== undefined) {
		switch(name.content) {
			case '<': domain = calculateResult(lhsDomain, rhsDomain, NarrowKind.Smaller); break
			case '<=': domain = calculateResult(lhsDomain, rhsDomain, NarrowKind.Smaller | NarrowKind.Equal); break
			case '>': domain = calculateResult(lhsDomain, rhsDomain, NarrowKind.Greater); break
			case '>=': domain = calculateResult(lhsDomain, rhsDomain, NarrowKind.Greater | NarrowKind.Equal); break
			case '==': domain = calculateResult(lhsDomain, rhsDomain, NarrowKind.Equal); break
			case '!=': /* TODO: implement */ break
			default: guard(false, 'Unknown comparison operator')
		}
	}
	return {
		...dfgInfo,
		domain: domain
	}
}
