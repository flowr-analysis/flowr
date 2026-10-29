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
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { Identifier } from '../../dataflow/environments/identifier';
import { ArgProp, type FnSig } from '../../dataflow/environments/built-in-props';
import { type AmbientStateAccess, AmbientStateAccessType } from '../../dataflow/internal/process/functions/call/built-in/built-in-ambient-state';

/** What removing code for a set of criteria takes out of the program. */
export interface RemovalSliceResult {
	/** the statements removed as a whole, outermost first */
	readonly removed: readonly NodeId[]
	/** every node of the removed statements */
	readonly result:  ReadonlySet<NodeId>
}

type StatedConfig = { readonly ambient?: AmbientStateAccess | readonly AmbientStateAccess[], readonly sig?: FnSig };
function builtInNames(stated: (config: StatedConfig) => boolean): ReadonlySet<string> {
	return new Set(DefaultBuiltinConfig.flatMap(d => d.type === 'function' && stated((d.config ?? {}) as StatedConfig) ? d.names.map(name => String(Identifier.getName(name))) : []));
}
const accesses = (type: AmbientStateAccessType) => (config: StatedConfig) => [config.ambient ?? []].flat().some(access => access.type === type);
const DeviceOpeners = builtInNames(accesses(AmbientStateAccessType.OpenDevice));
const DeviceClosers = builtInNames(accesses(AmbientStateAccessType.CloseDevice));
/* a call handing back its argument is that argument: `invisible(dev.off())` closes the device */
const PassingOn = builtInNames(config => ((config.sig?.[0]?.[1] ?? 0) & ArgProp.Alias) !== 0);

/** the statements of the program, without function bodies, which only run when called */
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

/** the node and everything it lies within, innermost first */
function* ancestors(ast: NormalizedAst, id: NodeId | undefined): Generator<NodeId> {
	for(let at = id; at !== undefined; at = ast.idMap.get(at)?.info.parent) {
		yield at;
	}
}

function statementOf(ast: NormalizedAst, statements: ReadonlyMap<NodeId, RNodeWithParent>, id: NodeId): RNodeWithParent | undefined {
	const at = ancestors(ast, id).find(a => statements.has(a));
	return at === undefined ? undefined : statements.get(at);
}

const within = (ast: NormalizedAst, id: NodeId, ancestor: NodeId): boolean => ancestors(ast, id).some(at => at === ancestor);

function callOf(node: RNodeWithParent | undefined): RNodeWithParent | undefined {
	while(RFunctionCall.isNamed(node, PassingOn) && node.arguments.length === 1) {
		node = RArgument.valueOf(node.arguments[0]);
	}
	return node;
}

const isNamed = (node: RNodeWithParent | undefined, names: ReadonlySet<string>) => RFunctionCall.isNamed(callOf(node), names);

/** the calls from a device to its `dev.off()` around each criterion, assignments in between stay as the rest may use them */
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

const PackageBuiltIn = /^built-in:[^:]+:/;

/** a definition the code that is left still reads, `undefined` if there is none */
function danglingRead(info: DataflowInformation, removed: ReadonlySet<NodeId>): NodeId | undefined {
	for(const [id] of info.graph.vertices(true)) {
		/* the built-ins a loaded package provides (`built-in:pkg:fn`) are no code that is left, they read its library() call */
		if(!removed.has(id) && !(typeof id === 'string' && PackageBuiltIn.test(id))) {
			const target = Dataflow.targetsOf(info.graph, id, EdgeType.Reads).find(t => removed.has(t));
			if(target !== undefined) {
				return target;
			}
		}
	}
	return undefined;
}

/** every node left once `removed` is out, but the file roots, which would keep removed functions as stubs */
export function keptAfterRemoval(ast: NormalizedAst, removed: ReadonlySet<NodeId>): Set<NodeId> {
	return new Set([...ast.idMap.entries()].filter(([id, node]) => !removed.has(id) && node.info.parent !== undefined).map(([id]) => id));
}

/**
 * The removal slice of `ids`: the statements of their backward slice that nothing else needs. A statement the rest
 * needs even in part stays as a whole. Removed plots take their device and saving calls along.
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
		return candidates.filter(id => !ancestors(ast, ast.idMap.get(id)?.info.parent).some(at => chosen.has(at)));
	};

	/* removing a save (`ggsave()`) or a device removes what it saves, which would otherwise keep it alive */
	const seeds = new Set(ids);
	const inSeeds = (id: NodeId) => seeds.has(id) || seeds.has(statementId(id) ?? -1);
	for(const linked of [
		...dependencies.filter(d => d.nodeId !== undefined && inSeeds(d.nodeId)).flatMap(d => d.linkedIds ?? []),
		...dependencies.filter(d => d.parts?.some(inSeeds) || d.linkedIds?.some(inSeeds)).map(d => d.nodeId)
	]) {
		if(linked !== undefined && !inSeeds(linked)) {
			seeds.add(linked);
		}
	}
	let removed = removable([...seeds]);
	const gone = (id: NodeId | undefined) => id !== undefined && removed.some(r => within(ast, id, r));
	const parts = [
		...dependencies.filter(d => gone(d.nodeId)).flatMap(d => d.parts ?? [])
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
