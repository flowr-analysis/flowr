import type { CallContextQueryFormat } from './call-context-query/call-context-query-format';
import type { DataflowGraph } from '../dataflow/graph/graph';

export type Query = CallContextQueryFormat;
export type Queries = Query[];

/* TODO: generic query dispatcher */
/* TODO: then execute the query and return the generic results */



export function executeQuery(graph: DataflowGraph, query: Query): void {

}
