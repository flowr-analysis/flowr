import type { DataflowGraphEdgeAttribute, NodeId, REnvironmentInformation } from '../../../src'
import { DataflowGraph, EdgeType } from '../../../src'
import { LocalScope } from '../../../src/dataflow/environments/scopes'

export function emptyGraph() {
	return new DataflowGraphBuilder
}

export class DataflowGraphBuilder extends DataflowGraph {
	/**
	 * Adds a vertex for variable use. Intended for creating dataflow graphs as part of function tests.
	 * @param id - AST node id
	 * @param name - Variable name
	 * @param when - always or maybe; defaults to always
	 * @param environment - Environment the use occurs in
	 * @param asRoot - boolean; defaults to true.
	 * @param scope - string
	 */
	public uses(id: NodeId, name: string, when: DataflowGraphEdgeAttribute = 'always', environment?: REnvironmentInformation, asRoot: boolean = true) {
		return this.addVertex({ tag: 'use', id, name, when, environment }, asRoot)
	}

	/**
	 * Adds a vertex for a variable definition.
	 * @param id - AST node ID
	 * @param name - Variable name
	 * @param scope - Scope (global/local/custom), defaults to local.
	 * @param when - always or maybe; defaults to maybe.
	 * @param environment - Environment the variable is defined in.
	 * @param asRoot - boolean; defaults to true.
	 */
	public definesVariable(id: NodeId, name: string, scope: string = LocalScope, when: DataflowGraphEdgeAttribute = 'always', environment?: REnvironmentInformation, asRoot: boolean = true) {
		return this.addVertex({tag: 'variable-definition', id, name, scope, when, environment}, asRoot)
	}    

	/**
	 * Adds a read edge for simple testing.
	 * 
	 * @param from - Vertex/Node id
	 * @param to   - see from
	 * @param when - always (default), or maybe
	 */
	public reads(from: NodeId, to: NodeId, when: DataflowGraphEdgeAttribute = 'always') {
		return this.addEdge(from, to, EdgeType.Reads, when)
	}
}