import { type DataflowInformation, ExitPointType } from '../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../processor';
import { expensiveTrace, log } from '../../../../util/log';
import type { RParameter } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { ParentInformation } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type IdentifierDefinition, ReferenceType } from '../../../environments/identifier';
import { define } from '../../../environments/define';
import { EdgeType } from '../../../graph/edge';
import { ControlFlow } from '../../control-flow';
import { RFunctionDefinition } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';


/**
 * The dataflow of one function parameter: its name becomes a definition in the function's frame, and its
 * default value, if it has one, is processed in the same frame so it may read the parameters before it.
 * @param parameter - the parameter to process
 * @param data      - what the surrounding function definition is being processed with
 */
export function processFunctionParameter<OtherInfo>(parameter: RParameter<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const name = processDataflowFor(parameter.name, data);
	const defaultValue = parameter.defaultValue === undefined ? undefined : processDataflowFor(parameter.defaultValue, data);
	const graph = defaultValue === undefined ? name.graph : name.graph.mergeWith(defaultValue.graph);

	const writtenNodes: readonly (IdentifierDefinition & { name: string })[] = name.unknownReferences.map(n => ({
		...n,
		type:      ReferenceType.Parameter,
		definedAt: parameter.info.id
	}) as IdentifierDefinition & { name: string });

	// keep the default's environment so its escaping (`<<-`) writes are carried on
	let environment = defaultValue?.environment ?? name.environment;
	for(const writtenNode of writtenNodes) {
		const wid = writtenNode.nodeId;
		expensiveTrace(log, () => `parameter ${writtenNode.name} (${wid}) is defined at id ${writtenNode.definedAt} with ${defaultValue === undefined ? 'no default value' : ' a default value'}`);
		graph.setDefinitionOfVertex(writtenNode, defaultValue?.entryPoint ? [defaultValue?.entryPoint] : []);
		environment = define(writtenNode, false, environment);

		if(defaultValue !== undefined) {
			if(RFunctionDefinition.is(parameter.defaultValue)) {
				graph.addEdge(wid, parameter.defaultValue.info.id, EdgeType.DefinedBy);
			} else {
				const definedBy = defaultValue.in.concat(defaultValue.unknownReferences);
				for(const node of definedBy) {
					graph.addEdge(wid, node.nodeId, EdgeType.DefinedBy);
				}
			}
		}
	}

	const boundAt = name.entryPoint;
	if(defaultValue !== undefined) {
		ControlFlow.continuesWith(graph, defaultValue, boundAt);
		for(const exit of defaultValue.exitPoints) {
			/* R only forces a default when the parameter is used, so a jump within one does not cut the binding */
			if(exit.type !== ExitPointType.Default) {
				graph.addEdge(exit.nodeId, boundAt, EdgeType.FlowEdge);
			}
		}
	}

	return {
		unknownReferences: [],
		in:                defaultValue === undefined ? [] : defaultValue.in.concat(defaultValue.unknownReferences, name.in),
		out:               (defaultValue?.out ?? []).concat(name.out, name.unknownReferences),
		graph:             graph,
		environment:       environment,
		entryPoint:        parameter.info.id,
		cfgEntry:          defaultValue === undefined ? boundAt : ControlFlow.entryOf(defaultValue),
		cfgExit:           boundAt,
		exitPoints:        [{ nodeId: parameter.info.id, type: ExitPointType.Default, cds: data.cds }],
		hooks:             []
	};
}
