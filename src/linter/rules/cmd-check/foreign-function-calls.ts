import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { Identifier } from '../../../dataflow/environments/identifier';
import { VertexType } from '../../../dataflow/graph/vertex';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import { callFnProps } from '../../../dataflow/environments/query-fn-props';
import { CallProp, CallProps } from '../../../dataflow/environments/built-in-props';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { Resolve } from '../../../dataflow/environments/resolve-helper';
import { NodeValue } from '../../../dataflow/eval/resolve/node-value';
import { isBaseRPackage } from '../../../util/r-base-packages';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { FileRole } from '../../../project/context/flowr-file';
import type { NamespaceFormat } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type CmdCheckResult, DependencyFields, packageInfo } from './cmd-check-util';

/** what is wrong with a foreign function call */
export type ForeignFunctionCallIssue =
	| 'missing-package'
	| 'empty-package'
	| 'base-package'
	| 'different-package'
	| 'undeclared-package';

export interface ForeignFunctionCallsResult extends CmdCheckResult {
	readonly issue:    ForeignFunctionCallIssue
	/** the foreign function interface called, e.g. `.Call` */
	readonly call:     string
	/** the routine the call names, if flowR can tell */
	readonly routine?: string
	/** the `PACKAGE` the call names, for all issues but a missing one */
	readonly package?: string
}

export interface ForeignFunctionCallsConfig extends MergeableRecord {
	/** also resolve the routine and `PACKAGE` through variables, which `R CMD check` cannot see (default `true`) */
	readonly resolveValues: boolean
}

export interface ForeignFunctionCallsMetadata extends MergeableRecord {
	/** foreign function calls inspected */
	readonly consideredCalls: number
}

/** the formals of the foreign function interface, `PACKAGE` has to be named in full as it follows `...` */
const Formals = { '.NAME': 'name', '...': '...', 'PACKAGE': 'package' } as const;

/** the DLLs the NAMESPACE loads with `useDynLib` */
function loadedDlls(ctx: ReadOnlyFlowrAnalyzerContext): ReadonlySet<string> {
	const fmt = ctx.files.getFilesByRole(FileRole.Namespace)[0]?.content() as NamespaceFormat | undefined;
	return new Set(Object.entries(fmt ?? {}).filter(([name, info]) => name !== 'current' && info.loadsWithSideEffects).map(([name]) => name));
}

/**
 * Port of the `R CMD check` notes on foreign function calls (`checking foreign function calls`, from
 * `tools:::checkFF`): a call of `.C`, `.Fortran`, `.Call` or `.External` naming its routine by a string
 * without a `PACKAGE` argument in a package that loads no DLL with `useDynLib`, with an empty `PACKAGE`,
 * or with a `PACKAGE` naming a base package, another package, or a package the DESCRIPTION does not declare.
 * Unlike `R CMD check`, it recognizes the calls by what flowR knows about them (so a redefined `.Call` is ignored
 * and `base::.Call` is not), resolves the routine and `PACKAGE` through variables, and accepts any DLL
 * the NAMESPACE loads as `PACKAGE`. It does not check the registration of the routines, which needs the installed package.
 */
export const FOREIGN_FUNCTION_CALLS = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', enabledCategories: [] }),
	processSearchResult: async(_elements, config, data) => {
		const ctx = data.inspectContext();
		const df = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const pkg = packageInfo(ctx);
		const dlls = loadedDlls(ctx);
		const declared = new Set(DependencyFields.filter(f => f !== 'LinkingTo').flatMap(f => pkg.declared.get(f) ?? []));
		const info = Resolve.info(df.graph, ctx);
		const text = (id: NodeId | undefined) => {
			const node = id === undefined ? undefined : idMap.get(id);
			return node === undefined ? undefined : RString.is(node) ? node.content.str : config.resolveValues ? NodeValue.singleStringOf(node.info.id, info) : undefined;
		};
		const results: ForeignFunctionCallsResult[] = [];
		let considered = 0;
		const ffiNames = new Set(ctx.env.builtInIndex.with(CallProp.Ffi).map(n => Identifier.getName(n)));
		for(const [id, vertex] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			if(!ffiNames.has(Identifier.getName(vertex.name))) {
				continue;
			}
			const props = callFnProps(id, df);
			const node = idMap.get(id);
			if(!CallProps.hasAny(props, CallProp.Ffi) || !props?.sig?.some(([formal]) => formal === '.NAME') || node === undefined || !pkg.isPackageCode(node.info.file)) {
				continue;
			}
			considered++;
			const bound = FunctionSemantics.call.match.toSpec(vertex.args, Formals);
			/* a named argument is bound by the node naming it, the value lies below */
			const values = new Map(vertex.args.filter(FunctionArgument.isNamed).map(a => [a.nodeId, a.valueId]));
			const valueOf = (formal: 'name' | 'package') => {
				const arg = bound.get(formal)?.[0];
				return arg === undefined ? undefined : values.has(arg) ? values.get(arg) : arg;
			};
			const call = Identifier.getName(vertex.name);
			const loc = SourceLocation.fromNode(node);
			if(loc === undefined) {
				continue;
			}
			const routine = text(valueOf('name'));
			const given = bound.get('package') !== undefined;
			const target = text(valueOf('package'));
			const report = (issue: ForeignFunctionCallIssue, message: string, named?: string) => results.push({
				certainty:  LintingResultCertainty.Certain,
				involvedId: id,
				loc,
				issue,
				call,
				...(routine === undefined ? {} : { routine }),
				...(named === undefined ? {} : { package: named }),
				message:    `${message}: ${call}(${routine === undefined ? '...' : JSON.stringify(routine)}, ...)`
			});
			if(!given) {
				/* R only asks for the argument of a routine named by a string, and not when the NAMESPACE loads a DLL */
				if(routine !== undefined && dlls.size === 0) {
					report('missing-package', 'Foreign function call without \'PACKAGE\' argument');
				}
			} else if(target === '') {
				report('empty-package', 'Foreign function call with empty \'PACKAGE\' argument', '');
			} else if(target !== undefined && pkg.name !== undefined && target !== pkg.name && !dlls.has(target)) {
				report(isBaseRPackage(target) ? 'base-package' : 'different-package', `Foreign function call to ${isBaseRPackage(target) ? 'a base' : 'a different'} package`, target);
				if(!isBaseRPackage(target) && !declared.has(target)) {
					report('undeclared-package', `Undeclared package ${JSON.stringify(target)} in foreign function call`, target);
				}
			}
		}
		return { results, '.meta': { consideredCalls: considered } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.call}${result.routine === undefined ? '' : `(${JSON.stringify(result.routine)})`}: ${result.issue} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} (at ${SourceLocation.format(result.loc)})`
	},
	info: {
		name:          'Foreign Function Calls',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Port of the `R CMD check` notes of `checking foreign function calls`: calls of `.C`, `.Fortran`, `.Call` or `.External` naming a routine by a string without a `PACKAGE` argument in a package that loads no DLL with `useDynLib`, with an empty `PACKAGE`, or with a `PACKAGE` naming a base package, a different package, or a package the DESCRIPTION does not declare. Unlike `R CMD check`, it recognizes the calls by what flowR knows about them (ignoring a redefined `.Call`), resolves routine and `PACKAGE` through variables, and accepts any DLL the NAMESPACE loads. It does not check the registration of the routines, which needs the installed package.',
		defaultConfig: () => ({
			resolveValues: true
		})
	}
} as const satisfies LintingRule<ForeignFunctionCallsResult, ForeignFunctionCallsMetadata, ForeignFunctionCallsConfig>;
