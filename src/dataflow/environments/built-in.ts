import type { DataflowProcessorInformation } from '../processor';
import type { ExitPointType , DataflowInformation  } from '../info';
import { processKnownFunctionCall } from '../internal/process/functions/call/known-call-handling';
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access';
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else';
import { processAssignment } from '../internal/process/functions/call/built-in/built-in-assignment';
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-special-bin-op';
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe';
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-repeat-loop';
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-while-loop';
import type { Identifier, IdentifierDefinition, IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import { assertUnreachable, guard } from '../../util/assert';
import { processReplacementFunction } from '../internal/process/functions/call/built-in/built-in-replacement';
import { processQuote } from '../internal/process/functions/call/built-in/built-in-quote';
import { processFunctionDefinition } from '../internal/process/functions/call/built-in/built-in-function-definition';
import { processExpressionList } from '../internal/process/functions/call/built-in/built-in-expression-list';
import { processGet } from '../internal/process/functions/call/built-in/built-in-get';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EdgeType } from '../graph/edge';
import { processLibrary } from '../internal/process/functions/call/built-in/built-in-library';
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source';
import type { ForceArguments } from '../internal/process/functions/call/common';
import { processApply } from '../internal/process/functions/call/built-in/built-in-apply';
import { registerBuiltInDefinitions } from './built-in-config';
import { DefaultBuiltinConfig } from './default-builtin-config';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import { processList } from '../internal/process/functions/call/built-in/built-in-list';
import { resolveIdToValue, type ResolveInfo } from './resolve-by-name';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { visitAst } from '../../r-bridge/lang-4.x/ast/model/processing/visitor';

export const BuiltIn = 'built-in';

export type BuiltInIdentifierProcessor = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
) => DataflowInformation

export type BuiltInIdentifierProcessorWithConfig<Config> = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: Config
) => DataflowInformation

export interface BuiltInIdentifierDefinition extends IdentifierReference {
	type:      ReferenceType.BuiltInFunction
	definedAt: typeof BuiltIn
	processor: BuiltInIdentifierProcessor
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	type:      ReferenceType.BuiltInConstant
	definedAt: typeof BuiltIn
	value:     T
}

export interface DefaultBuiltInProcessorConfiguration extends ForceArguments {
	readonly returnsNthArgument?:    number | 'last',
	readonly cfg?:                   ExitPointType,
	readonly readAllArguments?:      boolean,
	readonly hasUnknownSideEffects?: boolean | LinkTo<RegExp | string>
}

function defaultBuiltInProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: DefaultBuiltInProcessorConfiguration
): DataflowInformation {
	const { information: res, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs });
	if(config.returnsNthArgument !== undefined) {
		const arg = config.returnsNthArgument === 'last' ? processedArguments[args.length - 1] : processedArguments[config.returnsNthArgument];
		if(arg !== undefined) {
			res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Returns);
		}
	}
	if(config.readAllArguments) {
		for(const arg of processedArguments) {
			if(arg) {
				res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
			}
		}
	}

	if(config.hasUnknownSideEffects) {
		if(typeof config.hasUnknownSideEffects !== 'boolean') {
			res.graph.markIdForUnknownSideEffects(rootId, config.hasUnknownSideEffects);
		} else {
			res.graph.markIdForUnknownSideEffects(rootId);
		}
	}

	if(config.cfg !== undefined) {
		res.exitPoints = [...res.exitPoints, { type: config.cfg, nodeId: rootId, controlDependencies: data.controlDependencies }];
	}
	processDataFrameFunctionCall(name, args, rootId, data, config);

	return res;
}

export function registerBuiltInFunctions<Config, Proc extends BuiltInIdentifierProcessorWithConfig<Config>>(
	both:      boolean,
	names:     readonly Identifier[],
	processor: Proc,
	config:    Config
): void {
	for(const name of names) {
		guard(processor !== undefined, `Processor for ${name} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const d: IdentifierDefinition[] = [{
			type:                ReferenceType.BuiltInFunction,
			definedAt:           BuiltIn,
			controlDependencies: undefined,
			processor:           (name, args, rootId, data) => processor(name, args, rootId, data, config),
			name,
			nodeId:              BuiltIn
		}];
		BuiltInMemory.set(name, d);
		if(both) {
			EmptyBuiltInMemory.set(name, d);
		}
	}
}

export const BuiltInProcessorMapper = {
	'builtin:default':             defaultBuiltInProcessor,
	'builtin:apply':               processApply,
	'builtin:expression-list':     processExpressionList,
	'builtin:source':              processSourceCall,
	'builtin:access':              processAccess,
	'builtin:if-then-else':        processIfThenElse,
	'builtin:get':                 processGet,
	'builtin:library':             processLibrary,
	'builtin:assignment':          processAssignment,
	'builtin:special-bin-op':      processSpecialBinOp,
	'builtin:pipe':                processPipe,
	'builtin:function-definition': processFunctionDefinition,
	'builtin:quote':               processQuote,
	'builtin:for-loop':            processForLoop,
	'builtin:repeat-loop':         processRepeatLoop,
	'builtin:while-loop':          processWhileLoop,
	'builtin:replacement':         processReplacementFunction,
	'builtin:list':                processList
} as const satisfies Record<`builtin:${string}`, BuiltInIdentifierProcessorWithConfig<never>>;

export type BuiltInMappingName = keyof typeof BuiltInProcessorMapper;
export type ConfigOfBuiltInMappingName<N extends BuiltInMappingName> = Parameters<typeof BuiltInProcessorMapper[N]>[4];

export const BuiltInMemory = new Map<Identifier, IdentifierDefinition[]>();
export const EmptyBuiltInMemory = new Map<Identifier, IdentifierDefinition[]>();

registerBuiltInDefinitions(DefaultBuiltinConfig);

type DataFrameOperation = 'create' | 'unknown';

interface DataFrameEvent {
	type:      DataFrameOperation,
	operand:   NodeId | undefined,
	arguments: (NodeId | undefined)[]
}

type Interval = [number, number];
type IntervalDomain = Interval | 'bottom';
const IntervalBottom: IntervalDomain = 'bottom';
const IntervalTop: IntervalDomain = [0, Infinity];

type ColNamesDomain = string[] | 'top';
const ColNamesBottom: ColNamesDomain = [];
const ColNamesTop: ColNamesDomain = 'top';

interface DataFrameDomain {
	colnames: ColNamesDomain,
	cols:     IntervalDomain,
	rows:     IntervalDomain
}
const DataFrameTop: DataFrameDomain = {
	colnames: ColNamesTop,
	cols:     IntervalTop,
	rows:     IntervalTop
};

interface AbstractInterpretationInfo {
	dataFrame?: {
		events: DataFrameEvent[],
		domain: DataFrameDomain
	}
}

const DataFrameSpecialArguments = ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'];

function processDataFrameFunctionCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: DefaultBuiltInProcessorConfiguration
) {
	switch(name.content) {
		case 'data.frame':
			return processDataFrameCreate(name, args, rootId, data, config);
		case 'read.csv':
			return processDataFrameUnknownCreate(name, args, rootId, data, config);
		default:
			return processDataFrameUnknownCall(name, args, rootId, data, config);
	}
}

function processDataFrameCreate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: DefaultBuiltInProcessorConfiguration
) {
	name.info.dataFrame ??= { events: [], domain: DataFrameTop };
	name.info.dataFrame.events.push({
		type:      'create',
		operand:   undefined,
		arguments: args
			.filter(arg => arg === EmptyArgument || arg.name === undefined || !DataFrameSpecialArguments.includes(arg.name.content))
			.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
	});
}

function processDataFrameUnknownCreate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: DefaultBuiltInProcessorConfiguration
) {
	name.info.dataFrame ??= { events: [], domain: DataFrameTop };
	name.info.dataFrame.events.push({
		type:      'unknown',
		operand:   undefined,
		arguments: []
	});
}

function processDataFrameUnknownCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: DefaultBuiltInProcessorConfiguration
) {
	const dataFrameArg = args.find((arg): arg is RArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo> => arg !== EmptyArgument && arg.value !== undefined && arg.value.info.dataFrame !== undefined);

	if(dataFrameArg) {
		name.info.dataFrame ??= { events: [], domain: DataFrameTop };
		name.info.dataFrame.events.push({
			type:      'unknown',
			operand:   dataFrameArg.info.id,
			arguments: []
		});
	}
}

export function processDataFrameExpressionList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
) {
	visitAst(data.completeAst.ast, node => {
		if('dataFrame' in node.info) {
			const dataFrameInfo = (node.info as AbstractInterpretationInfo).dataFrame;
			console.log(node.info.id, node.lexeme, dataFrameInfo?.events, applyDataFrameSemantics(dataFrameInfo?.events[0]!, { environment: data.environment, idMap: data.completeAst.idMap, full: true }));
		}
	});
}

function applyDataFrameSemantics(event: DataFrameEvent, data: ResolveInfo): DataFrameDomain {
	switch(event.type) {
		case 'create': {
			const argNames = event.arguments.map(arg => arg ? resolveIdToArgName(arg, data) : undefined);
			const argLengths = event.arguments.map(arg => arg ? resolveIdToArgVectorLength(arg, data) : undefined);
			const colnames = argNames.some(arg => arg === undefined) ? ColNamesTop : argNames as ColNamesDomain;
			const rowCount = argLengths.some(arg => arg === undefined) ? undefined : Math.max(...argLengths as number[], 0);

			return {
				colnames: colnames,
				cols:     [event.arguments.length, event.arguments.length],
				rows:     rowCount !== undefined ? [rowCount, rowCount] : IntervalTop
			};
		}
		case 'unknown': {
			return DataFrameTop;
		}
		default:
			assertUnreachable(event.type);
	}
}

function resolveIdToArgName(id: NodeId | RNodeWithParent, { graph, idMap } : ResolveInfo): string | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type === RType.Argument) {
		return node.name?.content;
	}
	return undefined;
}

function resolveIdToArgVectorLength(id: NodeId | RNodeWithParent, { environment, graph, idMap, full } : ResolveInfo): number | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);

	if(node?.type !== RType.Argument || node.value === undefined) {
		return undefined;
	}
	const resolvedValue = resolveIdToValue(node.value, { environment, graph, idMap, full });

	if(resolvedValue?.length === 1) {
		return Array.isArray(resolvedValue[0]) ? resolvedValue[0].length : undefined;
	}
	return undefined;
}
