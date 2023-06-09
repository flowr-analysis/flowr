/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { NodeId } from '../../r-bridge'
import { DataflowGraphEdgeAttribute, DataflowScopeName, GlobalScope, LocalScope } from '../graph'

/** identifiers are branded to avoid confusion with other string-like types */
export type Identifier = string & { __brand?: 'identifier' }

/**
 * Stores the definition of an identifier within an {@link IEnvironment}
 */
export interface IdentifierDefinition extends IdentifierReference {
  kind:      'function' | 'variable' | 'argument' | 'unknown' /* TODO: 'constant' */
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

export class Environment implements IEnvironment {
  readonly name: string
  parent?:       IEnvironment
  memory:        Map<Identifier, IdentifierDefinition[]>

  constructor(name: string) {
    this.name   = name
    this.memory    = new Map()
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
  readonly global: IEnvironment
  /** Stack of local environments, the first element is the top of the stack, new elements will be pushed to the front. */
  readonly local:  IEnvironment[]
}

export function initializeCleanEnvironments(): REnvironmentInformation {
  // TODO baseenv, emptyenv, and assignments directly to the environments (without indirection of assign)
  // TODO: track parent.env calls?
  // TODO undocumented user databases in comments? (see 1.2 of R internals with https://www.omegahat.net/RObjectTables/)
  // .Platform and .Machine
  // TODO: attach namespace to bind etc.
  return {
    global: new Environment(GlobalScope),
    local:  [new Environment(LocalScope)],
  }
}
