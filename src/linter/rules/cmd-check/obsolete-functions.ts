import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { Identifier } from '../../../dataflow/environments/identifier';
import { type CmdCheckResult, packageInfo } from './cmd-check-util';

/** how a function is obsolete: deprecated, defunct (removed), or only available on some platforms */
export type ObsoleteFunctionKind = 'deprecated' | 'defunct' | 'platform-device';

export interface ObsoleteFunctionsResult extends CmdCheckResult {
	readonly kind: ObsoleteFunctionKind
	/** the obsolete function called */
	readonly name: string
}

export interface ObsoleteFunctionsConfig extends MergeableRecord {
	/** report the functions `R CMD check` knows of, see {@link BuiltinObsoleteFunctions} (default `true`) */
	readonly defaults:        boolean
	/** further deprecated functions to report */
	readonly deprecated:      readonly string[]
	/** further defunct or removed functions to report */
	readonly defunct:         readonly string[]
	/** further platform-specific graphics devices to report */
	readonly platformDevices: readonly string[]
}

export interface ObsoleteFunctionsMetadata extends MergeableRecord {
	/** calls to one of the obsolete functions inspected in package code */
	readonly consideredCalls: number
}

/** the functions `tools:::.check_depdef` looks for, per kind (the platform-specific devices all but on Windows) */
const BuiltinObsoleteFunctions: Record<ObsoleteFunctionKind, readonly string[]> = {
	'deprecated':      ['plclust'],
	'defunct':         ['La.eigen', 'tetragamma', 'pentagamma', 'package.description', 'gammaCody', 'manglePackageName', '.readRDS', '.saveRDS', 'mem.limits', 'trySilent', 'traceOn', 'traceOff', 'print.coefmat', 'anovalist.lm', 'lm.fit.null', 'lm.wfit.null', 'glm.fit.null', 'tkcmd', 'tkfile.tail', 'tkfile.dir', 'tkopen', 'tkclose', 'tkputs', 'tkread', 'Rd_parse', 'CRAN.packages', 'zip.file.extract', 'real', 'as.real', 'is.real', '.find.package', '.path.package'],
	'platform-device': ['quartz', 'x11', 'X11', 'windows', 'win.graph', 'win.metafile', 'win.print']
};

const MessageOf: Record<ObsoleteFunctionKind, string> = {
	'deprecated':      'Found the deprecated function',
	'defunct':         'Found the defunct/removed function',
	'platform-device': 'Found the platform-specific device'
};

/**
 * Port of the `R CMD check` note on obsolete functions (`checking R code for possible problems`, `tools:::.check_depdef`):
 * package code calling a deprecated function, a defunct or removed one, or a platform-specific graphics device.
 * Calls to functions the package defines itself are no finding. Unlike `R CMD check`, which looks at all global
 * symbols of the closures and only at the code of the installed namespace, it reports the calls themselves
 * (also namespaced ones, e.g. `grDevices::x11()`) and points at the call's location in the source.
 */
export const OBSOLETE_FUNCTIONS = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data) => {
		const ctx = data.inspectContext();
		const df = await data.dataflow();
		const idMap = (await data.normalize()).idMap;
		const pkg = packageInfo(ctx);
		const extra: Record<ObsoleteFunctionKind, readonly string[]> = { 'deprecated': config.deprecated, 'defunct': config.defunct, 'platform-device': config.platformDevices };
		const kinds = new Map<string, ObsoleteFunctionKind>();
		for(const kind of Object.keys(MessageOf) as ObsoleteFunctionKind[]) {
			for(const name of [...config.defaults ? BuiltinObsoleteFunctions[kind] : [], ...extra[kind]]) {
				kinds.set(name, kind);
			}
		}
		let considered = 0;
		const results: ObsoleteFunctionsResult[] = [];
		for(const [id, vertex] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			const name = Identifier.getName(vertex.name);
			const kind = kinds.get(name);
			const node = idMap.get(id);
			if(kind === undefined || node === undefined || !pkg.isPackageCode(node.info.file)) {
				continue;
			}
			const origins = Dataflow.origin(df.graph, id) ?? [];
			if(origins.some(o => o.type === OriginType.FunctionCallOrigin)) {
				continue;
			}
			considered++;
			const loc = SourceLocation.fromNode(node);
			if(loc === undefined) {
				continue;
			}
			results.push({
				certainty:  LintingResultCertainty.Certain,
				involvedId: id,
				loc,
				kind,
				name,
				message:    `${MessageOf[kind]}: ${name}${kind === 'platform-device' ? ', dev.new() is the preferred way to open a new device' : ''}`
			});
		}
		return { results, '.meta': { consideredCalls: considered } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.kind} ${result.name} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} (at ${SourceLocation.format(result.loc)})`
	},
	info: {
		name:          'Obsolete Functions',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Deprecated, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Port of the `R CMD check` note on obsolete functions (`checking R code for possible problems`, *"Found the deprecated function"*, *"Found the defunct/removed function"*, and *"Found the platform-specific device"*): package code calling a deprecated or removed function, or a graphics device that only exists on some platforms. Unlike `R CMD check`, it reports the calls themselves, also namespaced ones like `grDevices::x11()`, with their location, and ignores calls to functions the package defines itself. The functions `R CMD check` knows can be extended per kind.',
		defaultConfig: () => ({
			defaults:        true,
			deprecated:      [],
			defunct:         [],
			platformDevices: []
		})
	}
} as const satisfies LintingRule<ObsoleteFunctionsResult, ObsoleteFunctionsMetadata, ObsoleteFunctionsConfig>;
