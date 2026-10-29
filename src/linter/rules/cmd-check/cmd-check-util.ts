import path from 'path';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { FileRole } from '../../../project/context/flowr-file';
import { rootDescriptionFile } from './package-files';
import { FlowrDescriptionFile } from '../../../project/plugins/file-plugins/files/flowr-description-file';
import type { NamespaceInfo } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import type { ParentInformation, AstIdMap, NormalizedAst  } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { isBaseRPackage } from '../../../util/r-base-packages';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { prettyPrint, type LintingResult } from '../../linter-format';
export { at } from '../../linter-util';
import { builtInOf } from '../../linter-util';
import { SourceLocation } from '../../../util/range';
import { VertexType, type DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';

/** The DESCRIPTION fields declaring a package dependency. */
export const DependencyFields = ['Depends', 'Imports', 'Suggests', 'Enhances', 'LinkingTo'] as const;
export type DependencyField = typeof DependencyFields[number];

/** A linting result of a `cmd-check` rule. */
export interface CmdCheckResult extends LintingResult {
	readonly message: string
}

/** What the `cmd-check` rules need to know about the analyzed package. */
export interface PackageInfo {
	readonly name?:         string
	readonly description:   FlowrDescriptionFile | undefined
	/** the package names each dependency field declares (without `R` itself) */
	readonly declared:      ReadonlyMap<DependencyField, readonly string[]>
	readonly namespace:     NamespaceInfo | undefined
	/** whether `file` (as a node's `info.file` gives it) lives in the `R/` folder */
	readonly isPackageCode: (file: string | undefined) => boolean
}

const DeclaredGetters = {
	Depends:   (d: FlowrDescriptionFile) => d.depends(),
	Imports:   (d: FlowrDescriptionFile) => d.imports(),
	Suggests:  (d: FlowrDescriptionFile) => d.suggests(),
	Enhances:  (d: FlowrDescriptionFile) => d.enhances(),
	LinkingTo: (d: FlowrDescriptionFile) => d.linkingTo()
} as const;

/** Roles of files that live in a package but are no code of its namespace. */
const NonNamespaceRoles = [FileRole.Test, FileRole.Vignette, FileRole.Install, FileRole.Startup, FileRole.Data] as const;

/** Collects the {@link PackageInfo} of the analyzed project; code without a file or DESCRIPTION counts as package code. */
export function packageInfo(ctx: ReadOnlyFlowrAnalyzerContext): PackageInfo {
	const descFile = rootDescriptionFile(ctx);
	const description = descFile === undefined ? undefined : FlowrDescriptionFile.from(descFile);
	const declared = new Map<DependencyField, string[]>(DependencyFields.map(f => [f, (description ? DeclaredGetters[f](description) ?? [] : []).map(p => p.name).filter(n => n !== 'R')]));
	const namespace = ctx.files.getFilesByRole(FileRole.Namespace)[0]?.content().current;
	const excluded = new Set(NonNamespaceRoles.flatMap(r => ctx.files.getFilesByRole(r).map(f => f.path())));
	const codeDirs = descFile === undefined ? [] : [path.join(path.dirname(descFile.path()), 'R') + path.sep];
	return {
		name:          description?.packageName(),
		description,
		declared,
		namespace,
		isPackageCode: file => file === undefined
			|| (!excluded.has(file) && (codeDirs.length === 0 || codeDirs.some(d => path.normalize(file).startsWith(d))))
	};
}

/** All packages the DESCRIPTION declares in any dependency field. */
export function allDeclared(info: PackageInfo): Set<string> {
	return new Set([...info.declared.values()].flat());
}

/** The name a function definition is bound to by a plain assignment (`f <- function() ...`). */
export function boundName(def: RNode<ParentInformation>, idMap: AstIdMap): string | undefined {
	const parent = def.info.parent === undefined ? undefined : idMap.get(def.info.parent);
	if(!RBinaryOp.is(parent) || parent.rhs !== def || !['<-', '=', '<<-'].includes(parent.operator) || !RSymbol.is(parent.lhs) && !RString.is(parent.lhs)) {
		return undefined;
	}
	return RSymbol.is(parent.lhs) ? Identifier.getName(parent.lhs.content) : parent.lhs.content.str;
}

/** Every node of the normalized project, each once (unlike the values of the id map). */
export function projectNodes(ast: NormalizedAst): RNode<ParentInformation>[] {
	const nodes: RNode<ParentInformation>[] = [];
	RProject.visitAst(ast.ast, n => {
		nodes.push(n);
	});
	return nodes;
}

/** The function definitions bound to `name` at the top level of the analyzed code. */
export function topLevelDefinitions(ast: NormalizedAst, name: (n: string) => boolean): { name: string, def: RFunctionDefinition<ParentInformation> }[] {
	const result: { name: string, def: RFunctionDefinition<ParentInformation> }[] = [];
	const idMap = ast.idMap;
	for(const node of projectNodes(ast)) {
		if(!RFunctionDefinition.is(node)) {
			continue;
		}
		const bound = boundName(node, idMap);
		if(bound !== undefined && name(bound) && RNode.strictlyEnclosingFunction(node.info.id, idMap) === undefined) {
			result.push({ name: bound, def: node });
		}
	}
	return result;
}

/** The formal parameter names of a function definition, in order. */
export function formalNames(def: RFunctionDefinition<ParentInformation>): string[] {
	return def.parameters.map(p => p.name.content);
}

/** Whether the node with the given id is (nested) within the given definition. */
export function isWithin(id: NodeId, def: NodeId, idMap: AstIdMap): boolean {
	for(let cur = idMap.get(id); cur !== undefined; cur = cur.info.parent === undefined ? undefined : idMap.get(cur.info.parent)) {
		if(cur.info.id === def) {
			return true;
		}
	}
	return false;
}

/** The function definitions a call reaches by its `Calls` edges. */
export function calledDefinitions(graph: DataflowGraph, call: NodeId, idMap: AstIdMap): RFunctionDefinition<ParentInformation>[] {
	const defs: RFunctionDefinition<ParentInformation>[] = [];
	for(const [target, edge] of graph.edgesFrom(call)) {
		const def = DfEdge.includesType(edge, EdgeType.Calls) ? idMap.get(target) : undefined;
		if(RFunctionDefinition.is(def)) {
			defs.push(def);
		}
	}
	return defs;
}

/** Whether the node or an ancestor is quoted or otherwise evaluated elsewhere (`quote(...)`, a data mask). */
export function isQuoted(graph: DataflowGraph, id: NodeId, idMap: AstIdMap): boolean {
	for(let cur = idMap.get(id); cur !== undefined; cur = cur.info.parent === undefined ? undefined : idMap.get(cur.info.parent)) {
		if(graph.edgesTo(cur.info.id).values().some(e => DfEdge.includesType(e, EdgeType.NonStandardEvaluation))) {
			return true;
		}
	}
	return false;
}

/** The packages `R CMD check` takes as declared without a DESCRIPTION entry: the base packages but `methods` and `stats4`. */
export function isStandardPackage(pkg: string): boolean {
	return isBaseRPackage(pkg) && pkg !== 'methods' && pkg !== 'stats4';
}

/** The pretty printers of a rule: `query` describes a result, the full one is its message and location. */
export function printer<R extends CmdCheckResult>(query: (r: R) => string) {
	return prettyPrint<R>(r => `${query(r)} at ${SourceLocation.format(r.loc)}`, r => `${r.message} at ${SourceLocation.format(r.loc)}`);
}

/** The calls (by name, if given) of package code, with the node and vertex of each; those resolving to a built-in, named by it. */
export function* packageCalls(graph: DataflowGraph, idMap: AstIdMap, pkg: PackageInfo, names?: ReadonlySet<string>): Generator<{ id: NodeId, name: string, node: RNode<ParentInformation>, vertex: DataflowGraphVertexFunctionCall }> {
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const node = idMap.get(id);
		const resolved = builtInOf(graph, id);
		const name = resolved === undefined ? undefined : Identifier.getName(resolved);
		if(node !== undefined && name !== undefined && (names === undefined || names.has(name)) && pkg.isPackageCode(node.info.file)) {
			yield { id, name, node, vertex };
		}
	}
}

/** the extensions R reads as data sets from a package's `data` directory, including the compressed forms */
export const DataSetExtensions: readonly string[] = ['R', 'r', 'RData', 'rdata', 'rda', 'TXT', 'CSV',
	...['tab', 'txt', 'csv'].flatMap(e => [e, ...['gz', 'bz2', 'xz'].map(c => `${e}.${c}`)])];
export const DataFile = new RegExp(`\\.(${DataSetExtensions.map(e => e.replaceAll('.', '\\.')).join('|')})$`);
