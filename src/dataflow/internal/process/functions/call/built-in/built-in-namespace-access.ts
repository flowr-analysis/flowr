import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { ExitPointType } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { type BrandedIdentifier, type BrandedNamespace, Identifier, ReferenceType } from '../../../../../environments/identifier';
import { DataflowGraph } from '../../../../../graph/graph';
import { VertexType } from '../../../../../graph/vertex';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';

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
	if(args.length !== 2 || args[0] === EmptyArgument || args[1] === EmptyArgument) {
		dataflowLogger.warn(`Namespace access ${Identifier.toString(name.content)} does not have exactly 2 non-empty arguments, falling back`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.NamespaceAccess }).information;
	}

	const nsNode  = args[0].value;
	const symNode = args[1].value;

	let namespace:  string | undefined;
	let symbolName: string | undefined;

	if(nsNode?.type === RType.Symbol) {
		namespace = Identifier.getName(nsNode.content);
	} else if(nsNode && RString.is(nsNode)) {
		namespace = nsNode.content.str;
	}

	if(symNode?.type === RType.Symbol) {
		symbolName = Identifier.getName(symNode.content);
	} else if(symNode && RString.is(symNode)) {
		symbolName = symNode.content.str;
	}

	if(!namespace || !symbolName) {
		dataflowLogger.warn(`Namespace access ${Identifier.toString(name.content)} has non-symbol/string arguments, falling back`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.NamespaceAccess }).information;
	}

	const id = Identifier.make(symbolName as BrandedIdentifier, namespace as BrandedNamespace, config.internal);

	return {
		unknownReferences: [{ nodeId: rootId, name: id, cds: data.cds, type: ReferenceType.Unknown }],
		in:                [],
		out:               [],
		environment:       data.environment,
		graph:             new DataflowGraph(data.completeAst.idMap).addVertex({
			tag: VertexType.Use,
			id:  rootId,
			cds: data.cds
		}, data.ctx.env.makeCleanEnv()),
		entryPoint: rootId,
		exitPoints: [{ nodeId: rootId, type: ExitPointType.Default, cds: data.cds }],
		hooks:      []
	};
}
