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
	thenDomains = AINodeStore.empty()
	elseDomains = AINodeStore.empty()

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
				const isElseNode = node.nodeId.endsWith('-else')
				const cleanedId = isElseNode ? node.nodeId.slice(0, -5) : node.nodeId
				for(const child of getDfgChildrenOfType(cleanedId, this.dfg, EdgeType.Reads) ?? []) {
					if(isElseNode) {
						this.elseDomains.register({
							...node,
							nodeId: child
						}, RegisterBehavior.Overwrite)
					} else {
						this.thenDomains.register({
							...node,
							nodeId: child
						}, RegisterBehavior.Overwrite)
					}
				}
			}
			this.domains.updateWith(this.thenDomains)
		} else if(this.then === undefined) {
			this.then = aiNodes
			this.domains.updateWith(this.elseDomains)
		} else if(this.else === undefined) {
			this.else = aiNodes
		} else {
			guard(false, `Conditional ${this.node.info.id} already has condition, then and else`)
		}
	}
}