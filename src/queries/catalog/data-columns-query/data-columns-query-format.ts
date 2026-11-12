import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { OutputFormatter } from '../../../util/text/ansi';
import { bold, italic } from '../../../util/text/ansi';
import Joi from 'joi';
import { queryHeader } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import type { ParsedQueryLine, SupportedQuery } from '../../query';
import { criteriaQueryCompleter, queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { AbstractInterpreter } from '../../../abstract-interpretation/absint-inference';
import type { DataFrameDomain } from '../../../abstract-interpretation/data-frame/dataframe-domain';
import { DataFrameShapeAnalysis } from '../../../abstract-interpretation/data-frame/shape-inference';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RPipe } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { Identifier } from '../../../dataflow/environments/identifier';
import { uniqueArray } from '../../../util/collections/arrays';
import { metaSince } from '../../query-meta';

/** the pipes that hand their left side to the call on their right as its data */
const Pipes = new Set(['|>', '%>%', '%<>%', '%T>%', '%$%']);

/** the operators binding a value to a name, whose sides are no data of the call that is evaluated within */
const Assignments = new Set(['<-', '=', '<<-', '->', '->>', ':=']);

/** the innermost node whose code holds `line`:`col`, where a cursor just past a name still counts as within it */
function innermostAt(idMap: AstIdMap, line: number, col: number, file: string | undefined): RNodeWithParent | undefined {
	let best: RNodeWithParent | undefined;
	let size = Infinity;
	for(const node of idMap.values()) {
		const range = RNode.span(node);
		if(range === undefined || (file !== undefined && node.info.file !== undefined && node.info.file !== file)) {
			continue;
		}
		const [sl, sc, el, ec] = range;
		if(line < sl || line > el || (line === sl && col < sc) || (line === el && col > ec + 1)) {
			continue;
		}
		const extent = (el - sl) * 100_000 + (ec - sc);
		if(extent < size) {
			best = node;
			size = extent;
		}
	}
	return best;
}

/** the arguments of a call or an operator, as the nodes of their values */
function operandsOf(node: RNodeWithParent): RNodeWithParent[] {
	if(RFunctionCall.is(node)) {
		return node.arguments.flatMap(arg => RArgument.valueOf(arg) ?? []);
	} else if(RBinaryOp.is(node) || RPipe.is(node)) {
		return [node.lhs, node.rhs];
	}
	return [];
}

/** the name of a call or an operator, `%>%` for both its forms */
function operatorOf(node: RNodeWithParent | undefined): string | undefined {
	if(RPipe.is(node)) {
		return '|>';
	} else if(RBinaryOp.is(node)) {
		return node.operator;
	} else if(RFunctionCall.isNamed(node)) {
		return String(Identifier.getName(node.functionName.content));
	}
	return undefined;
}

/** what a layered call like `ggplot(df) + geom_point(aes(...))` takes its data from: the operands of the calls to the left */
function leftLayers(node: RNodeWithParent): RNodeWithParent[] {
	const found: RNodeWithParent[] = [];
	let at: RNodeWithParent | undefined = node;
	while(RBinaryOp.is(at) && at.operator === '+') {
		at = at.lhs;
	}
	if(at !== undefined) {
		found.push(...operandsOf(at));
	}
	return found;
}

/**
 * The data frames whose columns can be written at `node`, nearest first: after `$` the accessed frame, and within
 * an argument flowR knows a call to evaluate within its data (as it does for every quoting call, whether it is
 * `filter`, `subset`, `with`, or `aes`) the other operands of that call, of a pipe into it, and of the layers left of it.
 */
function framesFor(node: RNodeWithParent, idMap: AstIdMap, dfg: DataflowGraph): { context: DataColumnsContext, candidates: RNodeWithParent[][] } | undefined {
	const parent = idMap.get(node.info.parent as NodeId);
	const access = RArgument.is(parent) ? idMap.get(parent.info.parent as NodeId) : undefined;
	if(RAccess.is(access) && (access.operator === '$' || access.operator === '@' || access.operator === '[[') && access.accessed !== node) {
		return { context: DataColumnsContext.Access, candidates: [[access.accessed]] };
	}
	if(!dfg.isQuoted(node.info.id)) {
		return undefined;
	}
	const candidates: RNodeWithParent[][] = [];
	let child = node;
	for(const ancestor of RNode.iterateParents(node, idMap)) {
		const op = operatorOf(ancestor);
		if(RFunctionCall.is(ancestor) || RBinaryOp.is(ancestor) || RPipe.is(ancestor)) {
			const around = ancestor.info.parent === undefined ? undefined : idMap.get(ancestor.info.parent);
			const outer = RArgument.is(around) ? idMap.get(around.info.parent as NodeId) : around;
			/* the other quoted operands are written in the same data mask (`y = mpg` next to `x = wt` in `aes`), and name columns, not data */
			const level = operandsOf(ancestor).filter(operand => operand !== child && !RNode.iterateParents(child, idMap).some(p => p === operand) && !dfg.isQuoted(operand.info.id));
			/* the pipe hands its left side on as the first argument */
			if(outer !== undefined && Pipes.has(operatorOf(outer) ?? '') && RArgument.valueOf(operandsOf(outer)[1]) === ancestor) {
				level.unshift(operandsOf(outer)[0]);
			}
			if(outer !== undefined && RBinaryOp.is(outer) && outer.operator === '+' && outer.rhs === ancestor) {
				level.push(...leftLayers(outer.lhs));
			}
			if(!(op !== undefined && (Pipes.has(op) || Assignments.has(op)))) {
				candidates.push(level);
			}
		}
		child = ancestor;
	}
	return { context: DataColumnsContext.Masked, candidates };
}

/** the shape of a frame, if flowR knows any of its columns */
function frameOf(node: RNodeWithParent, value: DataFrameDomain | undefined): DataColumnsFrame | undefined {
	if(value === undefined || !value.colnames.isValue()) {
		return undefined;
	}
	const must = [...value.colnames.must];
	const may = value.colnames.isFinite() ? [...value.colnames.may] : [];
	if(must.length + may.length === 0) {
		return undefined;
	}
	return { id: node.info.id, lexeme: RNode.lexeme(node), must, may, exact: value.colnames.isFinite() && may.length === 0 };
}

/**
 * Executes data columns queries: the data frame shape inference runs once for all of them.
 */
export async function executeDataColumnsQuery({ analyzer }: BasicQueryData, queries: readonly DataColumnsQuery[]): Promise<DataColumnsQueryResult> {
	const ast = await analyzer.normalize();
	const dfg = (await analyzer.dataflow()).graph;
	const cfg = await analyzer.controlflow();
	const start = Date.now();
	let interpreter: AbstractInterpreter<{ dataFrame: DataFrameDomain }> | undefined;
	const shapeOf = (node: RNodeWithParent): DataColumnsFrame | undefined => {
		if(interpreter === undefined) {
			interpreter = new AbstractInterpreter({ controlFlow: cfg, dfg, normalizedAst: ast, ctx: analyzer.inspectContext() }, new DataFrameShapeAnalysis({ trackOperations: false }));
			interpreter.start();
		}
		return frameOf(node, interpreter.getAbstractValue(node, 'dataFrame'));
	};
	const results: Record<string, DataColumnsAt> = {};
	for(const query of queries) {
		for(const position of query.positions) {
			const [line, col] = position.split(':').map(Number);
			const node = innermostAt(ast.idMap, line, col, query.file);
			const found = node === undefined ? undefined : framesFor(node, ast.idMap, dfg);
			let frames: DataColumnsFrame[] = [];
			/* the nearest call with a data frame of known columns is what the name is evaluated within */
			for(const level of found?.candidates ?? []) {
				frames = level.flatMap(candidate => shapeOf(candidate) ?? []);
				if(frames.length > 0) {
					break;
				}
			}
			results[position] = frames.length === 0 ? { columns: [], frames: [] } : {
				context: found?.context,
				columns: uniqueArray([...frames.flatMap(f => f.must), ...frames.flatMap(f => f.may)]),
				frames
			};
		}
	}
	return { ...metaSince(start), results };
}

/**
 * Asks which columns of a data frame can be written at a position of the code, as an editor offers them to complete:
 * after `df$` or `df[["`, and in every argument a call evaluates within its data, as `filter(penguins, bi)`,
 * `penguins |> mutate(r = bi)`, `subset(mtcars, mpg > 20)`, `with(iris, ...)`, or `ggplot(penguins, aes(x = bi))`.
 */
export interface DataColumnsQuery extends BaseQueryFormat {
	readonly type:      'data-columns';
	/**
	 * The positions to ask about, as `line:column` (both starting at 1) of the cursor, which may stand just past the
	 * name typed so far. The position has to fall within a node: an editor completing nothing typed yet inserts a
	 * placeholder name there first, as `filter(penguins, )` is no different from `filter(penguins)`.
	 */
	readonly positions: readonly string[];
	/** The file the positions are in, as flowR names it, if the analysis holds more than one. */
	readonly file?:     string;
}

/** How the columns can be written at the position. */
export enum DataColumnsContext {
	/** as the name accessed of a data frame, `df$col` or `df[["col"]]` */
	Access = 'access',
	/** as a name a call evaluates within its data, `filter(df, col > 1)` */
	Masked = 'masked'
}

/** One data frame whose columns can be written at a position. */
export interface DataColumnsFrame {
	/** the node of the data frame, e.g. the `penguins` of `filter(penguins, ...)` */
	readonly id:      NodeId
	/** the code of the node, if it has any of its own */
	readonly lexeme?: string
	/** the columns it surely has */
	readonly must:    readonly string[]
	/** the columns it may have as well */
	readonly may:     readonly string[]
	/** whether it has no other columns than these */
	readonly exact:   boolean
}

/** The columns that can be written at one position. */
export interface DataColumnsAt {
	/** how the columns are written there, absent where no data frame is in reach */
	readonly context?: DataColumnsContext
	/** every column of the {@link frames}, those they surely have first */
	readonly columns:  readonly string[]
	readonly frames:   readonly DataColumnsFrame[]
}

export interface DataColumnsQueryResult extends BaseQueryResult {
	/** the columns at each position asked about, by the position as given */
	readonly results: Record<string, DataColumnsAt>;
}

function dataColumnsLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'data-columns'> {
	const positions = sliceCriteriaParser(line[0]);
	return {
		query: { type: 'data-columns', positions: positions ?? [] },
		rCode: queryLineCode(line, positions ? 1 : 0)
	};
}

export const DataColumnsQueryDefinition = {
	title:           'Data Columns Query',
	executor:        executeDataColumnsQuery,
	asciiSummarizer: (formatter: OutputFormatter, _analyzer: unknown, queryResults: BaseQueryResult, result: string[]) => {
		const out = queryResults as DataColumnsQueryResult;
		result.push(queryHeader('data-columns', formatter, out['.meta'].timing));
		for(const [position, at] of Object.entries(out.results)) {
			if(at.context === undefined) {
				result.push(`   ╰ ${bold(position, formatter)}: ${italic('no data frame in reach', formatter)}`);
				continue;
			}
			const frames = at.frames.map(f => f.lexeme ?? String(f.id)).join(', ');
			result.push(`   ╰ ${bold(position, formatter)} (${at.context} of ${frames}): ${at.columns.join(', ')}`);
		}
		return true;
	},
	fromLine:  dataColumnsLineParser,
	completer: criteriaQueryCompleter,
	syntax:    '@data-columns (<line:col>;...) <code | file://path>',
	schema:    Joi.object({
		type:      Joi.string().valid('data-columns').required().description('The type of the query.'),
		positions: Joi.array().items(Joi.string().pattern(/^\d+:\d+$/)).min(1).required().description('The positions to ask about, as `line:column` of the cursor.'),
		file:      Joi.string().optional().description('The file the positions are in, if the analysis holds more than one.')
	}).description('The data columns query returns the columns of a data frame that can be written at a position, after `df$` or within the arguments a call evaluates within its data.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		return Object.values((queryResults as DataColumnsQueryResult).results).flatMap(at => at.frames.map(f => f.id));
	}
} as const satisfies SupportedQuery<'data-columns'>;
