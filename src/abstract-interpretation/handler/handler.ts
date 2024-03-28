import {AINodeStore} from '../processor'

export interface Handler {
	getName: () => string,
	enter:   () => void
	exit:    () => AINodeStore
	next:    (aiNodes: AINodeStore) => void
}