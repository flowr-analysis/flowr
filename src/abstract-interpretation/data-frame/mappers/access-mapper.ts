import { VariableResolve } from '../../../config';
import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RAccess, type RIndexAccess, type RNamedAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataFrameOperations, DataFrameShapeInferenceVisitor } from '../shape-inference';
import { getArgumentValue, isDataFrameArgument } from './arguments';
import { Resolve } from '../../../dataflow/environments/resolve-helper';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/** Maps a concrete data frame access operation to abstract data frame operations, or `undefined` if `node` is not one. */
export function mapDataFrameAccess(
	node: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): DataFrameOperations {
	if(!RAccess.is(node)) {
		return;
	}
	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx };

	if(isStringBasedAccess(node)) {
		return mapDataFrameNamedColumnAccess(node, inference, resolveInfo);
	} else {
		return mapDataFrameIndexColRowAccess(node, inference, resolveInfo);
	}
}

function mapDataFrameNamedColumnAccess(
	access: RNamedAccess<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = access.accessed;

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	}
	const colname = Resolve.argument.symbolName(access.access[0], info);

	return [{
		operation: 'accessCols',
		operand:   dataFrame.info.id,
		columns:   colname ? [colname] : undefined
	}];
}

function mapDataFrameIndexColRowAccess(
	access: RIndexAccess<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = access.accessed;
	const drop = getArgumentValue(access.access, 'drop', info);
	const exact = getArgumentValue(access.access, 'exact', info);
	const args = access.access.filter(arg => RArgument.isEmpty(arg) || RArgument.isUnnamed(arg));

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	} else if(args.every(arg => RArgument.isEmpty(arg))) {
		return [{ operation: 'identity', operand: dataFrame.info.id }];
	}
	const result: DataFrameOperations = [];

	const rowArg = args.length < 2 ? undefined : args[0];
	const colArg = args.length < 2 ? args[0] : args[1];
	let rows: number[] | undefined = undefined;
	let columns: string[] | number[] | undefined = undefined;

	if(rowArg !== undefined && rowArg !== EmptyArgument) {
		const rowValue = Resolve.argument.value(rowArg, info);

		if(typeof rowValue === 'number') {
			rows = [rowValue];
		} else if(Array.isArray(rowValue) && rowValue.every(row => typeof row === 'number')) {
			rows = rowValue;
		}
		result.push({
			operation: 'accessRows',
			operand:   dataFrame.info.id,
			rows:      rows?.map(Math.abs)
		});
	}
	if(colArg !== undefined && colArg !== EmptyArgument) {
		const colValue = Resolve.argument.value(colArg, info);

		if(typeof colValue === 'number') {
			columns = [colValue];
		} else if(typeof colValue === 'string' && exact !== false) {
			columns = [colValue];
		} else if(Array.isArray(colValue) && colValue.every(col => typeof col === 'number')) {
			columns = colValue;
		} else if(Array.isArray(colValue) && colValue.every(col => typeof col === 'string') && exact !== false) {
			columns = colValue;
		}
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.info.id,
			columns:   columns?.every(col => typeof col === 'number') ? columns.map(Math.abs) : columns
		});
	}
	// The data frame extent is dropped if the operator `[[` is used, the argument `drop` is true, or only one column is accessed
	const dropExtent = access.operator === '[[' ? true :
		args.length === 2 && typeof drop === 'boolean' ? drop :
			rowArg !== undefined && columns?.length === 1 && (typeof columns[0] === 'string' || columns[0] > 0);

	if(!dropExtent) {
		const rowSubset = rows === undefined || rows.every(row => row >= 0);
		const colSubset = columns === undefined || columns.every(col => typeof col === 'string' || col >= 0);
		const rowZero = rows?.length === 1 && rows[0] === 0;
		const colZero = columns?.length === 1 && columns[0] === 0;
		const duplicateCols = columns?.some((col, index, list) => list.indexOf(col as never) !== index);

		let operand: RNode<ParentInformation> | undefined = dataFrame;

		if(rowArg !== undefined && rowArg !== EmptyArgument) {
			if(rowSubset) {
				result.push({
					operation: 'subsetRows',
					operand:   operand?.info.id,
					rows:      rowZero ? 0 : rows?.filter(index => index !== 0).length
				});
			} else {
				result.push({
					operation: 'removeRows',
					operand:   operand?.info.id,
					rows:      rowZero ? 0 : rows?.filter(index => index !== 0).length,
					/* R drops nothing for an index beyond the extent, so the semantics has to know how far they reach */
					maxIndex:  rows !== undefined ? Math.max(...rows.map(Math.abs)) : undefined
				});
			}
			operand = undefined;
		}
		if(colArg !== undefined && colArg !== EmptyArgument) {
			if(colSubset) {
				result.push({
					operation: 'subsetCols',
					operand:   operand?.info.id,
					colnames:  colZero ? [] : columns?.map(col => typeof col === 'string' ? col : undefined),
					...(duplicateCols ? { options: { duplicateCols: true } } : {})
				});
			} else {
				result.push({
					operation: 'removeCols',
					operand:   operand?.info.id,
					colnames:  columns?.map(col => typeof col === 'string' ? col : undefined),
					maxIndex:  columns?.every(col => typeof col === 'number') ? Math.max(...columns.map(Math.abs)) : undefined
				});
			}
			// eslint-disable-next-line no-useless-assignment -- ends the chain
			operand = undefined;
		}
	}
	return result;
}

/** Checks whether an access node represents a string-based access (`$` or `@`), and no index-based access (`[` or `[[`). */
export function isStringBasedAccess(
	access: RAccess<ParentInformation>
): access is RNamedAccess<ParentInformation> {
	return access.operator === '$' || access.operator === '@';
}
