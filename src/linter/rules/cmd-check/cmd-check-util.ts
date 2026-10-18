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
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { isBaseRPackage } from '../../../util/r-base-packages';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { LintingResult } from '../../linter-format';

/** The DESCRIPTION fields declaring a package dependency, in the order `R CMD check` names them. */
export const DependencyFields = ['Depends', 'Imports', 'Suggests', 'Enhances', 'LinkingTo'] as const;
export type DependencyField = typeof DependencyFields[number];

/** A linting result of a `cmd-check` rule, naming the `R CMD check` finding it corresponds to. */
export interface CmdCheckResult extends LintingResult {
	/** what is wrong, worded close to the corresponding `R CMD check` note */
	readonly message: string
}

/** What the `cmd-check` rules need to know about the package the analyzed code belongs to. */
export interface PackageInfo {
	/** the `Package:` field, `undefined` when there is no DESCRIPTION or it names none */
	readonly name?:         string
	/** the DESCRIPTION file, `undefined` for code analyzed without one */
	readonly description:   FlowrDescriptionFile | undefined
	/** the package names each dependency field declares (without `R` itself) */
	readonly declared:      ReadonlyMap<DependencyField, readonly string[]>
	/** the parsed NAMESPACE directives, `undefined` without a NAMESPACE file */
	readonly namespace:     NamespaceInfo | undefined
	/** whether `file` (as a node's `info.file` gives it) is package code, i.e. lives in the `R/` folder */
	readonly isPackageCode: (file: string | undefined) => boolean
}

/** The names of the packages `field` declares, `R` (a version requirement only) excluded. */
function declaredIn(desc: FlowrDescriptionFile, field: DependencyField): string[] {
	const pkgs = (() => {
		switch(field) {
			case 'Depends':   return desc.depends();
			case 'Imports':   return desc.imports();
			case 'Suggests':  return desc.suggests();
			case 'Enhances':  return desc.enhances();
			case 'LinkingTo': return desc.linkingTo();
		}
	})() ?? [];
	return pkgs.map(p => p.name).filter(n => n !== 'R');
}

/** Roles of files that live in a package but are no code of its namespace. */
const NonNamespaceRoles = [FileRole.Test, FileRole.Vignette, FileRole.Install, FileRole.Startup, FileRole.Data] as const;

/**
 * Collects the {@link PackageInfo} of the analyzed project. `R CMD check` only inspects the code in the `R/` folder
 * of a package, so code in `tests/`, `inst/`, `vignettes/`, ... is no package code. A request without a file
 * (e.g. inline code) and the code of a project without a DESCRIPTION are taken to be package code, as there is
 * nothing to tell otherwise and such code is only checked when the rules are requested explicitly.
 */
export function packageInfo(ctx: ReadOnlyFlowrAnalyzerContext): PackageInfo {
	const descFile = rootDescriptionFile(ctx);
	const description = descFile === undefined ? undefined : FlowrDescriptionFile.from(descFile);
	const declared = new Map<DependencyField, string[]>(DependencyFields.map(f => [f, description ? declaredIn(description, f) : []]));
	const namespace = ctx.files.getFilesByRole(FileRole.Namespace)[0]?.content().current;
	const excluded = new Set(NonNamespaceRoles.flatMap(r => ctx.files.getFilesByRole(r).map(f => f.path())));
	/* only the package's own code: what other packages vendored into it or shipped as test fixtures have is theirs */
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

/**
 * The name a function definition is bound to by a plain assignment (`f <- function() ...`), `undefined` for an
 * anonymous function or one bound in any other way.
 */
export function boundName(def: RNode<ParentInformation>, idMap: AstIdMap): string | undefined {
	const parent = def.info.parent === undefined ? undefined : idMap.get(def.info.parent);
	if(!RBinaryOp.is(parent) || parent.rhs !== def || !['<-', '=', '<<-'].includes(parent.operator) || !RSymbol.is(parent.lhs) && !RString.is(parent.lhs)) {
		return undefined;
	}
	return RSymbol.is(parent.lhs) ? Identifier.getName(parent.lhs.content) : parent.lhs.content.str;
}

/**
 * Every node of the normalized project, each once. Unlike the values of the id map, which may hold a node under
 * more than one key and also the nodes flowR synthesizes during the dataflow analysis, these are what the code says.
 */
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

/**
 * The function definitions of the code a call reaches, by its `Calls` edges. These name the definitions the call
 * itself binds to, where the origins of a call may include other functions that flow through the same place.
 */
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

/** Whether the call reaches the built-in function only, and no definition of the code. */
export function isBuiltInCall(graph: DataflowGraph, id: NodeId): boolean {
	const origins = Dataflow.origin(graph, id);
	return origins === undefined || origins.every(o => o.type === OriginType.BuiltInFunctionOrigin);
}

/**
 * Whether the node is quoted or otherwise evaluated elsewhere (`quote(...)`, `bquote`, a data mask), as seen by an
 * edge of non-standard evaluation into it or any of its ancestors. Such code is no code the package runs as written.
 */
export function isQuoted(graph: DataflowGraph, id: NodeId, idMap: AstIdMap): boolean {
	for(let cur = idMap.get(id); cur !== undefined; cur = cur.info.parent === undefined ? undefined : idMap.get(cur.info.parent)) {
		if(graph.edgesTo(cur.info.id).values().some(e => DfEdge.includesType(e, EdgeType.NonStandardEvaluation))) {
			return true;
		}
	}
	return false;
}

/** The packages `R CMD check` takes as declared for `::`, namespace loads and NAMESPACE imports without a DESCRIPTION entry: the base packages but `methods` and `stats4`. */
export function isStandardPackage(pkg: string): boolean {
	return isBaseRPackage(pkg) && pkg !== 'methods' && pkg !== 'stats4';
}
