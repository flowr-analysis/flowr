import { DataflowGraph, GlobalScope, LocalScope } from './graph'
import { DecoratedAst } from '../r-bridge'
import { Environments, initializeCleanEnvironments } from './environments'

export type DataflowScopeName = typeof GlobalScope | typeof LocalScope | string

/**
 * Continuously updated during the dataflow analysis to hold the current state.
 */
export interface DataflowInfo<OtherInfo> {
  readonly ast:        DecoratedAst<OtherInfo>
  currentScope:        DataflowScopeName
  currentGraph:        DataflowGraph,
  currentEnvironments: Environments
}

export function initializeCleanInfo<OtherInfo>(ast: DecoratedAst<OtherInfo>, scope: DataflowScopeName): DataflowInfo<OtherInfo> {
  return {
    ast,
    currentScope:        scope,
    currentGraph:        new DataflowGraph(),
    currentEnvironments: initializeCleanEnvironments()
  }
}
