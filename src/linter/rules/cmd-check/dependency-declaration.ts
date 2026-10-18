import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RFunctionCall, EmptyArgument  } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { Enrichment } from '../../../search/search-executor/search-enrichers';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { callFnProps } from '../../../dataflow/environments/query-fn-props';
import { CallProps, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { attachesPackage } from '../../../queries/catalog/dependencies-query/function-info/library-functions';
import { Unknown } from '../../../queries/catalog/dependencies-query/dependencies-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { AttachedBasePackageSet, isBaseRPackage } from '../../../util/r-base-packages';
import { at, printer, type CmdCheckResult, isStandardPackage, packageInfo, projectNodes } from './cmd-check-util';
import { packageFiles, type PackageFiles, rootDescriptionFile } from './package-files';
import { packageCode } from './package-code';
import { RLogical } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';

export type DependencyDeclarationKind =
	/** `library(pkg)`/`require(pkg)` of a package declared in neither Depends nor Suggests nor Enhances */
	| 'undeclared-attach'
	/** `requireNamespace(pkg)`/`loadNamespace(pkg)` of a package that is not declared */
	| 'undeclared-load'
	/** `pkg::f` or `pkg:::f` of a package that is not declared */
	| 'undeclared-namespace'
	/** `library(pkg)` of a package the Depends field already attaches */
	| 'attached-by-depends'
	/** `library(pkg)`/`require(pkg)` in package code at all */
	| 'library-in-package'
	/** `pkg:::f` of the package itself */
	| 'own-triple-colon'
	/** a package in Imports nothing imports from */
	| 'unused-import'
	/** a package in Depends the NAMESPACE imports nothing from */
	| 'depends-not-imported'
	/** S4 code without `methods` in Depends or Imports */
	| 'undeclared-methods'
	/** a package the tests, vignettes, or examples load or access but the DESCRIPTION does not declare */
	| 'undeclared-in-tests'
	| 'undeclared-in-vignettes'
	| 'undeclared-in-examples'
	/** a package a vignette's `\\VignetteDepends{}` or `\\VignetteEngine{}` needs but the DESCRIPTION does not declare */
	| 'undeclared-vignette-depends'
	/** a VignetteBuilder package not declared in Depends, Imports, or Suggests */
	| 'undeclared-vignette-builder'
	/** a VignetteBuilder field without a `vignettes` folder */
	| 'vignette-builder-without-vignettes'
	/** an RdMacros package not in Depends or Imports */
	| 'undeclared-rd-macros'
	/** a header-only package (like BH) in Depends or Imports that belongs into LinkingTo */
	| 'header-only-import'
	/** a declared package the signature database does not know */
	| 'unavailable'
	/** a declared package whose version requirements no version satisfies */
	| 'unsuitable-version';

export interface DependencyDeclarationResult extends CmdCheckResult {
	readonly kind:    DependencyDeclarationKind
	readonly package: string
}

export interface DependencyDeclarationConfig extends MergeableRecord {
	/** report every `library`/`require` call in package code, even for declared packages (default `true`, as `R CMD check`) */
	readonly reportLibraryCalls:       boolean
	/** report packages in Depends the NAMESPACE imports nothing from, a note `R CMD check` only gives for CRAN submissions (default `false`) */
	readonly reportDependsNotImported: boolean
	/** functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default `clusterEvalQ`) */
	readonly ignoreWithin:             readonly string[]
	/** check the packages the tests, vignettes, and examples use (default `true`) */
	readonly checkOtherCode:           boolean
	/** report declared packages the signature database does not know or cannot satisfy, which `R CMD check` asks the repositories about (default `true`) */
	readonly checkAvailability:        boolean
	/** packages that only provide C/C++ headers and hence belong into LinkingTo, a note `R CMD check` gives for CRAN submissions (default `BH`, `RcppArmadillo`, `RcppEigen`) */
	readonly headerOnlyPackages:       readonly string[]
}

export interface DependencyDeclarationMetadata extends MergeableRecord {
	/** package loads whose package could not be resolved */
	readonly unresolvedLoads: number
}

/** the S4 functions marking code to need `methods` */
const S4Definers: ReadonlySet<string> = new Set(['setClass', 'setMethod', 'setGeneric', 'setRefClass', 'setValidity', 'setClassUnion']);
const PackageName = /^[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]$/;

/** the packages R attaches by default, which `library` calls may name without a DESCRIPTION entry */
function isDefaultPackage(pkg: string): boolean {
	return AttachedBasePackageSet.has(pkg) && pkg !== 'methods';
}

const LoadFunctions: ReadonlySet<string> = new Set(['library', 'require', 'loadNamespace', 'requireNamespace']);

/** the packages a piece of code loads or accesses, read off its syntax as `tools:::.check_packages_used_helper` does */
function packagesUsedIn(ast: NormalizedAst): { pkg: string, node: RNode<ParentInformation>, how: string }[] {
	const result: { pkg: string, node: RNode<ParentInformation>, how: string }[] = [];
	for(const node of projectNodes(ast)) {
		if(RSymbol.is(node)) {
			const ns = Identifier.getNamespace(node.content);
			if(ns !== undefined) {
				result.push({ pkg: ns, node, how: Identifier.accessesInternal(node.content) ? ':::' : '::' });
			}
			continue;
		}
		if(!RFunctionCall.isNamed(node)) {
			continue;
		}
		const fn = Identifier.getName(node.functionName.content);
		const args = node.arguments.filter(a => a !== EmptyArgument);
		const named = (n: string) => args.find(a => a.name !== undefined && Identifier.getName(a.name.content) === n)?.value;
		if(LoadFunctions.has(fn)) {
			const value = named('package') ?? args.find(a => a.name === undefined)?.value;
			const characterOnly = named('character.only');
			if(RString.is(value)) {
				result.push({ pkg: value.content.str, node, how: fn });
			} else if(RSymbol.is(value) && (fn === 'library' || fn === 'require') && (characterOnly === undefined || (RLogical.is(characterOnly) && !characterOnly.content))) {
				result.push({ pkg: Identifier.getName(value.content), node, how: fn });
			}
		} else if(fn === 'data') {
			const value = named('package');
			if(RString.is(value)) {
				result.push({ pkg: value.content.str, node, how: 'data(package=)' });
			}
		}
	}
	return result;
}

/** the packages the tests, vignettes and examples use without the DESCRIPTION declaring them */
function otherCodeFindings(files: PackageFiles, declared: ReadonlySet<string>, data: ReadonlyFlowrAnalysisProvider): DependencyDeclarationResult[] {
	const results: DependencyDeclarationResult[] = [];
	for(const code of packageCode(files)) {
		const kind = `undeclared-in-${code.origin}` as const;
		let ast: NormalizedAst;
		try {
			ast = data.normalizeStandalone(code.code);
		} catch{
			continue;
		}
		const reported = new Set<string>();
		const isDeclared = (pkg: string) => declared.has(pkg) || isBaseRPackage(pkg);
		for(const { pkg, node, how } of packagesUsedIn(ast)) {
			if(isDeclared(pkg) || reported.has(pkg) || !PackageName.test(pkg)) {
				continue;
			}
			reported.add(pkg);
			const [sl, , el] = SourceLocation.getRange(SourceLocation.fromNode(node) ?? SourceLocation.invalid());
			results.push({
				certainty:  LintingResultCertainty.Certain,
				involvedId: undefined,
				loc:        files.locate(code.file, sl + code.lineOffset - 1, el + code.lineOffset - 1),
				kind,
				package:    pkg,
				message:    `'${how}' ${how.startsWith(':') ? 'import' : 'call'} not declared from: '${pkg}' (in ${code.origin})`
			});
		}
		for(const pkg of code.depends ?? []) {
			if(!isDeclared(pkg) && !reported.has(pkg)) {
				results.push({ certainty: LintingResultCertainty.Certain, involvedId: undefined, loc: files.locate(code.file), kind: 'undeclared-vignette-depends', package: pkg, message: `Vignette dependency not required: '${pkg}', vignette dependencies must be contained in the DESCRIPTION Depends/Suggests/Imports entries` });
			}
		}
	}
	return results;
}

/**
 * Port of `checking dependencies in R code` of `R CMD check` (`tools:::.check_packages_used`): packages used by the
 * code but not declared in the DESCRIPTION, declared Imports that are never imported from, and the discouraged
 * `library`/`require` and own `:::` calls in package code.
 */
export const DEPENDENCY_DECLARATION = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', enabledCategories: ['library'] }),
	processSearchResult: async(elements, config, data) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const results: DependencyDeclarationResult[] = [];
		let unresolvedLoads = 0;
		if(pkg.description === undefined) {
			return { results, '.meta': { unresolvedLoads } };
		}
		const df = await data.dataflow();
		const ast = await data.normalize();
		const idMap = ast.idMap;
		const depends = new Set(pkg.declared.get('Depends'));
		const imports = new Set(pkg.declared.get('Imports'));
		const dependsSuggests = new Set([...depends, ...pkg.declared.get('Suggests') ?? [], ...pkg.declared.get('Enhances') ?? [], ...pkg.name ? [pkg.name] : []]);
		const declared = new Set([...dependsSuggests, ...imports]);
		const used = new Set<string>();
		const ignoreWithin = new Set(config.ignoreWithin);
		const ignored = (id: NodeId): boolean => {
			for(let cur = idMap.get(id); cur !== undefined; cur = cur.info.parent === undefined ? undefined : idMap.get(cur.info.parent)) {
				if(RFunctionCall.isNamed(cur, ignoreWithin)) {
					return true;
				}
			}
			return false;
		};
		const add = (id: NodeId, kind: DependencyDeclarationKind, name: string, message: string, certain = true) => {
			results.push({ ...at(idMap.get(id), certain), involvedId: id, kind, package: name, message });
		};

		/* library(), require(), requireNamespace(), ... as the dependencies query resolves them, a package name in a variable included */
		const loads = elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'].library;
		const loadsPerCall = Map.groupBy(loads.filter(l => l.nodeId !== undefined), l => l.nodeId as NodeId);
		for(const [id, infos] of loadsPerCall) {
			const node = idMap.get(id);
			if(node === undefined || !pkg.isPackageCode(node.info.file) || ignored(id)) {
				continue;
			}
			/* a load the package defines itself is none of R's */
			if(Dataflow.origin(df.graph, id)?.some(o => o.type === OriginType.FunctionCallOrigin)) {
				continue;
			}
			const tags = callFnProps(id, df);
			const attaches = tags?.tags === undefined ? attachesPackage(infos[0]) : CallProps.hasAny(tags, SemanticCallTag.AttachesPackage);
			const loadsOnly = !attaches && CallProps.hasAny(tags, SemanticCallTag.LoadsPackage);
			if(!attaches && !loadsOnly) {
				continue;
			}
			const fn = Identifier.getName(infos[0].functionName);
			/* a call that may load one of several packages names each of them only possibly */
			const certain = infos.length === 1;
			for(const info of infos) {
				const name = info.value;
				if(name === undefined || name === Unknown || !PackageName.test(name)) {
					unresolvedLoads++;
					continue;
				}
				used.add(name);
				if(loadsOnly) {
					if(!declared.has(name) && !isStandardPackage(name)) {
						add(id, 'undeclared-load', name, `'${fn}' call not declared from: '${name}'`, certain);
					}
					continue;
				}
				if(!dependsSuggests.has(name) && !isDefaultPackage(name)) {
					add(id, 'undeclared-attach', name, `'${fn}' call not declared from: '${name}'${imports.has(name) ? ' (Imports do not attach a package, use :: instead)' : ''}`, certain);
				}
				if(depends.has(name)) {
					add(id, 'attached-by-depends', name, `'${fn}' call to '${name}' which was already attached by Depends`, certain);
				} else if(config.reportLibraryCalls && name !== pkg.name) {
					add(id, 'library-in-package', name, `'${fn}' call to '${name}' in package code, please use :: or requireNamespace() instead`, certain);
				}
			}
		}

		/* pkg::f and pkg:::f */
		let usesS4 = false;
		for(const node of projectNodes(ast)) {
			if(!pkg.isPackageCode(node.info.file)) {
				continue;
			}
			if(RFunctionCall.isNamed(node, S4Definers)) {
				usesS4 = true;
			}
			if(!RSymbol.is(node)) {
				continue;
			}
			const ns = Identifier.getNamespace(node.content);
			if(ns === undefined || ignored(node.info.id)) {
				continue;
			}
			used.add(ns);
			const internal = Identifier.accessesInternal(node.content) === true;
			const op = internal ? ':::' : '::';
			if(ns === pkg.name) {
				if(internal) {
					add(node.info.id, 'own-triple-colon', ns, `':::' call to the package's own namespace (${ns}:::${Identifier.getName(node.content)}), a package almost never needs to use ::: for its own objects`);
				}
			} else if(!declared.has(ns) && !isStandardPackage(ns)) {
				add(node.info.id, 'undeclared-namespace', ns, `'${op}' import not declared from: '${ns}'`);
			}
		}

		/* what the NAMESPACE imports counts as used, which is the only way the Imports make sense besides :: */
		const nsImports = [...pkg.namespace?.importedPackages.keys() ?? []];
		for(const name of nsImports) {
			used.add(name);
		}
		if(usesS4) {
			used.add('methods');
		}
		const descLoc = SourceLocation.from([1, 1, 1, 1], rootDescriptionFile(ctx)?.path());
		const fileFinding = (kind: DependencyDeclarationKind, name: string, message: string) => results.push({
			certainty: LintingResultCertainty.Certain, involvedId: undefined, loc: descLoc, kind, package: name, message
		});
		/* when flowR could not tell what a load loads, it may use any declared package */
		if(unresolvedLoads === 0) {
			for(const name of imports) {
				if(!used.has(name)) {
					fileFinding('unused-import', name, `Namespace in Imports field not imported from: '${name}', all declared Imports should be used`);
				}
			}
		}
		if(config.reportDependsNotImported && pkg.namespace !== undefined) {
			for(const name of depends) {
				if(!nsImports.includes(name) && !isDefaultPackage(name)) {
					fileFinding('depends-not-imported', name, `Package in Depends field not imported from: '${name}', it needs to be imported from (in the NAMESPACE file) for when this namespace is loaded but not attached`);
				}
			}
		}
		if(usesS4 && !depends.has('methods') && !imports.has('methods')) {
			fileFinding('undeclared-methods', 'methods', 'package \'methods\' is used but not declared');
		}
		const files = packageFiles(ctx, pkg.name);
		const declaredAnywhere = new Set([...declared, ...pkg.declared.get('LinkingTo') ?? []]);
		if(config.checkOtherCode && files !== undefined) {
			results.push(...otherCodeFindings(files, declared, data));
		}
		const builders = (pkg.description.content().get('VignetteBuilder') ?? []).flatMap(v => v.split(',')).map(v => v.trim()).filter(v => v !== '');
		for(const builder of builders) {
			if(builder !== pkg.name && builder !== 'utils' && !depends.has(builder) && !imports.has(builder) && !pkg.declared.get('Suggests')?.includes(builder)) {
				fileFinding('undeclared-vignette-builder', builder, `VignetteBuilder package not declared: '${builder}'`);
			}
		}
		if(builders.length > 0 && files?.entries.every(e => !e.relative.startsWith('vignettes/')) === true && files.onDisk) {
			fileFinding('vignette-builder-without-vignettes', builders[0], 'VignetteBuilder field given, but the package has no \'vignettes\' folder');
		}
		const macros = (pkg.description.content().get('RdMacros') ?? []).flatMap(v => v.split(',')).map(v => v.trim()).filter(v => v !== '');
		for(const macro of macros) {
			if(!depends.has(macro) && !imports.has(macro)) {
				fileFinding('undeclared-rd-macros', macro, `RdMacros package not required: '${macro}', RdMacros packages must be contained in the DESCRIPTION Imports/Depends entries`);
			}
		}
		for(const header of config.headerOnlyPackages) {
			if((depends.has(header) || imports.has(header)) && !nsImports.includes(header)) {
				fileFinding('header-only-import', header, `Package in Depends/Imports which should probably only be in LinkingTo: '${header}'`);
			}
		}
		if(config.checkAvailability && ctx.deps.hasSignatureDatabase()) {
			const sources = ctx.deps.signatureSources();
			for(const name of declaredAnywhere) {
				if(name === pkg.name || isBaseRPackage(name)) {
					continue;
				}
				if(!sources.some(s => s.has(name))) {
					results.push({ certainty: LintingResultCertainty.Uncertain, involvedId: undefined, loc: descLoc, kind: 'unavailable', package: name, message: `Package required but not available: '${name}' (unknown to the signature database)` });
				} else if(ctx.deps.getDependency(name)?.hasSatisfiableVersion() === false) {
					results.push({ certainty: LintingResultCertainty.Uncertain, involvedId: undefined, loc: descLoc, kind: 'unsuitable-version', package: name, message: `Package required and available but unsuitable version: '${name}'` });
				}
			}
		}
		return { results, '.meta': { unresolvedLoads } };
	},
	prettyPrint: printer<DependencyDeclarationResult>(r => `${r.kind} of ${r.package}`),
	info:        {
		name:          'Dependency Declaration',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Reproducibility],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds packages the code, tests, examples, or vignettes use without the DESCRIPTION declaring them, Imports nothing imports from, `library()` calls in package code, own `:::` calls, and undeclared VignetteBuilder or RdMacros packages. Package names are resolved through variables.',
		defaultConfig: () => ({
			reportLibraryCalls:       true,
			reportDependsNotImported: false,
			ignoreWithin:             ['clusterEvalQ'],
			checkOtherCode:           true,
			checkAvailability:        true,
			headerOnlyPackages:       ['BH', 'RcppArmadillo', 'RcppEigen']
		})
	}
} as const satisfies LintingRule<DependencyDeclarationResult, DependencyDeclarationMetadata, DependencyDeclarationConfig>;
