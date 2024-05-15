import {AINodeStore} from '../ainode'
import {DataflowInformation} from '../../dataflow/internal/info'
import {aiLogger} from '../processor'

export abstract class Handler {
	protected constructor(
		protected readonly dfg: DataflowInformation,
		private _domains: AINodeStore,
		public readonly name: string
	) { }

	enter(): void {
		aiLogger.trace(`Entered ${this.name}`)
	}

	exit(): AINodeStore {
		return this.domains.top
	}

	next(aiNodes: AINodeStore): void {
		aiLogger.trace(`${this.name} received`)
		this.domains.updateWith(aiNodes)
	}

	get domains(): AINodeStore {
		return this._domains
	}
}