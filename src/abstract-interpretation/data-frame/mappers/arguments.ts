import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { isUseVertex, VertexType } from '../../../dataflow/graph/vertex';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RFunctionArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RNull } from '../../../r-bridge/lang-4.x/convert-values';
import type { AbstractInterpretationInfo } from '../absint-info';
import { resolveIdToDataFrameShape } from '../shape-inference';
import { resolveIdToArgName, resolveIdToArgValue, unquoteArgument } from '../resolve-args';

/** Regular expression representing valid columns names, e.g. for `data.frame` */
const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

/**
 * The location of a function parameter for mapping function call arguments to function parameters.
 * - `pos` contains the position of the function parameter (use `-1` for non-existent or non-positional arguments)
 * - `name` optionally contains the name of the function parameter
 * - `default` optionally contains the default value of the function parameter
 */
export interface FunctionParameterLocation<T = undefined> {
    pos:      number,
    name?:    string
    default?: T
}

/**
 * Escapes a regular expression given as string by escaping all special regular expression characters.
 *
 * @param text        - The text to escape
 * @param allowTokens - Whether to allow and keep unescaped tokens like `\s`, `\t`, or `\n`
 * @returns The escaped text
 */
export function escapeRegExp(text: string, allowTokens: boolean = false): string {
	if(allowTokens) {  // only allow and keep the tokens `\s`, `\t`, and `\n` in the text
		return text.replace(/[.*+?^${}()|[\]]|\\[^stn]/g, '\\$&');
	} else {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}

/**
 * Maps all invalid, duplicate, or empty column names to top depending on the provided arguments.
 *
 * @param colnames     - The columns names to filter
 * @param checkNames   - Whether to map all invalid column names to top (`undefined`)
 * @param noDupNames   - Whether to map all duplicate column names to top (`undefined`)
 * @param noEmptyNames - Whether to map all empty column names to top (`undefined`)
 * @returns The filtered column names
 */
export function filterValidNames(
	colnames: (string | undefined)[] | undefined,
	checkNames?: boolean,
	noDupNames?: boolean,
	noEmptyNames?: boolean
): (string | undefined)[] | undefined {
	if(checkNames) {  // map all invalid column names to top
		colnames = colnames?.map(entry => isValidColName(entry) ? entry : undefined);
	}
	if(noDupNames) {  // map all duplicate column names to top
		colnames = colnames?.map((entry, _, list) => entry !== undefined && list.filter(other => other === entry).length === 1 ? entry : undefined);
	}
	if(noEmptyNames) {  // map all empty column names to top
		colnames = colnames?.map(entry => entry?.length === 0 ? undefined : entry);
	}
	return colnames;
}

/**
 * Gets the value of an argument that specified as {@link FunctionParameterLocation}.
 *
 * @param args     - The arguments to get the requested argument from
 * @param argument - The specification of the argument to get the value for
 * @param info     - Argument resolve information
 * @returns The resolved value of the argument or `undefined`
 */
export function getArgumentValue<T>(
	args: readonly RFunctionArgument<ParentInformation>[],
	argument: FunctionParameterLocation<T> | string,
	info: ResolveInfo
) {
	const arg = getFunctionArgument(args, argument, info);
	const defaultValue = typeof argument !== 'string' ? argument.default : undefined;

	return arg !== undefined ? resolveIdToArgValue(arg, info) : defaultValue;
}

/**
 * Gets all effective argument from a list of arguments by removing all arguments whose names should be excluded.
 *
 * @param args     - The list of arguments to filter
 * @param excluded - The names of the arguments to exclude
 * @returns The filtered list of arguments
 */
export function getEffectiveArgs(
	args: readonly RFunctionArgument<ParentInformation>[],
	excluded: string[]
): readonly RFunctionArgument<ParentInformation>[] {
	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !excluded.includes(unquoteArgument(arg.name.content)));
}

/**
 * Gets an argument specified as {@link FunctionParameterLocation} from a list of arguments.
 *
 * @param args     - The arguments to get the requested argument from
 * @param argument - The specification of the argument to get
 * @param info     - Argument resolve information
 * @returns An argument matching the specified `argument` or `undefined`
 */
export function getFunctionArgument(
	args: readonly RFunctionArgument<ParentInformation>[],
	argument: FunctionParameterLocation<unknown> | string,
	info: ResolveInfo
): RFunctionArgument<ParentInformation> | undefined {
	const pos = typeof argument !== 'string' ? argument.pos : -1;
	const name = typeof argument !== 'string' ? argument.name : argument;
	let arg = undefined;

	if(name !== undefined) {
		arg = args.find(arg => resolveIdToArgName(arg, info) === name);
	}
	const hasArgPos = arg === undefined && pos >= 0 && pos < args.length && args[pos] !== EmptyArgument && args[pos].name === undefined;

	if(hasArgPos) {
		arg = args[pos];
	}
	return arg;
}

/**
 * Get all function arguments of a function call node in the data flow graph.
 *
 * @param node - The function call node to get the arguments for
 * @param dfg  - The data flow graph for retrieving the arguments
 * @returns The arguments of the function call in the data flow graph
 */
export function getFunctionArguments(
	node: RFunctionCall<ParentInformation>,
	dfg: DataflowGraph
): readonly RFunctionArgument<ParentInformation>[] {
	const vertex = dfg.getVertex(node.info.id);

	if(vertex?.tag === VertexType.FunctionCall && dfg.idMap !== undefined) {
		const idMap = dfg.idMap;

		return vertex.args
			.map(arg => arg === EmptyArgument ? arg : idMap.get(arg.nodeId))
			.map(arg => arg === EmptyArgument || arg?.type === RType.Argument ? arg : toUnnamedArgument(arg, idMap));
	}
	return node.arguments;
}

/**
 * Gets all nested symbols in an expression that have no outgouing edges in the data flow graph.
 * @param expression - The expression to get the symbols from
 * @param dfg        - The data flow graph for checking the outgoing edges
 * @returns The name of all unresolved symbols in the expression
 */
export function getUnresolvedSymbolsInExpression(
	expression: RNode<ParentInformation> | typeof EmptyArgument | undefined,
	dfg?: DataflowGraph
): string[] {
	if(expression === undefined || expression === EmptyArgument || dfg === undefined) {
		return [];
	}
	switch(expression.type) {
		case RType.ExpressionList:
			return [...expression.children.flatMap(child => getUnresolvedSymbolsInExpression(child, dfg))];
		case RType.FunctionCall:
			return [...expression.arguments.flatMap(arg => getUnresolvedSymbolsInExpression(arg, dfg))];
		case RType.UnaryOp:
			return [...getUnresolvedSymbolsInExpression(expression.operand, dfg)];
		case RType.BinaryOp:
			return [...getUnresolvedSymbolsInExpression(expression.lhs, dfg), ...getUnresolvedSymbolsInExpression(expression.rhs, dfg)];
		case RType.Access:
			return [...getUnresolvedSymbolsInExpression(expression.accessed, dfg), ...expression.access.flatMap(arg => getUnresolvedSymbolsInExpression(arg, dfg))];
		case RType.Pipe:
			return [...getUnresolvedSymbolsInExpression(expression.lhs, dfg), ...getUnresolvedSymbolsInExpression(expression.rhs, dfg)];
		case RType.Argument:
			return [...getUnresolvedSymbolsInExpression(expression.value, dfg)];
		case RType.Symbol:
			if(isUseVertex(dfg.getVertex(expression.info.id)) && (dfg.outgoingEdges(expression.info.id)?.size ?? 0) === 0) {
				return [unquoteArgument(expression.content)];
			} else {
				return [];
			}
		default:
			return [];
	}
}

/**
 * Checks whether a list of arguments contains any critical argument.
 *
 * @param args     - The list of arguments to check
 * @param critical - The critical arguments to search for (as string or {@link FunctionParameterLocation}s)
 * @param info     - Argument resolve information
 * @returns Whether the arguments contain any critical argument
 */
export function hasCriticalArgument(
	args: readonly RFunctionArgument<ParentInformation>[],
	critical: (FunctionParameterLocation<unknown> | string)[] | undefined,
	info: ResolveInfo
): boolean {
	for(const param of critical ?? []) {
		const arg = getFunctionArgument(args, param, info);

		if(arg === undefined) {
			continue;
		} else if(typeof param !== 'string' && param.default !== undefined) {
			const value = resolveIdToArgValue(arg, info);

			if(value !== undefined && value === param.default) {
				continue;
			}
		}
		return true;
	}
	return false;
}

/**
 * Checks if a given argument has any data frame shape information and therefore may represent a data frame.
 *
 * @param arg  - The argument to check
 * @param info - Argument resolve information
 * @returns Whether the argument has any data frame shape information and may represent a data frame
 */
export function isDataFrameArgument(arg: RNode<ParentInformation> | undefined, info: ResolveInfo):
	arg is RNode<ParentInformation & Required<AbstractInterpretationInfo>>;
export function isDataFrameArgument(arg: RFunctionArgument<ParentInformation> | undefined, info: ResolveInfo):
	arg is RArgument<ParentInformation & Required<AbstractInterpretationInfo>> & { value: RNode<ParentInformation & Required<AbstractInterpretationInfo>> };
export function isDataFrameArgument(arg: RNode<ParentInformation> | RFunctionArgument<ParentInformation> | undefined, info: ResolveInfo): boolean {
	return arg !== EmptyArgument && resolveIdToDataFrameShape(arg, info.graph) !== undefined;
}

/**
 * Checks whether a function argument is a names argument.
 */
export function isNamedArgument(
	arg: RFunctionArgument<ParentInformation> | undefined
): arg is RArgument<ParentInformation> & { name: RSymbol<ParentInformation> } {
	return arg !== EmptyArgument && arg?.name !== undefined;
}

/**
 * Checks whether a node is `NULL` in R (represents a `NULL` symbol).
 */
export function isRNull(node: RNode<ParentInformation> | undefined):
	node is RSymbol<ParentInformation, typeof RNull>;
export function isRNull(node: RFunctionArgument<ParentInformation> | undefined):
	node is RArgument<ParentInformation> & { value: RSymbol<ParentInformation, typeof RNull> };
export function isRNull(node: RNode<ParentInformation> | RFunctionArgument<ParentInformation> | undefined): boolean  {
	if(node === EmptyArgument || node?.type === RType.Argument) {
		return node !== EmptyArgument && isRNull(node.value);
	}
	return node?.type === RType.Symbol && node.content === RNull;
}

/**
 * Checks whether a string is a valid columns name according to the flag `check.names` in R.
 */
export function isValidColName(colname: string | undefined): boolean {
	return colname !== undefined && ColNamesRegex.test(colname);
}
