/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 *
 * @module
 */
import type { NodeId } from '../../r-bridge'
import type { DataflowGraph, DataflowGraphEdgeAttribute } from '../'
import { resolveByName } from './resolve-by-name'
import type { DataflowInformation } from '../info'

/** identifiers are branded to avoid confusion with other string-like types */
export type Identifier = string & { __brand?: 'identifier' }


export const BuiltIn = 'built-in'


interface InGraphIdentifierDefinition extends IdentifierReference {
	kind:      'function' | 'variable' | 'parameter' | 'unknown' | 'argument'
	/** The assignment (or whatever, like `assign` function call) node which ultimately defined this identifier */
	definedAt: NodeId
}

interface BuiltInIdentifierDefinition extends IdentifierReference {
	kind:      'built-in-function'
	definedAt: typeof BuiltIn
	process:   (node: NodeId, args: readonly DataflowInformation[], info: DataflowInformation) => DataflowInformation
}

/**
 * Stores the definition of an identifier within an {@link IEnvironment}
 */
export type IdentifierDefinition = InGraphIdentifierDefinition | BuiltInIdentifierDefinition

/**
 * Something like `a` in `b <- a`.
 * Without any surrounding information, `a` will produce the
 * identifier reference `a` in the current scope (like the global environment).
 * Similarly, `b` will create a reference.
 */
export interface IdentifierReference {
	name:   Identifier,
	/** Node which represents the reference in the AST */
	nodeId: NodeId
	/**
   * Is this reference used in every execution path of the program or only if some of them. This can be too-conservative regarding `maybe`.
   * For example, if we can not detect `if(FALSE)`, this will be `maybe` even if we could statically determine, that the `then` branch is never executed.
   */
	used:   DataflowGraphEdgeAttribute
}


function makeReferenceMaybe(ref: IdentifierReference, graph: DataflowGraph, environments: REnvironmentInformation): IdentifierReference {
	const node = graph.get(ref.nodeId, true)
	const definitions = resolveByName(ref.name, environments)
	for(const definition of definitions ?? []) {
		if(definition.kind !== 'built-in-function') {
			definition.used = 'maybe'
		}
	}
	if(node) {
		node[0].when = 'maybe'
	}
	return { ...ref, used: 'maybe' }
}

export function makeAllMaybe(references: IdentifierReference[] | undefined, graph: DataflowGraph, environments: REnvironmentInformation): IdentifierReference[] {
	if(references === undefined) {
		return []
	}
	return references.map(ref => makeReferenceMaybe(ref, graph, environments))
}


export interface IEnvironment {
	/** unique and internally generated identifier -- will not be used for comparison but assists debugging for tracking identities */
	readonly id:   string
	readonly name: string
	/** Lexical parent of the environment, if any (can be manipulated by R code) */
	parent?:       IEnvironment
	/**
   * Maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions
   */
	memory:        Map<Identifier, IdentifierDefinition[]>
}

let environmentIdCounter = 0

export class Environment implements IEnvironment {
	readonly name: string
	readonly id:   string = `${environmentIdCounter++}`
	parent?:       IEnvironment
	memory:        Map<Identifier, IdentifierDefinition[]>

	constructor(name: string, parent?: IEnvironment) {
		this.name   = name
		this.parent = parent
		this.memory = new Map()
	}
}

/**
 * First of all, yes, R stores its environments differently, potentially even with a different differentiation between
 * the `baseenv`, the `emptyenv`and other default environments. Yet, during dataflow we want sometimes to know more (static
 * reference information) and sometimes know less (to be honest we do not want that,
 * but statically determining all attached environments is theoretically impossible --- consider attachments by user input).
 * One example would be maps holding a potential list of all definitions of a variable, if we do not know the execution path (like with `if(x) A else B`).
 */
export interface REnvironmentInformation {
	/**  The currently active environment (the stack is represented by the currently active {@link IEnvironment#parent}). Environments are maintained within the dataflow graph. */
	readonly current: IEnvironment
	/** nesting level of the environment, will be `0` for the global/root environment */
	readonly level:   number
}

export const DefaultEnvironmentMemory = new Map<Identifier, IdentifierDefinition[]>([
	['return', [{
		kind:      'built-in-function',
		used:      'always',
		definedAt: BuiltIn,
		process:   (node, args, info) => {
			return info
		},
		name:   'return',
		nodeId: BuiltIn
	}]],
	['cat', [{
		kind:      'built-in-function',
		used:      'always',
		definedAt: BuiltIn,
		process:   (node, args, info) => {
			return info
		},
		name:   'cat',
		nodeId: BuiltIn
	}]],
	['print', [{
		kind:      'built-in-function',
		used:      'always',
		definedAt: BuiltIn,
		process:   (node, args, info) => {
			return info
		},
		name:   'print',
		nodeId: BuiltIn
	}]],
	['source', [{
		kind:      'built-in-function',
		used:      'always',
		definedAt: BuiltIn,
		process:   (node, args, info) => {
			return info
		},
		name:   'source',
		nodeId: BuiltIn
	}]]
])

export function initializeCleanEnvironments(): REnvironmentInformation {
	const global = new Environment('global')
	// use a copy
	global.memory = new Map<Identifier, IdentifierDefinition[]>(DefaultEnvironmentMemory)
	return {
		current: global,
		level:   0
	}
}


