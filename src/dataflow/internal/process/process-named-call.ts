import type { DataflowProcessorInformation } from '../../processor';
import type { DataflowInformation } from '../../info';
import { processNamedCall } from './functions/call/named-call-handling';
import { wrapArgumentsUnnamed } from './functions/call/argument/make-argument';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RAstNodeBase, RNode, Location } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/**
 * Helper function for {@link processNamedCall} using the given `functionName` as the name of the function.
 */
export function processAsNamedCall<OtherInfo>(
	{ info, lexeme, location }: RNode<OtherInfo & ParentInformation> & RAstNodeBase<OtherInfo> & Location,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	name: string,
	args: readonly (RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined)[]
): DataflowInformation {
	return processNamedCall({
		type:    RType.Symbol,
		info,
		content: name,
		lexeme,
		location,
		ns:      undefined
	}, wrapArgumentsUnnamed(args, data.completeAst.idMap), info.id, data);
}
