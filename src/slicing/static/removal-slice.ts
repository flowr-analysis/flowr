import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { DataflowInformation } from '../../dataflow/info';
import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { staticSlice } from './static-slicer';
import { SliceDirection } from '../../util/slice-direction';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { EdgeType } from '../../dataflow/graph/edge';
import type { DependencyInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';

/** What removing code for a set of criteria takes out of the program. */
export interface RemovalSliceResult {
	/** the statements removed as a whole, outermost first */
	readonly removed: readonly NodeId[]
	/** every node of the removed statements */
	readonly result:  ReadonlySet<NodeId>
}

const DeviceOpeners: ReadonlySet<string> = new Set(['pdf', 'png', 'jpeg', 'jpg', 'tiff', 'bmp', 'svg', 'cairo_pdf', 'cairo_ps', 'postscript', 'win.metafile', 'x11', 'dev.new']);
const DeviceClosers: ReadonlySet<string> = new Set(['dev.off', 'graphics.off']);
const Silencers: ReadonlySet<string> = new Set(['invisible', 'suppressWarnings', 'suppressMessages', 'suppressPackageStartupMessages']);

/** the statements of the program: the children of every block, but not those of a function body, which only runs when called */
function statementsOf(ast: NormalizedAst): Map<NodeId, RNodeWithParent> {
	const result = new Map<NodeId, RNodeWithParent>();
	RNode.visitAst(ast.ast.files.map(f => f.root), node => {
		if(RExpressionList.is(node)) {
			for(const child of node.children) {
				result.set(child.info.id, child);
			}
		}
		return RFunctionDefinition.is(node);
	});
	return result;
}

/** the innermost statement holding `id` */
function statementOf(ast: NormalizedAst, statements: ReadonlyMap<NodeId, RNodeWithParent>, id: NodeId): RNodeWithParent | undefined {
	for(let node = ast.idMap.get(id); node; node = node.info.parent === undefined ? undefined : ast.idMap.get(node.info.parent)) {
		if(statements.has(node.info.id)) {
			return node;
		}
	}
	return undefined;
}

function within(ast: NormalizedAst, id: NodeId, ancestor: NodeId): boolean {
	for(let at: NodeId | undefined = id; at !== undefined; at = ast.idMap.get(at)?.info.parent) {
		if(at === ancestor) {
			return true;
		}
	}
	return false;
}

/** the call a statement makes, past the wrappers that only hide its value (`invisible(dev.off())`) */
function callOf(node: RNodeWithParent | undefined): RNodeWithParent | undefined {
	while(RFunctionCall.isNamed(node, Silencers) && node.arguments.length === 1) {
		node = RArgument.valueOf(node.arguments[0]);
	}
	return node;
}

const isNamed = (node: RNodeWithParent | undefined, names: ReadonlySet<string>) => RFunctionCall.isNamed(callOf(node), names);

/**
 * The calls between a device and its `dev.off()` around each criterion (`pdf()`, `plot()`, `dev.off()`): removing what is
 * drawn removes the device it is drawn on. Assignments in between stay to the slice, as the rest may use them.
 */
function deviceWindows(ast: NormalizedAst, statements: ReadonlyMap<NodeId, RNodeWithParent>, ids: readonly NodeId[]): NodeId[] {
	const found = new Set<NodeId>();
	for(const id of ids) {
		const statement = statementOf(ast, statements, id);
		const block = statement?.info.parent === undefined ? undefined : ast.idMap.get(statement.info.parent);
		if(statement === undefined || !RExpressionList.is(block)) {
			continue;
		}
		const siblings = block.children;
		const at = siblings.indexOf(statement);
		let open = at;
		while(open >= 0 && !isNamed(siblings[open], DeviceOpeners) && (open === at || !isNamed(siblings[open], DeviceClosers))) {
			open--;
		}
		let close = at;
		while(close < siblings.length && !isNamed(siblings[close], DeviceClosers) && (close === at || !isNamed(siblings[close], DeviceOpeners))) {
			close++;
		}
		if(open < 0 || close >= siblings.length || !isNamed(siblings[open], DeviceOpeners) || !isNamed(siblings[close], DeviceClosers)) {
			continue;
		}
		for(const sibling of siblings.slice(open, close + 1)) {
			if(!RBinaryOp.is(sibling) || RBinaryOp.getOperatorInfo(sibling)?.usedAs !== 'assignment') {
				found.add(sibling.info.id);
			}
		}
	}
	return [...found];
}

/** a definition the code that is left still reads, `undefined` if there is none */
function danglingRead(info: DataflowInformation, removed: ReadonlySet<NodeId>): NodeId | undefined {
	for(const [id] of info.graph.vertices(true)) {
		if(!removed.has(id)) {
			const target = Dataflow.targetsOf(info.graph, id, EdgeType.Reads).find(t => removed.has(t));
			if(target !== undefined) {
				return target;
			}
		}
	}
	return undefined;
}

/**
 * What is left of the program once a removal slice took `removed` out: every node but those and the roots of the files,
 * as a root selected would keep every removed function as a stub.
 */
export function keptAfterRemoval(ast: NormalizedAst, removed: ReadonlySet<NodeId>): Set<NodeId> {
	return new Set([...ast.idMap.entries()].filter(([id, node]) => !removed.has(id) && node.info.parent !== undefined).map(([id]) => id));
}

/**
 * The removal slice of `ids`: the statements of their backward slice that nothing else in the program needs, so removing
 * them removes the criteria and everything that only exists for them while the rest keeps working. A statement the rest
 * needs even in part stays as a whole. A removed plot takes its device (`png()`, `dev.off()`) along, and an output
 * saving only removed plots (`ggsave()`) as well, as the `dependencies` of the program state them.
 */
export function staticRemovalSlice(
	ctx: ReadOnlyFlowrAnalyzerContext,
	info: DataflowInformation,
	ast: NormalizedAst,
	ids: readonly NodeId[],
	dependencies: readonly DependencyInfo[] = [],
	threshold?: number
): RemovalSliceResult {
	const statements = statementsOf(ast);
	const statementId = (id: NodeId) => statementOf(ast, statements, id)?.info.id;
	const removable = (seeds: readonly NodeId[]): NodeId[] => {
		const slice = staticSlice({ ctx, info, ast, ids: seeds, direction: SliceDirection.Backward, threshold }).result;
		/* a statement is in the slice once any part of it is, as the slice of `body(f) <- x` may hold its parts alone */
		const inSlice = new Set([...slice, ...seeds].map(statementId).filter(id => id !== undefined));
		const rest = [...statements.keys()].filter(id => !inSlice.has(id));
		const needed = new Set<NodeId>();
		if(rest.length > 0) {
			for(const id of staticSlice({ ctx, info, ast, ids: rest, direction: SliceDirection.Backward, threshold }).result) {
				for(let at: NodeId | undefined = id; at !== undefined && !needed.has(at); at = ast.idMap.get(at)?.info.parent) {
					needed.add(at);
				}
			}
		}
		const candidates = [...statements.keys()].filter(id => inSlice.has(id) && !needed.has(id));
		const chosen = new Set(candidates);
		/* a statement inside a removed block goes with it */
		return candidates.filter(id => {
			for(let at = ast.idMap.get(id)?.info.parent; at !== undefined; at = ast.idMap.get(at)?.info.parent) {
				if(chosen.has(at)) {
					return false;
				}
			}
			return true;
		});
	};

	/* removing a save (`ggsave()`) or a device removes what it saves, which would otherwise keep it alive */
	const seeds = new Set(ids);
	const inSeeds = (id: NodeId) => seeds.has(id) || seeds.has(statementId(id) ?? -1);
	for(const linked of [
		...dependencies.filter(d => d.nodeId !== undefined && inSeeds(d.nodeId)).flatMap(d => d.linkedIds ?? []),
		...dependencies.filter(d => d.parts?.some(inSeeds)).map(d => d.nodeId)
	]) {
		if(linked !== undefined && !inSeeds(linked)) {
			seeds.add(linked);
		}
	}
	let removed = removable([...seeds]);
	const gone = (id: NodeId | undefined) => id !== undefined && removed.some(r => within(ast, id, r));
	const parts = [
		...dependencies.filter(d => gone(d.nodeId)).flatMap(d => d.parts ?? [])
			/* a `dev.off()` another plot shares stays */
			.filter(p => !dependencies.some(d => !gone(d.nodeId) && d.parts?.includes(p))),
		...dependencies.filter(d => d.linkedIds?.some(gone)).map(d => d.nodeId).filter(id => id !== undefined),
		...deviceWindows(ast, statements, [...seeds])
	].filter(id => !gone(id));
	if(parts.length > 0) {
		removed = removable([...seeds, ...parts]);
		/* every file access is ordered after the ones before it, so a part may seem needed by later code */
		for(const statement of parts.map(statementId)) {
			if(statement !== undefined && !removed.some(r => within(ast, statement, r))) {
				removed.push(statement);
			}
		}
	}
	/* everything below a removed statement, the body of a removed function included, under every id it is known by */
	const below = () => new Set([...ast.idMap.entries()].filter(([, node]) => removed.some(r => within(ast, node.info.id, r))).map(([id]) => id));
	let result = below();
	/* a slice keeps a value, not every name the code it keeps reads: what is left must not read what is gone */
	for(let dangling = danglingRead(info, result); dangling !== undefined; dangling = danglingRead(info, result)) {
		const back = dangling;
		removed = removed.filter(r => !within(ast, back, r));
		result = below();
	}
	return { removed, result };
}
