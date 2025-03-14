import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { DataflowGraph } from '../graph/graph';
import type { REnvironmentInformation } from '../environments/environment';

// x <- 5;eval(parse(text=paste("foo", x)))

// 2 + 2
export function eval(node: RNode, dfg: DataflowGraph, env: REnvironmentInformation): RValue {
    
}