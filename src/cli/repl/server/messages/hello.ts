import { VersionInformation } from '../../commands/version'
import { FlowrBaseMessage } from './messages'

export interface FlowrHelloResponseMessage extends FlowrBaseMessage{
	type:       'hello',
	/** a unique name assigned to each client it has no semantic meaning and is only used for debugging */
	clientName: string,
	versions:   VersionInformation
}

