import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../graph/graph';
import { VertexType } from '../../graph/vertex';
import type { ControlFlowGraph } from '../../../control-flow/control-flow-graph';
import { happensBefore } from '../../../control-flow/happens-before';
import { Ternary } from '../../../util/logic';
import { Identifier } from '../../environments/identifier';
import { getArgumentStringValue } from './resolve-argument';
import { Unknown } from '../../../queries/catalog/dependencies-query/dependencies-query-format';
import { isAbsolutePath } from '../../../util/text/strings';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { ControlDependency, negateControlDependency } from '../../info';
import { EdgeType } from '../../graph/edge';
import { edgeSources } from '../../fn/frame-reflection';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { DefaultMap } from '../../../util/collections/defaultmap';
import { RPath } from '../../../util/files';
import { platformDirname } from '../../internal/process/functions/call/built-in/built-in-source';
import { uniqueArray } from '../../../util/collections/arrays';

/** a resolved `setwd`-style call: its `dir` is `undefined` when it cannot be determined statically */
export interface WorkingDirectoryChange {
	readonly id:                 NodeId;
	readonly dir:                string | undefined;
	readonly cds:                readonly ControlDependency[];
	readonly iterated:           boolean;
	readonly enclosedInFunction: boolean;
}

/** over-approximating candidate set (empty means unbounded), and whether exactly one directory is guaranteed */
export interface WorkingDirectoryResolution {
	readonly candidates: readonly string[];
	readonly certain:    boolean;
}

interface WdChangeSpec {
	readonly name:       string;
	readonly namespace?: string;
	readonly argIdx:     number;
	readonly argName:    string;
}

/** functions recognized as changing the working directory; a registry so more (e.g. `withr::with_dir`) can be added */
const ChangeFunctions: readonly WdChangeSpec[] = [
	{ name: 'setwd', namespace: 'base', argIdx: 0, argName: 'dir' }
];

const CandidateCap = 64;

type Guards = readonly ControlDependency[];

function matchSpec(name: Identifier): WdChangeSpec | undefined {
	const bare = Identifier.getName(name);
	const ns = Identifier.getNamespace(name);
	return ChangeFunctions.find(s => s.name === bare && (ns === undefined || ns === s.namespace));
}

function isAbsoluteDir(dir: string): boolean {
	return dir.startsWith('~') || isAbsolutePath(dir, undefined);
}

/** apply one `setwd(dir)`: an absolute (or `~`-rooted) `dir` replaces `current`, a relative `dir` joins onto it */
function applyChange(current: string, dir: string): string {
	return isAbsoluteDir(dir) ? RPath.normalize(dir) : RPath.join(current, dir);
}

function guardIn(g: ControlDependency, set: Guards): boolean {
	return set.some(b => ControlDependency.same(b, g));
}
function subsumed(inner: Guards, outer: Guards): boolean {
	return inner.every(g => guardIn(g, outer));
}
function consistent(inner: Guards, outer: Guards): boolean {
	return inner.every(g => !outer.some(b => b.id === g.id && b.when !== g.when));
}
function mergeGuards(a: Guards, b: Guards): ControlDependency[] {
	const out = [...a];
	for(const g of b) {
		if(!guardIn(g, out)) {
			out.push(g);
		}
	}
	return out;
}

/** the changes ordered so predecessors come first; parallel branches keep an arbitrary relative order */
function topoOrder(changes: readonly WorkingDirectoryChange[], cfg: ControlFlowGraph): WorkingDirectoryChange[] {
	const remaining = [...changes];
	const result: WorkingDirectoryChange[] = [];
	while(remaining.length > 0) {
		const idx = Math.max(0, remaining.findIndex(a => remaining.every(b => b === a || happensBefore(cfg, b.id, a.id) === Ternary.Never)));
		result.push(remaining.splice(idx, 1)[0]);
	}
	return result;
}

function enclosingFunction(idMap: DataflowGraph['idMap'], id: NodeId): NodeId | undefined {
	return idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(id, idMap);
}

function isIterated(cds: Guards, idMap: DataflowGraph['idMap']): boolean {
	return cds.some(cd => ControlDependency.isIterated(cd, idMap));
}

function resolveAt(target: NodeId, targetCds: Guards, baseWd: string, changes: readonly WorkingDirectoryChange[], cfg: ControlFlowGraph): WorkingDirectoryResolution {
	const relevant = changes.filter(c => happensBefore(cfg, c.id, target) !== Ternary.Never);
	// a setwd hidden in a function may still have run before target via a call happensBefore cannot see
	if(changes.some(c => c.enclosedInFunction && !relevant.includes(c))) {
		return { candidates: [], certain: false };
	}
	if(relevant.length === 0) {
		return { candidates: [baseWd], certain: true };
	}
	if(relevant.some(c => c.dir === undefined || (c.iterated && !isAbsoluteDir(c.dir)))) {
		return { candidates: [], certain: false };
	}
	let states: { wd: string, guards: Guards }[] = [{ wd: baseWd, guards: [] }];
	for(const c of topoOrder(relevant, cfg)) {
		const next: { wd: string, guards: Guards }[] = [];
		for(const s of states) {
			if(!consistent(c.cds, s.guards)) {
				next.push(s);
				continue;
			}
			const ran = { wd: applyChange(s.wd, c.dir as string), guards: mergeGuards(s.guards, c.cds) };
			if(!c.iterated && subsumed(c.cds, s.guards)) {
				next.push(ran);
			} else {
				const neg = c.cds.length === 1 ? [negateControlDependency(c.cds[0])] : [];
				next.push({ wd: s.wd, guards: mergeGuards(s.guards, neg) });
				next.push(ran);
			}
		}
		states = next;
		if(states.length > CandidateCap) {
			return { candidates: [], certain: false };
		}
	}
	const candidates = uniqueArray(states.filter(s => consistent(targetCds, s.guards)).map(s => s.wd));
	return { candidates, certain: candidates.length === 1 };
}

function collect(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): WorkingDirectoryChange[] {
	const out: WorkingDirectoryChange[] = [];
	const byFn = new DefaultMap<NodeId, { dir: string | undefined, cds: Guards, iterated: boolean }[]>(() => []);
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const spec = matchSpec(vertex.name);
		if(spec === undefined) {
			continue;
		}
		const resolved = getArgumentStringValue(ctx.config.solver.variables, graph, vertex, spec.argIdx, spec.argName, true, ctx);
		const values = resolved ? Array.from(resolved.values()).flatMap(s => Array.from(s)) : [];
		const known = values.filter(v => v !== undefined && v !== Unknown) as string[];
		const dir = values.length > 0 && known.length === values.length && new Set(known).size === 1 ? known[0] : undefined;
		const cds = vertex.cds ?? [];
		const iterated = isIterated(cds, graph.idMap);
		const fn = enclosingFunction(graph.idMap, id);
		if(fn === undefined) {
			out.push({ id, dir, cds, iterated, enclosedInFunction: false });
		} else {
			byFn.get(fn).push({ dir, cds, iterated });
		}
	}
	// a function's setwd is propagated to its call sites; only a lone unconditional setwd has a site-independent effect
	for(const [fn, setwds] of byFn.entries()) {
		const net = setwds.length === 1 && setwds[0].cds.length === 0 && !setwds[0].iterated ? setwds[0].dir : undefined;
		for(const site of edgeSources(graph, fn, EdgeType.Calls)) {
			const cds = graph.getVertex(site)?.cds ?? [];
			out.push({ id: site, dir: net, cds, iterated: isIterated(cds, graph.idMap), enclosedInFunction: enclosingFunction(graph.idMap, site) !== undefined });
		}
	}
	return out;
}

/** Resolve R's process-global working directory (sensitive to `setwd`) at a program point; path-sensitive, unbounded rather than wrong under loops/functions. */
export const WorkingDirectory = {
	collect,
	resolveAt,
	applyChange,
	/** reusable `(callId, scriptFile?) => candidate roots`, collecting the changes once for the whole graph; `pinned` when a `setwd` decides them */
	rootsResolver(graph: DataflowGraph, cfg: ControlFlowGraph, ctx: ReadOnlyFlowrAnalyzerContext): (id: NodeId, file?: string) => { roots: readonly string[], pinned: boolean } {
		const changes = collect(graph, ctx);
		return (id, file) => {
			const base = file ? platformDirname(file) : '.';
			const roots = resolveAt(id, graph.getVertex(id)?.cds ?? [], base, changes, cfg).candidates;
			return { roots, pinned: roots.length > 0 && (roots.length > 1 || roots[0] !== base) };
		};
	}
} as const;
