import { type RNode, Type } from '../r-bridge/lang:4.x/ast/model'

export type DataflowId = string

export interface DataflowInfo {
  id: DataflowId
  // TODO: more definition information
  definedBy: DataflowId
}

export type DataflowNode<OtherInfo> = RNode<OtherInfo & { dataflow: DataflowInfo }>

export function decorateWithDataFlowInfo<OtherInfo>(ast: RNode<OtherInfo>): DataflowNode<OtherInfo> {
  // TODO: include other info if present
  return { type: Type.ExprList, children: [], location: undefined, content: undefined, lexeme: undefined, info: { dataflow: { id: 'TODO', definedBy: 'TODO' } } }
}
