/**
 * Provides an environment structure similar to R.
 * This allows the dataflow to hold current definition locations for variables, based on the current scope.
 * @module
 */
import { IdType } from '../../r-bridge'
import { DataflowScopeName, GlobalScope, LocalScope } from '../graph'

export type Identifier = string
export type EnvironmentName = string
/**
 * stores the definition of an identifier within an {@link IEnvironment}
 */
export interface IdentifierDefinition {
  assignmentNode: IdType
  assignedTarget: Identifier
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
  /** node which represents the reference in the AST */
  nodeId: IdType
}

interface IEnvironment {
  readonly name:   string
  /** if the environment (local) is nested, this points to the parent environment */
  readonly parent: IEnvironment | undefined
  /**
   * maps to exactly one definition of an identifier if the source is known, otherwise to a list of all possible definitions
   */
  map:             Map<Identifier, IdentifierDefinition[]>
}

export class Environment implements IEnvironment {
  readonly name:   string
  readonly parent: IEnvironment | undefined
  map:             Map<Identifier, IdentifierDefinition[]>

  constructor(name: string, parent?: IEnvironment) {
    this.name   = name
    this.parent = parent
    this.map    = new Map()
  }
}

export interface Environments {
  readonly global: IEnvironment
  readonly local:  IEnvironment
  readonly named:  Map<EnvironmentName, IEnvironment>
}

export function initializeCleanEnvironments(): Environments {
  return {
    global: new Environment(GlobalScope),
    local:  new Environment(LocalScope),
    named:  new Map()
  }
}
