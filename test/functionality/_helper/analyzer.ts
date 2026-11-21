import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { RAnalysisRequest } from '../../../src/project/context/flowr-analyzer-files-context';
import type { FlowrConfig } from '../../../src/config';
import type { IdGenerator, NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NoInfo } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import type { FlowrFileProvider } from '../../../src/project/context/flowr-file';
import type { DataflowInformation } from '../../../src/dataflow/info';
import type { SliceResult } from '../../../src/slicing/static/slicer-types';
import { type ReconstructionResult, reconstructToCode } from '../../../src/reconstruct/reconstruct';
import { buildSourceInlineMap } from '../../../src/reconstruct/inline/source-inline-map';
import { staticSlice } from '../../../src/slicing/static/static-slicer';
import type { SliceDirection } from '../../../src/util/slice-direction';
import type { AutoSelectPredicate } from '../../../src/reconstruct/auto-select/auto-select-defaults';
import { type SlicingCriteria, SlicingCriterion } from '../../../src/slicing/criterion/parse';
import {
	FlowrAnalyzerPackageVersionsSigDbPlugin,
	SigDbPluginName,
	type SigDbSource
} from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';

export interface AnalyzeOptions {
	readonly config?:       FlowrConfig
	readonly getId?:        IdGenerator<NoInfo>
	/** packages the code may use without attaching them, as `solver.assumeAttachedPackages` states them */
	readonly assumeLoaded?: readonly string[]
	/** the signature database to use in place of the bundled one, `false` for none at all */
	readonly sigDb?:        SigDbSource | false
	/** further files of the project, added before the input */
	readonly files?:        readonly FlowrFileProvider[]
}

/**
 * The builder of an analyzer as {@link analyze} sets it up, for tests that need to adapt it further.
 * Without a parser, the analyzer uses the engine its configuration names.
 */
export function testAnalyzerBuilder(parser: KnownParser | undefined, { config, getId, assumeLoaded = [], sigDb }: Omit<AnalyzeOptions, 'files'> = {}): FlowrAnalyzerBuilder {
	const builder = new FlowrAnalyzerBuilder();
	if(parser) {
		builder.setParser(parser);
	}
	if(config) {
		builder.setConfig(config);
	}
	if(assumeLoaded.length > 0) {
		builder.amendConfig(c => {
			c.solver.assumeAttachedPackages = [...(c.solver.assumeAttachedPackages ?? []), ...assumeLoaded];
		});
	}
	if(getId) {
		builder.setInput({ getId });
	}
	if(sigDb !== undefined) {
		builder.unregisterPlugins(SigDbPluginName);
		if(sigDb !== false) {
			builder.registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(sigDb));
		}
	}
	return builder;
}

/**
 * The analyzer for the given code, a `file://` path, or analysis requests: the way a test obtains flowR's results.
 * Prefer this over creating pipelines or builders by hand.
 */
export async function analyze(parser: KnownParser | undefined, input: string | RAnalysisRequest | readonly RAnalysisRequest[], options: AnalyzeOptions = {}): Promise<FlowrAnalyzer> {
	const analyzer = await testAnalyzerBuilder(parser, options).build();
	return analyzer.addFile(...options.files ?? []).addRequest(input);
}

/** What a slice test checks: the analysis the slice was computed on, the slice, and its reconstruction. */
export interface SliceTestResult {
	readonly normalize:   NormalizedAst
	readonly dataflow:    DataflowInformation
	readonly slice:       Readonly<SliceResult>
	readonly reconstruct: ReconstructionResult
}

/** How {@link staticSliceOf} slices and reconstructs, besides how it {@link analyze}s. */
export interface SliceOptions extends AnalyzeOptions {
	readonly direction?:      SliceDirection
	readonly includeCallees?: boolean
	/** forces further nodes into the reconstruction */
	readonly autoSelectIf?:   AutoSelectPredicate
	/** inline resolvable `source()` calls into the reconstruction */
	readonly inlineSources?:  true
}

/** The static slice of `input` for `criteria` and its reconstruction, computed on the analyzer. */
export async function staticSliceOf(parser: KnownParser, input: string, criteria: SlicingCriteria, options: SliceOptions = {}): Promise<SliceTestResult> {
	const analyzer = await analyze(parser, input, options);
	const normalize = await analyzer.normalize();
	const dataflow = await analyzer.dataflow();
	const slice = staticSlice({
		ctx:            analyzer.inspectContext(),
		info:           dataflow,
		ast:            normalize,
		ids:            SlicingCriterion.convertAll(criteria, normalize.idMap),
		direction:      options.direction,
		threshold:      analyzer.flowrConfig.solver.slicer?.threshold,
		includeCallees: options.includeCallees
	});
	const sourceMap = options.inlineSources ? buildSourceInlineMap(normalize, dataflow.graph) : undefined;
	const reconstruct = reconstructToCode(normalize, { nodes: slice.result, inlineSources: options.inlineSources, sourceMap }, options.autoSelectIf);
	return { normalize, dataflow, slice, reconstruct };
}

/** The reconstruction as one text, joining the parts of a reconstruction per file. */
export function joinedCode({ code }: ReconstructionResult): string {
	return Array.isArray(code) ? code.join('\n') : code;
}
