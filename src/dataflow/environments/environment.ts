/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { NodeId } from '../../r-bridge'
import { DataflowGraphEdgeAttribute, DataflowScopeName, GlobalScope } from '../graph'
import { dataflowLogger } from '../index'

/** identifiers are branded to avoid confusion with other string-like types */
export type Identifier = string & { __brand?: 'identifier' }


export const BuiltIn = 'built-in'


/**
 * Stores the definition of an identifier within an {@link IEnvironment}
 */
export interface IdentifierDefinition extends IdentifierReference {
  kind:      'function' | 'variable' | 'parameter' | 'unknown' | 'built-in-function' /* TODO: 'constant' */
  /** The assignment (or whatever, like `assign` function call) node which ultimately defined this identifier */
  definedAt: NodeId
}

export interface VariableIdentifierDefinition extends IdentifierDefinition {
  kind: 'variable'
  type: string /* TODO static typing system */
}

export interface FunctionIdentifierDefinition extends IdentifierDefinition {
  kind: 'function'
  /* TODO: formals etc. */
}

/**
 * Something like `a` in `b <- a`.
 * Without any surrounding information, `a` will produce the
 * identifier reference `a` in the current scope (like the global environment).
 * Similarly, `b` will create a reference.
 */
export interface IdentifierReference {
  name:   Identifier,
  scope:  DataflowScopeName,
  /** Node which represents the reference in the AST */
  nodeId: NodeId
  /**
   * Is this reference used in every execution path of the program or only if some of them. This can be too-conservative regarding `maybe`.
   * For example, if we can not detect `if(FALSE)`, this will be `maybe` even if we could statically determine, that the `then` branch is never executed.
   */
  used:   DataflowGraphEdgeAttribute
}

export function equalIdentifierReferences(a: IdentifierReference, b: IdentifierReference): boolean {
  return a.name === b.name && a.scope === b.scope && a.nodeId === b.nodeId && a.used === b.used
}

export function makeAllMaybe(references: IdentifierReference[] | undefined): IdentifierReference[] {
  if(references === undefined) {
    return []
  }
  for(const reference of references) {
    reference.used = 'maybe'
  }
  return references
}



export interface IEnvironment {
  /** unique and internally generated identifier -- will not be used for comparison but assists debugging for tracking identities */
  readonly id:   string
  readonly name: string
  /** Lexical parent of the environment, if any (can be manipulated by R code) */
  parent?:       IEnvironment
  /**
   * Maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions
   * TODO: mark function, symbol, etc. definitions
   * TODO: base vs. empty environment, TODO: functions for that... make it a top-level class more likely
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


function cloneEnvironment(environment: IEnvironment): IEnvironment {
  const clone = new Environment(environment.name, environment.parent)
  clone.memory = new Map(environment.memory)
  return clone
}
export function cloneEnvironments(environment: REnvironmentInformation): REnvironmentInformation {
  return {
    current: cloneEnvironment(environment.current),
    level:   environment.level
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
    scope:     GlobalScope,
    used:      'always',
    definedAt: BuiltIn,
    name:      'return',
    nodeId:    BuiltIn
  }]]
])

export function initializeCleanEnvironments(): REnvironmentInformation {
  // TODO baseenv, emptyenv, and assignments directly to the environments (without indirection of assign)
  // TODO: track parent.env calls?
  // TODO undocumented user databases in comments? (see 1.2 of R internals with https://www.omegahat.net/RObjectTables/)
  // .Platform and .Machine
  // TODO: attach namespace to bind etc.
  const global = new Environment(GlobalScope)
  // use a copy
  global.memory = new Map<Identifier, IdentifierDefinition[]>(DefaultEnvironmentMemory)
  return {
    current: global,
    level:   0
  }
}


export function environmentEqual(a: IEnvironment | undefined, b: IEnvironment | undefined): boolean {
  if(a === undefined || b === undefined) {
    dataflowLogger.warn(`Comparing undefined environments ${JSON.stringify(a)} and ${JSON.stringify(b)}`)
    return a === b
  }
  if(a.name !== b.name || a.memory.size !== b.memory.size) {
    dataflowLogger.warn(`Different environments ${JSON.stringify(a)} and ${JSON.stringify(b)} due to different names or sizes (${JSON.stringify([...a.memory.entries()])} vs. ${JSON.stringify([...b.memory.entries()])})`)
    return false
  }
  for(const [key, value] of a.memory) {
    const value2 = b.memory.get(key)
    if(value2 === undefined || value.length !== value2.length) {
      return false
    }

    for(let i = 0; i < value.length; ++i) {
      const aval = value[i]
      const bval = value2[i]
      if(aval.name !== bval.name || aval.nodeId !== bval.nodeId || aval.scope !== bval.scope || aval.used !== bval.used || aval.definedAt !== bval.definedAt || aval.kind !== bval.kind) {
        dataflowLogger.warn(`Different definitions ${JSON.stringify(aval)} and ${JSON.stringify(bval)} within environments`)
        return false
      }
    }
  }
  return environmentEqual(a.parent, b.parent)
}

export function environmentsEqual(a: REnvironmentInformation | undefined, b: REnvironmentInformation | undefined): boolean {
  if(a === undefined || b === undefined) {
    dataflowLogger.warn(`Comparing undefined environments ${JSON.stringify(a)} and ${JSON.stringify(b)}`)
    return a === b
  }
  if(!environmentEqual(a.current, b.current)) {
    dataflowLogger.warn(`Different environments ${JSON.stringify(a)} and ${JSON.stringify(b)}`)
    return false
  }
  return true
}
