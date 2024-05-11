import {AINodeStore} from '../ainode'
import {DataflowInformation} from '../../dataflow/internal/info'
import {aiLogger} from '../processor'

export abstract class Handler {
	protected constructor(
		protected readonly dfg: DataflowInformation,
		public domains: AINodeStore,
		public readonly name: string
	) { }

	enter(): void {
		aiLogger.trace(`Entered ${this.name}`)
	}

	abstract exit(): AINodeStore

	next(aiNodes: AINodeStore): void {
		aiLogger.trace(`${this.name} received`)
	}
}