import type { NodeId } from '../../../../src'
import { EmptyArgument } from '../../../../src'
import type { IdentifierReference } from '../../../../src/dataflow'
import { BuiltIn } from '../../../../src/dataflow'
import {
	UnnamedFunctionCallPrefix
} from '../../../../src/dataflow/internal/process/functions/call/unnamed-call-handling'

export function wrap(id: string | NodeId | undefined): string {
	if(id === undefined) {
		return 'undefined'
	} else if(id === EmptyArgument) {
		return 'EmptyArgument'
	} else if(id === BuiltIn) {
		return 'BuiltIn'
	} else if(typeof id === 'string' && id.startsWith(UnnamedFunctionCallPrefix)) {
		return `\`\${UnnamedFunctionCallPrefix}${id.slice(UnnamedFunctionCallPrefix.length)}\``
	} else {
		return `'${id}'`
	}
}

function wrapControlDependency(controlDependency: NodeId[] | undefined): string {
	if(controlDependency === undefined) {
		return 'undefined'
	} else {
		return `[${controlDependency.map(wrap).join(', ')}]`
	}
}
export function wrapReference(ref: IdentifierReference): string {
	return `{ nodeId: ${wrap(ref.nodeId)}, name: ${wrap(ref.name)}, controlDependency: ${wrapControlDependency(ref.controlDependency)} }`
}
