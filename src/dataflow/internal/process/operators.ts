import type {ParentInformation, RBinaryOp, RNode} from '../../../r-bridge'
import { RType } from '../../../r-bridge'
import type { DataflowProcessorInformation } from '../../processor'
import type { DataflowInformation } from '../../info'
import { processNamedFunctionCall } from './functions/call/named-call-handling'
import {toUnnamedArgument, toUnnamedArguments} from './functions/call/argument/make-argument'

export function processOperator<OtherInfo>(
    op: RNode<OtherInfo & ParentInformation>,
    args: readonly (RNode<OtherInfo & ParentInformation> | undefined)[],
    data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
    return processNamedFunctionCall({
        type:      RType.Symbol,
        info:      op.info,
        content:   op.lexeme,
        lexeme:    op.lexeme,
        location:  op.location,
        namespace: undefined
    }, toUnnamedArguments(args, data.completeAst.idMap), op.info.id, data)
}
