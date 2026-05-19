import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { BuiltInProcName } from '../../../../../environments/built-in';
import type { InGraphReferenceType } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import { RDAParser } from '../../../../../../project/plugins/file-plugins/files/flowr-rda-file';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { removeRQuotes } from '../../../../../../r-bridge/retriever';
import { findSource } from './built-in-source';
import { FlowrTextFile } from '../../../../../../project/context/flowr-file';
import { EdgeType } from '../../../../../graph/edge';
import { VertexType } from '../../../../../graph/vertex';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';

/**
 * Processes a built-in 'load' function call.
 */
export function processLoad<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(args.length === 0) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const sourceFileArgument = args[0];
	let sourceFile: string[] | undefined;

	if(sourceFileArgument !== EmptyArgument && sourceFileArgument?.value?.type === RType.String) {
		sourceFile = [removeRQuotes(sourceFileArgument.lexeme)];
	} else if(sourceFileArgument !== EmptyArgument) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	if(sourceFile?.length === 1) {
		const path = removeRQuotes(sourceFile[0]);
		let filepath = path ? findSource(data.ctx.config.solver.resolveSource, path, data) : path;

		if(Array.isArray(filepath)) {
			filepath = filepath?.[0];
		}

		if(filepath !== undefined) {
			const rdaParser = new RDAParser();
			const variables = rdaParser.parseRDA(new FlowrTextFile(filepath), true);

			if(variables) {
				const fn = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Load });
				let envir = fn.information.environment;

				const loadLocation = data.completeAst.idMap.get(rootId)?.location;

				for(const variable of variables) {
					if(variable.name) {
						const syntheticId = `${rootId}:loaded:${variable.name.replaceAll('.', '_')}`;

						data.completeAst.idMap.set(syntheticId, {
							type:      RType.Symbol,
							content:   variable.name,
							lexeme:    variable.name,
							location:  loadLocation,
							namespace: undefined,
							info:      {
								id:      syntheticId,
								parent:  rootId,
								depth:   0,
								index:   0,
								role:    RoleInParent.ExpressionListChild,
								nesting: 0
							}
						} as unknown as RSymbol<OtherInfo & ParentInformation>);

						fn.information.graph.addVertex({
							tag: VertexType.VariableDefinition,
							id:  syntheticId,
							cds: data.cds,
						}, envir);

						fn.information.graph.addEdge(syntheticId, rootId, EdgeType.DefinedBy);

						const nodeToDefine = {
							nodeId:    syntheticId,
							name:      variable.name,
							type:      SexpTypeToReferenceType(variable.type) as InGraphReferenceType,
							definedAt: rootId,
							cds:       data.cds,
						};
						fn.information.graph.setDefinitionOfVertex(nodeToDefine);
						const newCurrent = envir.current.define(nodeToDefine, data.ctx.config);
						envir = { ...envir, current: newCurrent };
					}
				}

				return { ...fn.information, environment: envir };
			}
		}
	}

	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Load }).information;
}

function SexpTypeToReferenceType(type?: number): ReferenceType{
	if(!type){
		return ReferenceType.Unknown;
	}
	switch(type) {
		case 0: // NULL
			return ReferenceType.Unknown;
		case 1: // symbol
		case 9: // character
		case 10: // logical
		case 13: // integer
		case 14: // double
		case 15: // complex
		case 16: // character/string
		case 24: // raw
			return ReferenceType.Constant;
		case 2: // pairlist
		case 4: // env
		case 5: // prom
		case 6: // language
		case 17: // ...
		case 19: // list
		case 20: // expression
		case 25: // S4
			return ReferenceType.Variable;
		case 3: // closure
			return ReferenceType.Function;
		case 7: // special
		case 8: // builtin
			return ReferenceType.BuiltInFunction;
		default:
			return ReferenceType.Unknown;
	}
}