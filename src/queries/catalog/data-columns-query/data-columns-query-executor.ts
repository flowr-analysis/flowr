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
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { Identifier } from '../../../dataflow/environments/identifier';
import { uniqueArray } from '../../../util/collections/arrays';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import { DataColumnsContext, type DataColumnsAt, type DataColumnsFrame, type DataColumnsQuery, type DataColumnsQueryResult } from './data-columns-query-format';

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

/** the value of an argument, or the node itself */
const valueOf = (node: RNodeWithParent | undefined): RNodeWithParent | undefined => RArgument.is(node) ? node.value : node;

/** the arguments of a call or an operator, as the nodes of their values */
function operandsOf(node: RNodeWithParent): RNodeWithParent[] {
	if(RFunctionCall.is(node)) {
		return node.arguments.flatMap(arg => valueOf(arg === undefined || typeof arg !== 'object' ? undefined : arg as RNodeWithParent) ?? []);
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
			if(outer !== undefined && Pipes.has(operatorOf(outer) ?? '') && valueOf(operandsOf(outer)[1]) === ancestor) {
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
