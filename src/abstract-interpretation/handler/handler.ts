import {AINodeStore} from '../ainode'
import {DataflowInformation} from '../../dataflow/internal/info'
import {aiLogger} from '../processor'

export abstract class Handler {
	protected constructor(protected readonly dfg: DataflowInformation, public readonly name: string) { }

	enter(): void {
		aiLogger.trace(`Entered ${this.name}`)
	}
	abstract exit(): AINodeStore
	abstract next(aiNodes: AINodeStore): AINodeStore
}