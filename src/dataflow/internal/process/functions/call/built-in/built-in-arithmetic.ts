import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol'
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { processKnownFunctionCall } from '../known-call-handling'
import type { Domain } from '../../../../../../abstract-interpretation/domain'
import { addDomains, subtractDomains } from '../../../../../../abstract-interpretation/domain'
import { guard } from '../../../../../../util/assert'

export function processArithmetic<OtherInfo>(
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
			case '+': domain = addDomains(lhsDomain, rhsDomain); break
			case '-': domain = subtractDomains(lhsDomain, rhsDomain); break
			default: guard(false, `Unknown arithmetic operator ${name.content}`)
		}
	}
	return {
		...dfgInfo,
		domain: domain
	}
}
