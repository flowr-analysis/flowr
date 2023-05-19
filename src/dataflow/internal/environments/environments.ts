/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { IdType } from '../../../r-bridge'
import { DataflowScopeName, GlobalScope, LocalScope } from '../../graph'

export type Identifier = string
export type EnvironmentName = string
/**
 * Stores the definition of an identifier within an {@link IEnvironment}
 */
export type IdentifierDefinition = IdentifierReference

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
  nodeId: IdType
}

export interface IEnvironment {
  readonly name: string
  /**
   * Maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions
   */
  map:           Map<Identifier, IdentifierDefinition[]>
}

export class Environment implements IEnvironment {
  readonly name: string
  map:           Map<Identifier, IdentifierDefinition[]>

  constructor(name: string) {
    this.name   = name
    this.map    = new Map()
  }
}

export type NamedEnvironments = Map<EnvironmentName, IEnvironment>

export interface Environments {
  readonly global: IEnvironment
  /** Stack of local environments, the first element is the top of the stack, new elements will be pushed to the front. */
  readonly local:  IEnvironment[]
  readonly named:  NamedEnvironments
}

export function initializeCleanEnvironments(): Environments {
  return {
    global: new Environment(GlobalScope),
    local:  [new Environment(LocalScope)],
    named:  new Map()
  }
}
