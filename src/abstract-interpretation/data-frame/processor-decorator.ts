import type { BuiltInIdentifierProcessorWithConfig } from '../../dataflow/environments/built-in';
import type { ForceArguments } from '../../dataflow/internal/process/functions/call/common';
import type { DataflowProcessorInformation } from '../../dataflow/processor';
import type { RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataFrameDomain } from './domain';
import type { DataFrameOperationName } from './semantics';
import { applyExpressionSemantics } from './semantics';

type BuiltInIdentifierProcessorDecorator<Config> = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: Config
) => void

export function decorateProcessor<Config>(
	processor: BuiltInIdentifierProcessorWithConfig<Config>,
	decorator: BuiltInIdentifierProcessorDecorator<Config>
): BuiltInIdentifierProcessorWithConfig<Config> {
	return (name, args, rootId, data, config) => {
		const result = processor(name, args, rootId, data, config);
		decorator(name, args, rootId, { ...data, environment: result.environment }, config);
		return result;
	};
}

export interface DataFrameOperation {
	operation: DataFrameOperationName,
	operand:   NodeId | undefined,
	arguments: (NodeId | undefined)[]
}

interface DataFrameStatementInfo {
	type:   'statement',
	domain: Map<NodeId, DataFrameDomain>
}

interface DataFrameAssignmentInfo {
	type:       'assignment',
	identifier: NodeId,
	expression: NodeId
}

interface DataFrameExpressionInfo {
	type:       'expression',
	operations: DataFrameOperation[]
}

interface DataFrameSymbolInfo {
	type:  'symbol',
	value: DataFrameDomain
}

type DataFrameInfo = DataFrameStatementInfo | DataFrameAssignmentInfo | DataFrameExpressionInfo | DataFrameSymbolInfo;

export interface AbstractInterpretationInfo {
	dataFrame?: DataFrameInfo
}

const DataFrameSpecialArguments = ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'];

export function processDataFrameFunctionCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	switch(name.content) {
		case 'data.frame':
			return processDataFrameCreate(name, args);
		case 'read.csv':
			return processDataFrameUnknownCreate(name);
	}
}

function processDataFrameCreate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'create',
			operand:   undefined,
			arguments: args
				.filter(arg => arg === EmptyArgument || arg.name === undefined || !DataFrameSpecialArguments.includes(arg.name.content))
				.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}

function processDataFrameUnknownCreate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   undefined,
			arguments: []
		}]
	};
}

export function processDataFrameAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { treatIndicesAsString: boolean } & ForceArguments
) {
	if(config.treatIndicesAsString) {
		processDataFrameStringBasedAccess(name, args);
	}
}

function processDataFrameStringBasedAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	const leftArg = args[0] !== EmptyArgument ? args[0] : undefined;
	const rightArg = args[1] !== EmptyArgument ? args[1]: undefined;

	if(args.length === 2 && leftArg !== undefined && rightArg !== undefined) {
		name.info.dataFrame = {
			type:       'expression',
			operations: [{
				operation: 'accessCol',
				operand:   leftArg.info.id,
				arguments: [rightArg.info.id]
			}]
		};
	}
}

export function processDataFrameAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[]
) {
	const leftArg = args[0] !== EmptyArgument ? args[0] : undefined;
	const rightArg = args[1] !== EmptyArgument ? args[1] : undefined;

	if(args.length === 2 && leftArg?.value?.type === RType.Symbol && rightArg?.value !== undefined) {
		name.info.dataFrame = {
			type:       'assignment',
			identifier: leftArg.value.info.id,
			expression: rightArg.value.info.id
		};
	}
}

export function processDataFrameExpressionList<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation & AbstractInterpretationInfo>
) {
	const domain: Map<NodeId, DataFrameDomain> = new Map();

	for(const arg of args) {
		if(arg !== EmptyArgument && arg.value?.info.dataFrame?.type === 'assignment') {
			const resolveInfo = { environment: data.environment, idMap: data.completeAst.idMap, full: true };
			const identifier = resolveInfo.idMap.get(arg.value.info.dataFrame.identifier);
			const expression = resolveInfo.idMap.get(arg.value.info.dataFrame.expression);

			if(identifier?.type === RType.Symbol && expression !== undefined) {
				const dataFrameDomain = applyExpressionSemantics(expression, domain, resolveInfo);

				if(dataFrameDomain !== undefined) {
					domain.set(identifier.info.id, dataFrameDomain);
					identifier.info.dataFrame = {
						type:  'symbol',
						value: dataFrameDomain
					};
				}
			}
		}
	}
}
