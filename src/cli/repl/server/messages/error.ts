import { FlowrBaseMessage } from './messages'

export interface FlowrErrorMessage extends FlowrBaseMessage {
	type:   'error',
	/** if fatal, the connection will be partially closed afterward */
	fatal:  boolean,
	reason: string
}
