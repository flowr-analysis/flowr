import {AINodeStore} from '../ainode'

export interface Handler {
	getName: () => string,
	enter:   () => void
	exit:    () => AINodeStore
	next:    (aiNodes: AINodeStore) => void
}