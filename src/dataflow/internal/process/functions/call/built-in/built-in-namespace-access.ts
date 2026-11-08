import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { ExitPointType } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { DataflowGraph } from '../../../../../graph/graph';
import { VertexType } from '../../../../../graph/vertex';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

/**
 * Processes `::` and `:::` when called as a function, e.g., `::`(ggplot2, a).
 * Constructs a namespaced symbol identical to what tree-sitter produces for `ggplot2::a`.
 */
export function processNamespaceAccess<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { internal: boolean }
): DataflowInformation {
	if(args.length !== 2 || RArgument.isEmpty(args[0]) || RArgument.isEmpty(args[1])) {
		dataflowLogger.warn(`Namespace access ${Identifier.toString(name.content)} does not have exactly 2 non-empty arguments, falling back`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.NamespaceAccess }).information;
	}

	const nsNode  = args[0].value;
	const symNode = args[1].value;

	let namespace:  string | undefined;
	let symbolName: string | undefined;

	if(RSymbol.is(nsNode)) {
		namespace = Identifier.getName(nsNode.content);
	} else if(nsNode && RString.is(nsNode)) {
		namespace = nsNode.content.str;
	}

	if(RSymbol.is(symNode)) {
		symbolName = Identifier.getName(symNode.content);
	} else if(symNode && RString.is(symNode)) {
		symbolName = symNode.content.str;
	}

	if(!namespace || !symbolName) {
		dataflowLogger.warn(`Namespace access ${Identifier.toString(name.content)} has non-symbol/string arguments, falling back`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.NamespaceAccess }).information;
	}

	const id = Identifier.make(symbolName, namespace, config.internal);

	return {
		unknownReferences: [{ nodeId: rootId, name: id, cds: data.cds, type: ReferenceType.Unknown }],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap).addVertex({
			tag: VertexType.Use,
			id:  rootId,
			cds: data.cds
		}, data.ctx.env.cleanEnv),
		entryPoint: rootId,
		exitPoints: [{ nodeId: rootId, type: ExitPointType.Default, cds: data.cds }],
		hooks:      []
	};
}
