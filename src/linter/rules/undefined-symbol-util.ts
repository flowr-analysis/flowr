import type { DataflowGraph } from '../../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../dataflow/graph/vertex';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

/**
 * Path heuristic for an R package `inst/` resource (installed verbatim, not namespace source). Fallback for
 * the authoritative `FileRole.Install`, covering requests that bypass the file-role plugins.
 */
export function isInstalledResourceFile(file: string | undefined): boolean {
	return file !== undefined && /(^|[\\/])inst[\\/]/.test(file);
}

const ResolveEdges: number = EdgeType.Reads | EdgeType.DefinedByOnCall;

/**
 * Whether the variable use `id` resolves to a local definition, a parameter, or a built-in (function or
 * constant such as `T`, `pi`). Broader than `getOriginInDfg`, which misses built-in constants.
 */
export function useResolvesToDefinitionOrBuiltin(graph: DataflowGraph, id: NodeId): boolean {
	for(const [target, edge] of graph.outgoingEdges(id) ?? []) {
		if(DfEdge.doesNotIncludeType(edge, ResolveEdges) || DfEdge.includesType(edge, EdgeType.NonStandardEvaluation)) {
			continue;
		}
		if(NodeId.isBuiltIn(target)) {
			return true;
		}
		const targetVtx = graph.getVertex(target);
		if(targetVtx?.tag === VertexType.VariableDefinition || targetVtx?.tag === VertexType.FunctionDefinition) {
			return true;
		}
	}
	return false;
}

/** Whether any edge incident to `id` marks it as non-standard-evaluated (quoted), e.g. `quote`/`substitute`. */
export function isNonStandardEvaluated(graph: DataflowGraph, id: NodeId): boolean {
	const nse = (edge: DfEdge): boolean => DfEdge.includesType(edge, EdgeType.NonStandardEvaluation);
	return (graph.outgoingEdges(id)?.values().some(nse) ?? false) || (graph.ingoingEdges(id)?.values().some(nse) ?? false);
}

/**
 * Whether the use `id` sits inside a `[`/`[[` subscript (not the accessed object). `data.table`'s
 * `DT[i, j, by]` masks the subscript symbols as columns, but flowR cannot tell this apart from ordinary
 * indexing (`x[i]`), so the rule suppresses subscript symbols by default. Stops at the enclosing function.
 */
export function isInSubscript(graph: DataflowGraph, id: NodeId): boolean {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return false;
	}
	let childId: NodeId = id;
	let parentId = idMap.get(id)?.info.parent;
	for(let guard = 0; parentId !== undefined && guard < 64; guard++) {
		const parent = idMap.get(parentId);
		if(parent === undefined || parent.type === RType.FunctionDefinition) {
			return false;
		}
		if(parent.type === RType.Access && (parent.operator === '[' || parent.operator === '[[') && parent.accessed.info.id !== childId) {
			return true;   // reached from a subscript, not the accessed object
		}
		childId = parentId;
		parentId = parent.info.parent;
	}
	return false;
}

/** The lexical scope a definition/use belongs to: the id of the enclosing function definition, or the top level. */
export type Scope = NodeId | 'top';
/** Names bound unconditionally within each lexical scope, see {@link collectScopeDefinedNames}. */
export type ScopeDefinedNames = ReadonlyMap<Scope, ReadonlySet<string>>;

/** AST nodes that make their children conditionally executed within their scope. */
const ConditionalNodeTypes = new Set<RType>([RType.IfThenElse, RType.ForLoop, RType.WhileLoop, RType.RepeatLoop]);

/**
 * Walk from `startParent` up to the nearest enclosing {@link RType.FunctionDefinition} (or the top level),
 * reporting that scope and whether the walk crossed no `if`/loop block - so a binding at the origin is
 * guaranteed to execute whenever its scope runs. (`cds` is unsuitable: guard clauses like `if(...) stop()`
 * add a control dependency to otherwise-unconditional sibling statements.)
 */
function enclosingScope(idMap: AstIdMap, startParent: NodeId | undefined): { scope: Scope, unconditional: boolean } {
	let cur = startParent;
	let unconditional = true;
	for(let guard = 0; cur !== undefined && guard < 256; guard++) {
		const node = idMap.get(cur);
		if(node === undefined) {
			break;
		}
		if(node.type === RType.FunctionDefinition) {
			return { scope: cur, unconditional };
		}
		if(ConditionalNodeTypes.has(node.type)) {
			unconditional = false;
		}
		cur = node.info.parent;
	}
	return { scope: 'top', unconditional };
}

/**
 * Per scope, the names it binds unconditionally. flowR's static resolution does not always link a use in a
 * nested function to a binding introduced later in an enclosing scope; the rule consults this as a fallback.
 * Only unconditional bindings are recorded: one assigned solely inside an `if`/loop is not guaranteed to
 * exist, so suppressing an unresolved use of it would hide a real possibly-undefined access.
 */
export function collectScopeDefinedNames(graph: DataflowGraph): ScopeDefinedNames {
	const idMap = graph.idMap;
	const byScope = new Map<Scope, Set<string>>();
	if(idMap === undefined) {
		return byScope;
	}
	for(const [id, vtx] of graph.vertices(true)) {
		if(vtx.tag !== VertexType.VariableDefinition) {
			continue;   // function bindings/params surface as variable definitions of their name symbol
		}
		const name = idMap.get(id)?.lexeme;
		if(name === undefined) {
			continue;
		}
		const { scope, unconditional } = enclosingScope(idMap, idMap.get(id)?.info.parent);
		if(!unconditional) {
			continue;
		}
		(byScope.get(scope) ?? byScope.set(scope, new Set()).get(scope) as Set<string>).add(name);
	}
	return byScope;
}

/**
 * Whether `name` is bound in the scope of `useId` or an enclosing scope (up to the top level), per
 * {@link collectScopeDefinedNames}. Suppresses forward-referenced closure variables flowR did not link.
 */
export function isDefinedInEnclosingScope(graph: DataflowGraph, defined: ScopeDefinedNames, useId: NodeId, name: string): boolean {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return false;
	}
	if(defined.get('top')?.has(name)) {
		return true;
	}
	let cur = idMap.get(useId)?.info.parent;
	for(let guard = 0; cur !== undefined && guard < 256; guard++) {
		const node = idMap.get(cur);
		if(node === undefined) {
			break;
		}
		if(node.type === RType.FunctionDefinition && defined.get(cur)?.has(name)) {
			return true;
		}
		cur = node.info.parent;
	}
	return false;
}
