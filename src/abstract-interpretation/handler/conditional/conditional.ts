import {ParentInformation, RIfThenElse} from '../../../r-bridge'
import {guard} from '../../../util/assert'
import {AINodeStore, RegisterBehavior} from '../../ainode'
import {aiLogger, getDfgChildrenOfType} from '../../processor'
import {Handler} from '../handler'
import {DataflowInformation} from '../../../dataflow/internal/info'
import {EdgeType} from '../../../dataflow'

export class Conditional extends Handler {
	condition: AINodeStore | undefined
	then:      AINodeStore | undefined
	else:      AINodeStore | undefined

	constructor(
		dfg: DataflowInformation,
		domains: AINodeStore,
		private readonly node: RIfThenElse<ParentInformation>
	) {
		super(dfg, domains, 'IfThenElse')
	}

	exit(): AINodeStore {
		aiLogger.trace(`Exited ${this.name}`)
		guard(this.condition !== undefined, `No condition found for conditional ${this.node.info.id}`)
		guard(this.then !== undefined, `No then-branch found for conditional ${this.node.info.id}`)

		const result = AINodeStore.empty()
		for(const thenNode of this.then) {
			result.register(thenNode)
		}
		for(const elseNode of this.else ?? []) {
			result.register(elseNode)
		}

		return result
	}

	next(aiNodes: AINodeStore): void {
		aiLogger.trace(`${this.name} received`)
		if(this.condition === undefined) {
			this.condition = aiNodes
			for(const node of aiNodes) {
				const children = getDfgChildrenOfType(node.nodeId, this.dfg, EdgeType.Reads)
				for(const child of children ?? []) {
					this.domains.register({
						...node,
						nodeId: child
					}, RegisterBehavior.Overwrite)
				}
			}
		} else if(this.then === undefined) {
			this.then = aiNodes
		} else if(this.else === undefined) {
			this.else = aiNodes
		} else {
			guard(false, `Conditional ${this.node.info.id} already has condition, then and else`)
		}
	}
}