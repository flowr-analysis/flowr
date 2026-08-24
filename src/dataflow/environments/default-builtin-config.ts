import type { AnyBuiltInDefinition, BuiltInDefinitions, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from './built-in-config';
import { ExitPointType } from '../info';
import { getValueOfArgument } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { DataflowGraph } from '../graph/graph';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexInfo } from '../graph/vertex';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import { UnnamedFunctionCallPrefix } from '../internal/process/functions/call/unnamed-call-handling';
import { KnownHooks } from '../hooks';
import { Identifier, PkgName } from './identifier';
import { BuiltInProcName } from './built-in-proc-name';
import { BuiltInEvalName } from './built-in-eval-name';
import { NseArguments } from '../internal/process/functions/call/known-call-handling';
import { Unquote } from '../internal/process/functions/call/nse';
import { DataMaskingFunctionIdentifiers } from './data-masking-functions';
import { ArgProp, CallProp, CallProps, type FnSig, SemanticProp, type SemanticProps, type StatedProps } from './built-in-props';
import { AttachedBasePackageSet, baseRExportOwner } from '../../util/r-base-packages';
import { RBasePackageStore } from '../../data/r-base-packages.generated';

/** Which stack environment an env-returning/-transforming builtin denotes (see {@link StackEnvBuiltins}). */
export enum StackEnvKind {
	Global,
	Base,
	Empty,
	Current,
	Parent,
	/** `parent.frame()`: the dynamic caller's frame, over-approximated to the global env (exact at a top-level call). */
	CallerFrame,
	Named
}

/** Maps the env-returning/-transforming base builtins and constants to the stack environment each denotes. */
export const StackEnvBuiltins = {
	globalenv:           StackEnvKind.Global,
	baseenv:             StackEnvKind.Base,
	emptyenv:            StackEnvKind.Empty,
	environment:         StackEnvKind.Current,
	'parent.env':        StackEnvKind.Parent,
	'parent.frame':      StackEnvKind.CallerFrame,
	'as.environment':    StackEnvKind.Named,
	/* `.env$x` reaches past the data mask */
	'.env':              StackEnvKind.Current,
	'.GlobalEnv':        StackEnvKind.Global,
	'.BaseEnv':          StackEnvKind.Base,
	'.BaseNamespaceEnv': StackEnvKind.Base
} as const satisfies Record<string, StackEnvKind>;

/**
 * The package owning each plotting function no base-R package exports; a name listed nowhere stays bare.
 * A built-in without a package answers to any `pkg::name`, which is how `base::ggplot` used to resolve.
 */
export const PlotFunctionPackages: Readonly<Record<string, readonly string[]>> = {
	ggplot2:    ['ggplot', 'qplot', 'quickplot', 'autoplot'],
	plotly:     ['ggplotly', 'plot_ly'],
	ggExtra:    ['ggMarginal'],
	ggcorrplot: ['ggcorrplot'],
	forecast:   ['ggseasonplot'],
	ggdendro:   ['ggdendrogram'],
	ggmap:      ['qmap'],
	gridExtra:  ['grid.arrange'],
	factoextra: ['fviz_pca_biplot', 'fviz_pca', 'fviz_pca_ind', 'fviz_pca_var', 'fviz_screeplot',
		'fviz_mca_biplot', 'fviz_mca', 'fviz_mca_ind', 'fviz_mca_var', 'fviz_cluster', 'fviz_dend'],
	survminer: ['ggsurvplot'],
	tinyplot:  ['tinyplot', 'plt', 'tinyplot_add', 'plt_add'],
	lattice:   ['xyplot', 'bwplot', 'stripplot', 'dotplot', 'histogram', 'splom', 'trellis.device'],
	maps:      ['map'],
	leaflet:   ['leaflet'],
	tmap:      ['tm_shape'],
	pheatmap:  ['pheatmap'],
	vioplot:   ['vioplot'],
	gplots:    ['heatmap.2', 'textplot', 'boxplot2'],
	DHARMa:    ['plotSimulatedResiduals'],
	magick:    ['image_graph', 'image_draw'],
	ragg:      ['agg_png', 'agg_jpeg', 'agg_tiff', 'agg_ppm', 'agg_webp', 'agg_capture'],
	rasterpdf: ['raster_pdf']
};

const PlotFunctionOwner: ReadonlyMap<string, string> = new Map(
	Object.entries(PlotFunctionPackages).flatMap(([pkg, names]) => names.map(n => [n, pkg] as const))
);

/** `names` under the package exporting each: base R from the shipped data, the rest from {@link PlotFunctionPackages}. */
export function namespacePlotFunctions(names: readonly string[]): (Identifier | string)[] {
	return names.map(n => {
		const pkg = baseRExportOwner(n) ?? PlotFunctionOwner.get(n);
		return pkg === undefined ? n : Identifier.make(n, pkg);
	});
}

export const GgPlotCreate = [
	'ggplot', 'ggplotly', 'ggMarginal', 'ggcorrplot', 'ggseasonplot', 'ggdendrogram', 'qmap', 'qplot', 'quickplot', 'autoplot', 'grid.arrange',
	'fviz_pca_biplot', 'fviz_pca', 'fviz_pca_ind', 'fviz_pca_var', 'fviz_screeplot', 'fviz_mca_biplot', 'fviz_mca', 'fviz_mca_ind', 'fviz_mca_var', 'fviz_cluster', 'fviz_dend',
	'ggsurvplot',
] as const;
export const TinyPlotCrate = [
	'tinyplot', 'plt'
] as const;
export const GraphicsPlotCreate = [
	'plot', 'plot.new', 'xspline', 'map', 'curve', 'image', 'boxplot', 'dotchart', 'sunflowerplot', 'barplot', 'matplot', 'hist', 'stem',
	'density', 'smoothScatter', 'contour', 'persp', 'XYPlot', 'xyplot', 'stripplot', 'bwplot', 'dotPlot', 'dotplot', 'histPlot', 'densityPlot', 'qPlot', 'qqplot', 'qqPlot', 'boxPlot',
	'bxp', 'assocplot', 'mosaicplot', 'stripchart', 'fourfoldplot', 'plot.xy', 'plot.formula', 'plot.default', 'plot.design', 'stars', 'cotabplot', 'pheatmap',
	'spineplot', 'Plotranges', 'regressogram', 'bootcurve', 'meanplot', 'vioplot', 'pairs', 'copolot', 'histogram', 'splom', 'leaflet', 'tm_shape', 'plot_ly', 'plotProfLik', 'plotSimulatedResiduals', 'plotmeans',
	'overplot', 'residplot', 'heatmap.2', 'lmplot2', 'sinkplot', 'textplot', 'boxplot2', 'profLikCI',
];
export const PlotCreate = GraphicsPlotCreate.concat(TinyPlotCrate, GgPlotCreate);
const GraphicDeviceOpen = [
	'pdf', 'jpeg', 'png', 'windows', 'postscript', 'xfig', 'bitmap', 'pictex', 'cairo_pdf', 'svg', 'bmp', 'tiff', 'X11', 'quartz', 'image_graph',
	'image_draw', 'dev.new', 'trellis.device', 'raster_pdf',
	'agg_png', 'agg_jpeg', 'agg_tiff', 'agg_ppm', 'agg_webp', 'agg_capture'
] as const;
export const TinyPlotAddons = [
	'tinyplot_add', 'plt_add'
];
export const GgPlotImplicitAddons = [
	'geom_count', 'geom_bin_2d', 'geom_spoke', 'geom_tile', 'geom_rect',
	'geom_function', 'geom_crossbar', 'geom_density2d', 'geom_abline', 'geom_errorbar', 'geom_errorbarh',
	'geom_jitter', 'geom_line', 'geom_density', 'geom_quantile', 'geom_qq', 'geom_qq_line', 'geom_segment', 'geom_label', 'geom_density_2d',
	'geom_violin', 'geom_contour', 'geom_boxplot', 'geom_col', 'geom_blank', 'geom_histogram', 'geom_hline', 'geom_area', 'geom_sf_text', 'geom_smooth', 'geom_text',
	'geom_density2d_filled', 'geom_ribbon', 'geom_sf', 'geom_dotplot', 'geom_freqpoly', 'geom_step', 'geom_map', 'geom_bin2d', 'geom_rug', 'geom_raster', 'geom_pointrange', 'geom_point',
	'geom_hex', 'geom_contour_filled', 'geom_bar', 'geom_vline', 'geom_linerange', 'geom_curve', 'geom_path', 'geom_polygon', 'geom_sf_label', 'geom_density_2d_filled', 'geom_dumbbell',
	'geom_encircle', 'stat_count', 'stat_density', 'stat_bin_hex', 'stat_bin_2d', 'stat_summary_bin', 'stat_identity', 'stat_qq', 'stat_binhex', 'stat_boxplot', 'stat_function',
	'stat_align', 'stat_contour_filled', 'stat_summary_2d', 'stat_qq_line', 'stat_contour', 'stat_ydensity', 'stat_summary_hex', 'stat_summary2d', 'stat_sf_coordinates',
	'stat_density_2d_filled', 'stat_smooth', 'stat_density2d', 'stat_ecdf', 'stat_sf', 'stat_quantile', 'stat_unique', 'stat_density_2d', 'stat_ellipse', 'stat_summary',
	'stat_density2d_filled', 'stat_bin', 'stat_sum', 'stat_spoke', 'stat_bin2d',
	'labs', 'theme_void', 'theme_test', 'theme_minimal', 'theme_light', 'theme', 'theme_get', 'theme_gray', 'theme_dark', 'theme_classic', 'theme_linedraw', 'theme_update',
	'theme_replace', 'theme_grey', 'theme_bw', 'theme_tufte', 'theme_survminer', 'facet_null', 'facet_grid', 'facet_wrap', 'xlab', 'xlim', 'ylab', 'ylim',
	'scale_linewidth_ordinal', 'scale_fill_steps', 'scale_color_gradient2', 'scale_size_manual', 'scale_colour_discrete', 'scale_color_identity',
	'scale_fill_fermenter', 'scale_alpha_manual', 'scale_fill_gradient', 'scale_size_date', 'scale_fill_viridis_b', 'scale_x_time', 'scale_linetype_manual',
	'scale_alpha_binned', 'scale_color_grey', 'scale_colour_gradient', 'scale_linewidth_date', 'scale_color_steps2', 'scale_color_viridis_b', 'scale_size_binned',
	'scale_colour_gradientn', 'scale_linewidth_manual', 'scale_fill_viridis_c', 'scale_fill_manual', 'scale_color_viridis_c', 'scale_fill_discrete', 'scale_size_discrete',
	'scale_fill_binned', 'scale_fill_viridis_d', 'scale_colour_fermenter', 'scale_color_viridis_d', 'scale_x_datetime', 'scale_size_identity', 'scale_linewidth_identity',
	'scale_shape_ordinal', 'scale_linewidth_discrete', 'scale_fill_ordinal', 'scale_y_time', 'scale_color_ordinal', 'scale_size_ordinal', 'scale_colour_distiller',
	'scale_linewidth_datetime', 'scale_alpha_identity', 'scale_color_steps', 'scale_alpha_discrete', 'scale_fill_date', 'scale_x_reverse', 'scale_fill_gradientn', 'scale_size_datetime',
	'scale_y_continuous', 'scale_colour_steps', 'scale_color_distiller', 'scale_colour_ordinal', 'scale_y_datetime', 'scale_linetype_discrete', 'scale_colour_viridis_b',
	'scale_alpha_datetime', 'scale_continuous_identity', 'scale_fill_brewer', 'scale_shape_identity', 'scale_color_discrete', 'scale_colour_viridis_c', 'scale_linetype_identity',
	'scale_colour_hue', 'scale_linewidth_binned', 'scale_color_hue', 'scale_shape_continuous', 'scale_colour_viridis_d', 'scale_size_continuous', 'scale_color_manual', 'scale_alpha_date',
	'scale_y_sqrt', 'scale_shape_binned', 'scale_size', 'scale_color_fermenter', 'scale_color_stepsn', 'scale_size_area', 'scale_y_binned', 'scale_y_discrete', 'scale_alpha_continuous',
	'scale_fill_continuous', 'scale_linetype_continuous', 'scale_colour_steps2', 'scale_colour_datetime', 'scale_colour_grey', 'scale_x_log10', 'scale_x_discrete', 'scale_color_continuous',
	'scale_type', 'scale_y_reverse', 'scale_colour_gradient2', 'scale_color_datetime', 'scale_color_date', 'scale_x_continuous', 'scale_colour_manual', 'scale_fill_gradient2',
	'scale_fill_grey', 'scale_colour_stepsn', 'scale_colour_binned', 'scale_color_binned', 'scale_color_gradientn', 'scale_colour_date', 'scale_fill_distiller', 'scale_color_gradient',
	'scale_linewidth_continuous', 'scale_shape', 'scale_fill_hue', 'scale_linetype', 'scale_colour_identity', 'scale_discrete_manual', 'scale_fill_identity', 'scale_y_log10',
	'scale_linetype_binned', 'scale_size_binned_area', 'scale_y_date', 'scale_x_binned', 'scale_shape_discrete', 'scale_colour_brewer', 'scale_x_date', 'scale_discrete_identity',
	'scale_alpha', 'scale_fill_steps2', 'scale_color_brewer', 'scale_fill_datetime', 'scale_shape_manual', 'scale_colour_continuous', 'scale_alpha_ordinal', 'scale_linewidth', 'scale_x_sqrt',
	'scale_fill_stepsn', 'scale_radius', 'rotateTextX', 'removeGridX', 'removeGridY', 'removeGrid',
	'coord_trans', 'coord_sf', 'coord_cartesian', 'coord_fixed', 'coord_flip', 'coord_quickmap', 'coord_equal', 'coord_map', 'coord_polar', 'coord_munch', 'coord_radial',
	'annotate', 'annotation_custom', 'annotation_raster', 'annotation_map', 'annotation_logticks', 'borders', 'ggtitle', 'expansion', 'expand_limits', 'expand_scale', 'guides',
	'wrap_by',
	'theme_solid', 'theme_hc', 'theme_excel_new', 'theme_few', 'theme_clean', 'theme_wsj', 'theme_calc', 'theme_par', 'theme_igray', 'theme_solarized_2', 'theme_excel',
	'theme_economist', 'theme_stata', 'theme_map', 'theme_fivethirtyeight', 'theme_economist_white', 'theme_base', 'theme_foundation', 'theme_gdocs', 'theme_pander', 'theme_solarized',
	'scale_shape_tableau', 'scale_fill_pander', 'scale_shape_few', 'scale_colour_excel_new', 'scale_colour_hc', 'scale_fill_ptol', 'scale_fill_gradient2_tableau', 'scale_shape_calc', 'scale_fill_stata',
	'scale_colour_tableau', 'scale_colour_colorblind', 'scale_color_stata', 'scale_colour_economist', 'scale_fill_calc', 'scale_fill_gradient_tableau', 'scale_shape_cleveland', 'scale_color_pander',
	'scale_colour_pander', 'scale_color_fivethirtyeight', 'scale_color_wsj', 'scale_shape_stata', 'scale_colour_gdocs', 'scale_color_continuous_tableau', 'scale_fill_excel', 'scale_color_few', 'scale_linetype_stata',
	'scale_shape_tremmel', 'scale_color_tableau', 'scale_color_colorblind', 'scale_fill_colorblind', 'scale_colour_stata', 'scale_fill_wsj', 'scale_colour_calc', 'scale_colour_fivethirtyeight', 'scale_fill_hc',
	'scale_shape_circlefill', 'scale_fill_excel_new', 'scale_color_solarized', 'scale_color_excel', 'scale_colour_excel', 'scale_fill_tableau', 'scale_colour_ptol', 'scale_colour_canva', 'scale_color_gradient2_tableau',
	'scale_colour_solarized', 'scale_colour_gradient2_tableau', 'scale_fill_canva', 'scale_color_ptol', 'scale_color_excel_new', 'scale_color_economist', 'scale_fill_economist', 'scale_fill_fivethirtyeight',
	'scale_colour_gradient_tableau', 'scale_colour_few', 'scale_color_calc', 'scale_fill_few', 'scale_fill_gdocs', 'scale_color_hc', 'scale_color_gdocs', 'scale_color_canva', 'scale_color_gradient_tableau',
	'scale_fill_solarized', 'scale_fill_continuous_tableau', 'scale_colour_wsj', 'gradient_color', 'ggsurvplot_add_all'
] as const;
export const PlotFunctionsWithAddParam: Set<string> = new Set([
	'map', 'matplot', 'barplot', 'boxplot', 'curve', 'image', 'plotCI', 'bandplot', 'barplot2', 'bubbleplot'
]);
export const GraphicsPlotAddons = [
	'points', 'abline', 'mtext', 'lines', 'text', 'legend', 'title', 'axis', 'polygon', 'polypath', 'pie', 'rect', 'segments', 'arrows', 'symbols',
	'qqline', 'qqnorm', 'rasterImage',
	'tiplabels', 'rug', 'grid', 'box', 'clip', 'matpoints', 'matlines',
];
export const GgPlotAddons = [
	'ggdraw', 'last_plot'
];
const PlotAddons = GraphicsPlotAddons.concat(GgPlotImplicitAddons, ...PlotFunctionsWithAddParam);

const SigAtomicBinOp: FnSig = [['e1', ArgProp.Value | ArgProp.Atomic], ['e2', ArgProp.Value | ArgProp.Atomic]];
const SigAtomicX: FnSig     = [['x', ArgProp.Value | ArgProp.Atomic]];
const SigXY: FnSig    = [['x', ArgProp.Value], ['y', ArgProp.Value]];
const SigX: FnSig     = [['x', ArgProp.Value]];
/* `f(x, ...)`, the shape of most of R's summarizing and coercing functions */
const SigXDots: FnSig = [['x', ArgProp.Value], ['...', ArgProp.Value]];
/* `verb(.data, ...)`, the shape of the tidyverse verbs: the data first, the columns after */
const SigDataDots: FnSig = [['.data', ArgProp.Value], ['...', ArgProp.Value]];
const SigShape: FnSig  = [['x', ArgProp.Shape]];
const SigXTable: FnSig = [['x', ArgProp.Value], ['table', ArgProp.Value]];
const SigDots: FnSig  = [['...', ArgProp.Value]];

/** what flowR states about one of the functions it defines, in the words a page shows */
export interface StatedSignature {
	/** the package the definition is for, `base` when it names none */
	readonly pkg:     string;
	/**
	 * The formals flowR models, `x, ...`, or `undefined` where it declares none. Not R's own declaration:
	 * flowR names the arguments it has something to say about, so a page must not print an empty list as
	 * though the function took nothing.
	 */
	readonly params?: string;
	/** what it does, from {@link CallProp.labels} */
	readonly props:   readonly string[];
}

/**
 * The manual page documenting a base R primitive, for the ones not documented under their own name.
 *
 * A primitive is written in C and has no R closure, so nothing extracts a signature, a source file or a help
 * topic for it and the signature database holds no entry at all: `base::sin` is documented under `Trig`, and
 * guessing `sin` only names a page that does not exist. flowR states these names itself, so it carries where
 * they are documented as well. Written the way R documents them, one page and everything it covers.
 */
const PrimitivesPerTopic: Readonly<Record<string, readonly string[]>> = {
	'Arithmetic':   ['%%', '%/%', '*', '+', '-', '/', '^'],
	'assignOps':    ['<-', '<<-', '='],
	'call':         ['as.call'],
	'CallExternal': ['.Call', '.External'],
	'character':    ['as.character', 'is.character'],
	'Colon':        [':'],
	'Comparison':   ['!=', '<', '<=', '==', '>', '>='],
	'complex':      ['Arg', 'Conj', 'Im', 'Mod', 'Re', 'as.complex'],
	'Control':      ['break', 'for', 'if', 'next', 'repeat', 'while'],
	'crossprod':    ['tcrossprod'],
	'cumsum':       ['cummax', 'cummin', 'cumprod'],
	'double':       ['as.double'],
	'environment':  ['baseenv', 'emptyenv', 'globalenv'],
	'Extract':      ['$', '[', '[['],
	'Extremes':     ['max', 'min'],
	'Foreign':      ['.C', '.Fortran'],
	'function':     ['return'],
	'Hyperbolic':   ['acosh', 'asinh', 'atanh', 'cosh', 'sinh', 'tanh'],
	'integer':      ['as.integer'],
	'Internal':     ['.Internal'],
	'is.finite':    ['is.infinite', 'is.nan'],
	'list':         ['is.list'],
	'Log':          ['exp', 'expm1', 'log', 'log10', 'log1p', 'log2'],
	'Logic':        ['!', '&', '&&', '|', '||'],
	'logical':      ['as.logical', 'is.logical'],
	'MathFun':      ['abs', 'sqrt'],
	'matmult':      ['%*%'],
	'matrix':       ['is.matrix'],
	'NA':           ['is.na'],
	'nchar':        ['nzchar'],
	'ns-dblcolon':  ['::', ':::'],
	'NULL':         ['is.null'],
	'numeric':      ['as.numeric', 'is.numeric'],
	'Paren':        ['(', '{'],
	'Primitive':    ['.Primitive'],
	'raw':          ['as.raw'],
	'Round':        ['ceiling', 'floor', 'round', 'signif', 'trunc'],
	'seq':          ['seq.int', 'seq_along', 'seq_len'],
	'slotOp':       ['@'],
	'substitute':   ['quote'],
	'tilde':        ['~'],
	'Trig':         ['acos', 'asin', 'atan', 'cos', 'sin', 'tan'],
};

/** {@link PrimitivesPerTopic} the way a lookup wants it: the topic documenting a name. */
export const BasePrimitiveTopics: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(PrimitivesPerTopic).flatMap(([topic, names]) => names.map(name => [name, topic])));

/**
 * What flowR states about every function it carries a definition for, as `name -> signatures`. A name may be
 * defined for several packages (`filter` is dplyr's and cohortBuilder's), so all of them are here and the
 * caller picks by package; {@link statedSignatureOf} does that. The signature browser and the playground both
 * show this next to what a database says, so both read it from here.
 */
export function statedSignatures(definitions: BuiltInDefinitions = DefaultBuiltinConfig): Map<string, StatedSignature[]> {
	const stated = new Map<string, StatedSignature[]>();
	for(const definition of definitions) {
		const info = (definition as { config?: StatedProps & { sig?: FnSig } }).config;
		for(const id of definition.names) {
			const name = String(Identifier.getName(id));
			const pkg = String(Identifier.getNamespace(id) ?? PkgName.Base);
			const declared = (info?.sig ?? []).map(([param]: readonly [string, unknown]) => param);
			const entry = { pkg, params: declared.length > 0 ? declared.join(', ') : undefined, props: CallProps.labels(info) };
			const known = stated.get(name) ?? [];
			/* the last definition for a package is the one that resolves, so it is the one stated */
			stated.set(name, [...known.filter(other => other.pkg !== pkg), entry]);
		}
	}
	return stated;
}

/**
 * The one of {@link statedSignatures} a reader means: the definition for `pkg` when there is one, else base
 * R's, else whichever came first. `undefined` when flowR states nothing about the name at all.
 */
export function statedSignatureOf(stated: ReadonlyMap<string, readonly StatedSignature[]>, name: string, pkg?: string): StatedSignature | undefined {
	const known = stated.get(name);
	return known?.find(entry => entry.pkg === pkg) ?? known?.find(entry => entry.pkg === PkgName.Base) ?? known?.[0];
}

const RegexConvIn = /[-/\\^$*+?.()|[\]{}]/g;
/** Builds a regex from an array of plain names or namespaced {@link Identifier}s, deduplicating by name. */
function toRegex(n: readonly Identifier[]): RegExp {
	return new RegExp(`^(${
		Array.from(new Set(n.map(Identifier.getName)), s => s.replaceAll(RegexConvIn, String.raw`\$&`)).filter(s => s.length > 0).join('|')
	})$`);
}

/** what closing or exporting a device links back to: the plot calls that filled it */
const LinkToLastPlot = {
	type:     'link-to-last-call',
	callName: toRegex((GraphicDeviceOpen as readonly string[]).concat(PlotCreate, PlotAddons, GgPlotAddons, TinyPlotAddons))
} as const;

/**
 * The internal generics: they dispatch in C rather than through `UseMethod`, so no signature can state it and
 * the list has to be written down. Everything that dispatches from R is generated, see {@link RBasePackageStore}.
 */
const InternalGenerics: readonly string[] = [
	'$', '[', '[[', '+', '-', '*', '/', '^', '%%', '%/%', '==', '!=', '<', '>', '<=', '>=', '&', '|', '!',
	'c', 'length', 'dim', 'dimnames', 'names', 'max', 'min', 'range', 'sum', 'prod', 'abs', 'sqrt', 'exp',
	'log', 'floor', 'ceiling', 'round', 'signif', 'trunc', 'cumsum', 'cumprod', 'cummax', 'cummin',
	'as.character', 'as.integer', 'as.double', 'as.logical', 'as.complex', 'as.numeric', 'as.raw',
	'is.na', 'is.nan', 'is.finite', 'is.infinite', 'is.matrix', 'is.numeric', 'cbind', 'rbind'
];

/**
 * Every name R dispatches on: the generated closure generics plus the {@link InternalGenerics}, i.e. the
 * {@link RGroupGenerics} members, the `.S3PrimitiveGenerics` and internal generics (which have no R body, so
 * {@link fnInfoFromSignature} could never see them), and the `UseMethod` closures flowR models itself, as its
 * own definition hides the one in the signature database.
 * The `<-` forms are left out, one replacement definition covers many names.
 * `npm run check:generic-labels` (part of `checkup`) compares this against a synced database.
 */
const RGenerics: ReadonlySet<string> = new Set([...RBasePackageStore.generics, ...InternalGenerics]);

/** Label every {@link RGenerics} {@link CallProp.Generic}, splitting an entry that mixes them with names that do not dispatch (`&` does, `&&` does not). */
function markGenerics(definitions: BuiltInDefinitions): BuiltInDefinitions {
	const out: BuiltInDefinitions = [];
	for(const def of definitions) {
		if(def.type !== 'function') {
			out.push(def);
			continue;
		}
		/* the attached base packages are the ones whose namespace layer a registered built-in hides, so their
		 * label is the only thing left stating the dispatch */
		let generics: Identifier[] | undefined = undefined;
		let rest: Identifier[] | undefined = undefined;
		for(const name of def.names) {
			if(RGenerics.has(Identifier.getName(name)) && AttachedBasePackageSet.has(Identifier.getNamespace(name) ?? PkgName.Base)) {
				(generics ??= []).push(name);
			} else {
				(rest ??= []).push(name);
			}
		}
		if(generics === undefined) {
			out.push(def);
			continue;
		}
		out.push({ ...def, names: generics, config: { ...def.config, props: (def.config?.props ?? 0) | CallProp.Generic } });
		if(rest !== undefined) {
			out.push({ ...def, names: rest });
		}
	}
	return out;
}

/** what creating a plot does; restated by the deprecated plot creators, which do the same but should not be used */
const PlotCreateConfig = {
	forceArgs:             'all',
	hasUnknownSideEffects: {
		type:     'link-to-last-call',
		ignoreIf: (source: NodeId, graph: DataflowGraph) => {
			const sourceVertex = graph.getVertex(source) as DataflowGraphVertexFunctionCall;

			/* map with add = true appends to an existing plot */
			return (PlotFunctionsWithAddParam.has(Identifier.getName(sourceVertex.name)) && getValueOfArgument(graph, sourceVertex, {
				index: -1,
				name:  'add'
			}, [RType.Logical])?.content === true);
		},
		callName: toRegex(GraphicDeviceOpen)
	},
	tags: [SemanticProp.Graphics] as SemanticProps
} as const;

/**
 * Contains the built-in definitions recognized by flowR, as they are written down: {@link DefaultBuiltinConfig}
 * is what {@link markGenerics} makes of them, and a test checks that this is all it changes.
 */
export const WrittenBuiltinDefinitions = [
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['NULL', 'NA', 'NA_integer_', 'NA_real_', 'NA_complex_', 'NA_character_']), value: null, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['NaN', PkgName.Base])], value: NaN, assumePrimitive: true },
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['.GlobalEnv', '.BaseNamespaceEnv', '.BaseEnv']), value: null, assumePrimitive: true },
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['TRUE', 'T']),  value: true,  assumePrimitive: true },
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['FALSE', 'F']),  value: false, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['Inf', PkgName.Base])],  value: Infinity,  assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['-Inf', PkgName.Base])], value: -Infinity, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['pi', PkgName.Base])],   value: Math.PI,   assumePrimitive: true },
	{ type:            'constant', names:           [Identifier.from(['LETTERS', PkgName.Base])],
		value:           Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), assumePrimitive: true },
	{ type:            'constant', names:           [Identifier.from(['letters', PkgName.Base])],
		value:           Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)), assumePrimitive: true },
	{ type:            'constant', names:           [Identifier.from(['month.abb', PkgName.Base])],
		value:           ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], assumePrimitive: true },
	{ type:            'constant', names:           [Identifier.from(['month.name', PkgName.Base])],
		value:           ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], assumePrimitive: true },
	/* formula: operands are model terms/columns, not variables */
	{
		type:            'function',
		names:           [Identifier.from(['~', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { markArgsAsMasked: NseArguments.All },
		assumePrimitive: false
	},
	/* cohortBuilder has a `filter` too, and built-ins go by name, so dplyr's entry below wins in the environment
	   while this one still states what cohortBuilder's does */
	{
		type:            'function',
		names:           [Identifier.from(['filter', PkgName.CohortBuilder])],
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, props: CallProp.Pure },
		assumePrimitive: false
	},
	/* data-masking: the non-data arguments name columns of the (first) data object, not variables */
	{
		type:            'function',
		names:           DataMaskingFunctionIdentifiers,
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure },
		assumePrimitive: false
	},
	/* slice_sample draws rows at random; registered after the block above, so this definition is the one that sticks */
	{
		type:            'function',
		names:           [Identifier.from(['slice_sample', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, tags: [SemanticProp.Random] },
		assumePrimitive: false
	},
	/* data-masking without a data argument, e.g. `aes(x, y)` */
	{
		type:  'function',
		names: [...Identifier.fromAll(PkgName.GgPlot2, ['aes', 'vars']), Identifier.from(['join_by', PkgName.Dplyr]),
			...Identifier.fromAll(PkgName.Tibble, ['tibble', 'tribble'])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { markArgsAsMasked: NseArguments.All },
		assumePrimitive: false
	},
	/* an {@link BuiltInEvalName} marks what the value solver folds; a test checks the names against the handler tables */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['+', '-', '*', '/', '^', '**', '%%', '%/%']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigAtomicBinOp }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['==', '!=', '>', '<', '>=', '<=']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigAtomicBinOp }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Comparison },
	{ type:            'function', names:           [Identifier.from(['%*%', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigXY }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['%in%', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigXTable }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from([':', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['from', ArgProp.Value | ArgProp.Atomic], ['to', ArgProp.Value | ArgProp.Atomic]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Seq },
	{ type:            'function', names:           [Identifier.from(['!', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigAtomicX }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Logical },
	{ type:            'function', names:           [Identifier.from(['?', PkgName.Utils])], /* shows the help page of what it is given */
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { sig: [['e1', ArgProp.Nse], ['e2', ArgProp.Nse]] }, assumePrimitive: true },
	/* the result follows from how large the argument is, not from what is in it, so it is bounded (`Narrows`) */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['length', 'lengths', 'nrow', 'ncol', 'NROW', 'NCOL', 'dim', 'is.null', 'is.factor', 'is.vector', 'is.matrix', 'is.data.frame', 'is.numeric', 'is.character', 'is.logical', 'is.function', 'is.list']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: SigShape }, assumePrimitive: true },
	/* the names and the class are read off the argument, so whatever it carries can show up in the result */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['dimnames', 'names', 'rownames', 'colnames', 'class']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigShape }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['nchar', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: SigShape }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	{ type:            'function', names:           [Identifier.from(['missing', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Presence]] }, assumePrimitive: true },
	/* they fold everything they are handed into one result */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['sum', 'prod', 'min', 'max', 'range', 'pmin', 'pmax', 'cbind', 'rbind', 'data.frame', 'order', 'any']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigDots }, assumePrimitive: true },
	/* the separator sits behind the `...`, so R (and the {@link FnSig}) only ever matches it by its full name */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['paste', 'paste0']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['...', ArgProp.Value], ['sep', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	{ type:            'function', names:           [Identifier.from(['file.path', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['...', ArgProp.Value], ['fsep', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	/* `here` joins its arguments below the project root, which stays implicit */
	{ type:            'function', names:           [Identifier.from(['here', PkgName.Here])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { libFn: true, props: CallProp.Pure, sig: [['...', ArgProp.Value]] }, assumePrimitive: false, evalHandler:     BuiltInEvalName.StringFn },
	/* `x` carries the data, whatever follows only tunes the result */
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Base, [
				/* `mean` reduces a vector, so unlike its neighbors below the value solver cannot fold it */
				'mean',
				/* running summaries & reordering */
				'cumsum', 'cumprod', 'cummax', 'cummin', 'diff', 'sort', 'rev', 'unique', 'duplicated', 't',
				/* coercion */
				'as.character', 'as.integer', 'as.logical', 'as.numeric', 'as.matrix', 'as.data.frame',
				'as.factor', 'as.raw', 'as.list', 'as.array', 'as.double', 'as.complex', 'factor'
			]),
			...Identifier.fromAll(PkgName.Utils, ['head', 'tail']),
			...Identifier.fromAll(PkgName.Stats, ['var', 'sd', 'median', 'quantile']),
		],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: SigXDots },
		assumePrimitive: true
	},
	/* they read the values but answer only with a logical, so nothing those values carry reaches the result */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['is.na', 'nzchar', 'is.finite', 'is.infinite', 'is.nan']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: SigX }, assumePrimitive: true },
	/* the numeric functions the value solver folds; each one is an entry of `NumericFns`, which states its parameters */
	{ type:  'function', names: Identifier.fromAll(PkgName.Base, ['sqrt', 'abs', 'floor', 'ceiling', 'trunc', 'sign', 'exp', 'expm1', 'log2', 'log10', 'log1p',
		'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh']),
	processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigX }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['round', 'signif']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['digits', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           [Identifier.from(['log', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['base', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['tolower', 'toupper', 'trimws']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigX }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['basename', 'dirname']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['path', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['Re', 'Im', 'Mod', 'Arg', 'Conj']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['z', ArgProp.Value]] }, assumePrimitive: true },
	/* the vector constructors take the length of the result, not its contents */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['numeric', 'character', 'logical', 'integer', 'double', 'raw']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['length', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['na.omit', PkgName.Stats])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['object', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	/* two data arguments, under the names R gives them */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['xor', 'crossprod', 'tcrossprod', 'intersect', 'union', 'setdiff']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigXY }, assumePrimitive: true },
	/* they answer with a position or a logical, never with what they matched */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['match', 'pmatch', 'charmatch']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: SigXTable }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['is.element', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['el', ArgProp.Value], ['set', ArgProp.Value]] }, assumePrimitive: true },
	/* the result is one of the `choices`, so what flows in is bounded by that argument */
	{ type:            'function', names:           [Identifier.from(['match.arg', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['arg', ArgProp.Value], ['choices', ArgProp.Bounds]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['atan2', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['y', ArgProp.Value], ['x', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['bitwAnd', 'bitwOr', 'bitwXor']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['a', ArgProp.Value], ['b', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['bitwShiftL', 'bitwShiftR']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['a', ArgProp.Value], ['n', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           [Identifier.from(['bitwNot', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['a', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Numeric },
	{ type:            'function', names:           [Identifier.from(['grepl', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['pattern', ArgProp.Value], ['x', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['startsWith', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['x', ArgProp.Value], ['prefix', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['endsWith', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['x', ArgProp.Value], ['suffix', ArgProp.Value]] }, assumePrimitive: true },
	/* the rest of the pure computations, where no single shape fits */
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Base, [
				'rep', 'rep.int', 'seq', 'seq.int', 'append', 'complex',
				'matrix', 'array', 'table', 'prop.table', 'colSums', 'rowSums', 'colMeans', 'rowMeans',
				'solve', 'det', 'eigen', 'aperm',
				/* string */
				'grep', 'sub', 'gsub', 'substr', 'substring', 'strsplit', 'strrep', 'chartr', 'strtoi',
				'regexpr', 'gregexpr', 'regexec', 'format', 'sprintf', 'formatC',
				/* regmatches yields a substring of its subject, so what flows in flows out */
				'regmatches'
			]),
			...Identifier.fromAll(PkgName.Stats, ['cor', 'cov', 'xtabs']),
		],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure },
		assumePrimitive: true
	},
	/* the hypothesis tests: they compute a test statistic and hand it back visibly, which is the output a reader sees */
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Stats, [
				'anova', 'ansari.test', 'aov', 'bartlett.test', 'binom.test', 'Box.test', 'chisq.test', 'cor.test',
				'fisher.test', 'fligner.test', 'friedman.test', 'kruskal.test', 'ks.test', 'manova', 'mantelhaen.test',
				'mauchly.test', 'mcnemar.test', 'mood.test', 'oneway.test', 'pairwise.prop.test', 'pairwise.t.test',
				'pairwise.wilcox.test', 'poisson.test', 'PP.test', 'prop.test', 'prop.trend.test', 'quade.test',
				'shapiro.test', 't.test', 'TukeyHSD', 'var.test', 'wilcox.test'
			]),
			...Identifier.fromAll(PkgName.Car, ['Anova', 'durbinWatsonTest', 'leveneTest', 'linearHypothesis', 'ncvTest', 'outlierTest']),
			...Identifier.fromAll(PkgName.LmTest, ['bgtest', 'bptest', 'coeftest', 'dwtest', 'gqtest', 'lrtest', 'raintest', 'resettest', 'waldtest']),
			...Identifier.fromAll(PkgName.NorTest, ['ad.test', 'cvm.test', 'lillie.test', 'pearson.test', 'sf.test']),
			...Identifier.fromAll(PkgName.Tseries, ['adf.test', 'jarque.bera.test', 'kpss.test', 'pp.test', 'runs.test', 'white.test']),
			...Identifier.fromAll(PkgName.Rstatix, ['anova_test', 'chisq_test', 'cor_test', 'kruskal_test', 'shapiro_test', 't_test', 'wilcox_test']),
			Identifier.from(['glht', PkgName.Multcomp])
		],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, tags: [SemanticProp.Statistics] },
		assumePrimitive: false
	},

	/* indices and index sequences: bounded by the shape of what they are handed, never by its contents */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['which', 'which.max', 'which.min', 'seq_len', 'seq_along']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows] }, assumePrimitive: true },

	/* they open a device that writes the plot to the file they are given, under the name each of them uses */
	{ type:            'function', names:           [...Identifier.fromAll(PkgName.GrDevices, ['png', 'jpeg', 'bmp', 'tiff', 'svg', 'cairo_pdf']), Identifier.from(['raster_pdf', PkgName.RasterPdf]), ...Identifier.fromAll(PkgName.Ragg, ['agg_png', 'agg_jpeg', 'agg_tiff', 'agg_ppm', 'agg_webp'])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.Graphics, SemanticProp.File, SemanticProp.Writes], sig: [['filename', ArgProp.Resource], ['width', ArgProp.Value], ['height', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           Identifier.fromAll(PkgName.GrDevices, ['pdf', 'postscript', 'xfig', 'bitmap', 'pictex']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.Graphics, SemanticProp.File, SemanticProp.Writes], sig: [['file', ArgProp.Resource], ['type', ArgProp.Value], ['height', ArgProp.Value], ['width', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	/* devices that draw on the screen or into memory instead */
	{ type:            'function', names:           [...Identifier.fromAll(PkgName.GrDevices, ['X11', 'windows', 'quartz', 'dev.new']), Identifier.from(['trellis.device', PkgName.Lattice]), ...Identifier.fromAll(PkgName.Magick, ['image_graph', 'image_draw'])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { tags: [SemanticProp.Graphics] }, assumePrimitive: true },

	{ type:            'function', names:           [Identifier.from(['read.csv', PkgName.Utils])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.File, SemanticProp.Reads], sig: [['file', ArgProp.Resource], ['header', ArgProp.Flag], ['sep', ArgProp.Value], ['quote', ArgProp.Value], ['dec', ArgProp.Value], ['fill', ArgProp.Flag], ['comment.char', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['scan', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.File, SemanticProp.Reads, SemanticProp.User], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	/* the connections and the calls that move data through them, so anything reaching them inherits it */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['file', 'gzfile', 'bzfile', 'xzfile', 'unz', 'fifo']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Opens, tags: [SemanticProp.File, SemanticProp.Reads, SemanticProp.Writes], sig: [['description', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['url', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Opens, tags: [SemanticProp.Network, SemanticProp.Reads], sig: [['description', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['socketConnection', 'serverSocket']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Opens, tags: [SemanticProp.Network, SemanticProp.Reads], sig: [['host', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['textConnection', 'rawConnection']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Opens, sig: [['object', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['dbConnect', PkgName.Dbi])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { libFn: true, props: CallProp.Opens, tags: [SemanticProp.Database] }, assumePrimitive: false },
	/* the calls ending what an opener started, each stating the argument holding the handle */
	{ type:            'function', names:           [Identifier.from(['close', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Closes | CallProp.Invisible | CallProp.Generic, sig: [['con', ArgProp.Handle], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['closeAllConnections', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Closes | CallProp.Invisible }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['dbDisconnect', PkgName.Dbi])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { libFn: true, props: CallProp.Closes | CallProp.Invisible, tags: [SemanticProp.Database], sig: [['conn', ArgProp.Handle], ['...', ArgProp.Value]] }, assumePrimitive: false },
	/* withr closes the connection it is handed when the scope it is called in ends */
	{ type:            'function', names:           [Identifier.from(['local_connection', PkgName.Withr])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { libFn: true, props: CallProp.Closes, sig: [['con', ArgProp.Handle], ['.local_envir', ArgProp.Written]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['with_connection', PkgName.Withr])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { libFn: true, props: CallProp.Closes | CallProp.MayPure, sig: [['con', ArgProp.Handle], ['code', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['readLines', 'readBin', 'readChar']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.File, SemanticProp.Reads], sig: [['con', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['readRDS', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.File, SemanticProp.Reads], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['writeLines', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes, SemanticProp.Prints], sig: [['text', ArgProp.Value], ['con', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['writeBin', 'writeChar']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['object', ArgProp.Value], ['con', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['saveRDS', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['object', ArgProp.Value], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['save', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['...', ArgProp.Value], ['list', ArgProp.Value], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['save.image', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['dput', 'write']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes, SemanticProp.Prints], sig: [['x', ArgProp.Value], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['write.dcf', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['x', ArgProp.Value], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['write.table', PkgName.Utils])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['x', ArgProp.Value], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Utils, ['write.csv', 'write.csv2']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['x', ArgProp.Value], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Utils, ['read.table', 'read.delim', 'read.csv2', 'read.delim2']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.File, SemanticProp.Reads], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['download.file', PkgName.Utils])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.Network, SemanticProp.File, SemanticProp.Writes], sig: [['url', ArgProp.Resource], ['destfile', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['jitter', PkgName.Stats])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { tags: [SemanticProp.Random] }, assumePrimitive: true },
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Base, ['sample', 'sample.int']),
			...Identifier.fromAll(PkgName.Stats, [
				'runif', 'rnorm', 'rbinom', 'rpois', 'rexp', 'rgamma', 'rbeta', 'rcauchy', 'rchisq', 'rgeom',
				'rhyper', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rsignrank', 'rt', 'rf', 'rweibull',
				'rwilcox', 'arima.sim', 'simulate', 'kmeans'
			])
		],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.Random] },
		assumePrimitive: false
	},
	{ type:            'function', names:           [Identifier.from(['expression', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { tags: [SemanticProp.Lang] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['rm', PkgName.Base])],
		processor:       BuiltInProcName.Rm, config:          { props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true },
	/* they read the state they set, so both bits apply */
	{ type:            'function', names:           [Identifier.from(['options', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: 'all', props: CallProp.Invisible | CallProp.Ambient | CallProp.Configures }, assumePrimitive: false },
	/* `Sys.putenv` is defunct in current R, older scripts still use it */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['Sys.setenv', 'Sys.unsetenv', 'Sys.setlocale', 'Sys.putenv', 'Sys.setLanguage']),
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: 'all', props: CallProp.Invisible | CallProp.Configures }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['mapply', PkgName.Base]), Identifier.from(['Mapply', PkgName.Functools])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure, sig: [['FUN', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['lapply', 'sapply', 'vapply']),
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure, sig: [['X', ArgProp.Value], ['FUN', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	/* `vapply` takes the shape of the result before its `...`, so naming it keeps the positions honest */
	{ type:            'function', names:           [Identifier.from(['vapply', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure, sig: [['X', ArgProp.Value], ['FUN', ArgProp.Callee], ['FUN.VALUE', ArgProp.Shape], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Functools, ['Lapply', 'Sapply', 'Vapply']),
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type:            'function', names:           [...Identifier.fromAll(PkgName.Base, ['apply', 'tapply']), Identifier.from(['Tapply', PkgName.Functools])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 2, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['Map', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['Filter', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee], ['x', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['Find', 'Position']),
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee], ['x', ArgProp.Value], ['right', ArgProp.Flag], ['nomatch', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['Reduce', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['rapply', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 1, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['print', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', keepArgumentOut: true, hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ }, props: CallProp.Invisible | CallProp.Generic, tags: [SemanticProp.Prints], sig: [['x', ArgProp.Alias | ArgProp.Forced], ['...', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type:            'function', names:           [...Identifier.fromAll(PkgName.Base, ['message', 'warning']), Identifier.from(['warn', PkgName.Rlang]), Identifier.from(['warn', PkgName.Rutils]), Identifier.from(['info', PkgName.Msgr])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', keepArgumentOut: true, hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ }, props: CallProp.Invisible, tags: [SemanticProp.Prints], sig: [['...', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['invisible', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', keepArgumentOut: true, props: CallProp.Pure | CallProp.Invisible, sig: [['x', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: true },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['force', 'identity']),
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', keepArgumentOut: true, props: CallProp.Pure, sig: [['x', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: false },
	// graphics base
	{ type:            'function', names:           namespacePlotFunctions(PlotCreate),
		processor:       BuiltInProcName.Default,
		config:          PlotCreateConfig, assumePrimitive: true },
	/* `qplot` creates a plot like the ones above and is deprecated on top of it; registered after them so this
	   definition is the one that sticks */
	{ type:            'function', names:           [Identifier.from(['qplot', PkgName.GgPlot2])],
		processor:       BuiltInProcName.Default,
		config:          { ...PlotCreateConfig, props: CallProp.Deprecated, tags: [SemanticProp.Graphics] }, assumePrimitive: true },
	// graphics addons
	{ type:      'function', names:     namespacePlotFunctions(PlotAddons),
		processor: BuiltInProcName.Default,             config:    {
			forceArgs:     'all',
			treatAsFnCall: {
				'facet_grid': ['labeller']
			},
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex(PlotCreate.concat(PlotAddons)),
				ignoreIf: (source: NodeId, graph: DataflowGraph) => {
					const sourceVertex = graph.getVertex(source) as DataflowGraphVertexFunctionCall;

					/* map with add = true appends to an existing plot */
					return (PlotFunctionsWithAddParam.has(Identifier.getName(sourceVertex.name)) && getValueOfArgument(graph, sourceVertex, {
						index: -1,
						name:  'add'
					}, [RType.Logical])?.content !== true);
				},
				cascadeIf: (targetVertex: DataflowGraphVertexInfo, _: NodeId, graph: DataflowGraph) => {
					const target = targetVertex as DataflowGraphVertexFunctionCall;
					/* map with add = true appends to an existing plot */
					return Identifier.getName(target.name) ? (getValueOfArgument(graph, target, {
						index: 11,
						name:  'add'
					}, [RType.Logical])?.content === true ? CascadeAction.Continue : CascadeAction.Stop) : CascadeAction.Stop;
				}
			},
			tags: [SemanticProp.Graphics]
		}, assumePrimitive: true },
	// plot tags
	{
		type:      'function',
		names:     namespacePlotFunctions(GgPlotAddons),
		processor: BuiltInProcName.Default,
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex((GgPlotCreate as readonly string[]).concat(GgPlotAddons))
			},
			tags: [SemanticProp.Graphics]
		}, assumePrimitive: true },
	{
		type:      'function',
		names:     namespacePlotFunctions(TinyPlotAddons),
		processor: BuiltInProcName.Default,
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex([...TinyPlotCrate, ...TinyPlotAddons])
			},
			tags: [SemanticProp.Graphics]
		}, assumePrimitive: true },
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Magick, ['image_capture']),
			...Identifier.fromAll(PkgName.GrDevices, ['dev.capture'])
		],
		processor:       BuiltInProcName.Default,
		config:          { libFn: true, forceArgs: 'all', hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticProp.Graphics] },
		assumePrimitive: true },
	/* they put what the device holds on disk */
	{ type:            'function', names:           [Identifier.from(['image_write', PkgName.Magick])],
		processor:       BuiltInProcName.Default,
		config:          { libFn: true, forceArgs: 'all', hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticProp.Graphics, SemanticProp.File, SemanticProp.Writes], sig: [['image', ArgProp.Value], ['path', ArgProp.Resource]] },
		assumePrimitive: true },
	{ type:            'function', names:           Identifier.fromAll(PkgName.GrDevices, ['dev.off', 'graphics.off']),
		processor:       BuiltInProcName.Default,
		config:          { libFn: true, forceArgs: 'all', hasUnknownSideEffects: LinkToLastPlot, props: CallProp.Closes, tags: [SemanticProp.Graphics, SemanticProp.File, SemanticProp.Writes] },
		assumePrimitive: true },
	{ type:            'function', names:           ['('],
		processor:       BuiltInProcName.Default, config:          { keepArgumentOut: true, props: CallProp.Pure, sig: [['x', ArgProp.Alias]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Group },
	{ type:            'function', names:           [Identifier.from(['load_all', PkgName.PkgLoad]), Identifier.from(['load_all', PkgName.Devtools])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true], props: CallProp.Scope }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['setwd', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true], props: CallProp.Invisible | CallProp.Ambient | CallProp.Configures }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['set.seed', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true], props: CallProp.Invisible | CallProp.Configures, tags: [SemanticProp.Random] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['body', 'formals']),
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true], tags: [SemanticProp.Lang] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['environment', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true] }, assumePrimitive: true },
	{
		type:      'function',
		names:     Identifier.fromAll(PkgName.Base, ['.Call', '.External', '.C', '.Fortran']),
		processor: BuiltInProcName.Default,
		config:    {
			hasUnknownSideEffects: true,
			forceArgs:             [true],
			/* the routine usually comes from useDynLib, but it may be a variable holding a symbol */
			markArgsAsMasked:      NseArguments.First,
			treatAsFnCall:         {
				'.Call':     ['.NAME'],
				'.External': ['.NAME'],
				'.C':        ['.NAME'],
				'.Fortran':  ['.NAME']
			},
			tags: [SemanticProp.Ffi]
		},
		assumePrimitive: true
	},
	{ type:            'function', names:           [Identifier.from(['eval', PkgName.Base])],
		processor:       BuiltInProcName.Eval, config:          { includeFunctionCall: true, supportFunctionCall: false, keepEnvironment: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['evalText', PkgName.Soda])],
		processor:       BuiltInProcName.Eval, config:          { includeFunctionCall: true, supportFunctionCall: true, keepEnvironment: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['cat', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ }, props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes, SemanticProp.Prints], sig: [['...', ArgProp.Value | ArgProp.Forced], ['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['switch', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: [true], alternativeArgsFrom: 1, useAsProcessor: BuiltInProcName.Switch, props: CallProp.Pure }, assumePrimitive: false },
	{ type:            'function', names:           ['return'],
		processor:       BuiltInProcName.Default, config:          { cfg: ExitPointType.Return, keepArgumentOut: true, useAsProcessor: BuiltInProcName.Return, props: CallProp.Pure, sig: [['value', ArgProp.Alias]] }, assumePrimitive: true },
	{
		type:  'function',
		names: [
			Identifier.from(['stop', PkgName.Base]),
			Identifier.from(['abort', PkgName.Rlang]), Identifier.from(['cli_abort', PkgName.Cli]),
			Identifier.from(['throw', PkgName.RmethodsS3]), Identifier.from(['throw', PkgName.Roo]), /* R.oo re-exports R.methodsS3::throw */
			...Identifier.fromAll(PkgName.Purrr, ['stop_bad_type', 'stop_bad_element_type', 'stop_bad_element_length'])
		],
		processor:       BuiltInProcName.Default,
		config:          { useAsProcessor: BuiltInProcName.Stop, cfg: ExitPointType.Error, forceArgs: 'all', props: CallProp.Throws },
		assumePrimitive: false
	},
	{ type:            'function', names:           [Identifier.from(['try', PkgName.Base])],
		processor:       BuiltInProcName.Try, config:          { block: 'expr', handlers: {} }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['tryCatch', PkgName.Base]), Identifier.from(['tryCatchLog', PkgName.TryCatchLog])],
		processor:       BuiltInProcName.Try, config:          { block: 'expr', handlers: { error: 'error', finally: 'finally' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['stopifnot', PkgName.Base]), Identifier.from(['assert_that', PkgName.AssertThat])],
		processor:       BuiltInProcName.StopIfNot, config:          { props: CallProp.Invisible | CallProp.Throws }, assumePrimitive: false },
	{ type:            'function', names:           ['break'],
		processor:       BuiltInProcName.Default, config:          { useAsProcessor: BuiltInProcName.Break, cfg: ExitPointType.Break }, assumePrimitive: false },
	{ type:            'function', names:           ['next'],
		processor:       BuiltInProcName.Default, config:          { cfg: ExitPointType.Next }, assumePrimitive: false },
	{ type:            'function', names:           ['{'],
		processor:       BuiltInProcName.ExpressionList, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['source', PkgName.Base])],
		/* it hands back what it evaluated invisibly, so a top-level `source()` prints nothing of its own */
		processor:       BuiltInProcName.Source, config:          { includeFunctionCall: true, forceFollow: false, props: CallProp.Invisible }, assumePrimitive: false },
	{ type:            'function', names:           ['['],
		processor:       BuiltInProcName.Access, config:          { treatIndicesAsString: false, props: CallProp.Pure }, assumePrimitive: true },
	{ type:            'function', names:           ['[['],
		processor:       BuiltInProcName.Access, config:          { treatIndicesAsString: false, resolveField: true, props: CallProp.Pure }, assumePrimitive: true },
	{ type:            'function', names:           ['$', '@'],
		processor:       BuiltInProcName.Access, config:          { treatIndicesAsString: true, resolveField: true, props: CallProp.Pure }, assumePrimitive: true },
	{ type:            'function', names:           ['::'],
		processor:       BuiltInProcName.NamespaceAccess, config:          { internal: false }, assumePrimitive: true },
	{ type:            'function', names:           [':::'],
		processor:       BuiltInProcName.NamespaceAccess, config:          { internal: true }, assumePrimitive: true },
	{ type:            'function', names:           ['if'],
		processor:       BuiltInProcName.IfThenElse, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['ifelse', PkgName.Base]), Identifier.from(['fifelse', PkgName.DataTable]), 'IfElse'],
		processor:       BuiltInProcName.IfThenElse, config:          { args: { cond: 'test', yes: 'yes', no: 'no' }, props: CallProp.Pure }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['if_else', PkgName.Dplyr])],
		processor:       BuiltInProcName.IfThenElse, config:          { args: { cond: 'condition', yes: 'true', no: 'false' }, props: CallProp.Pure }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['get', PkgName.Base])],
		processor:       BuiltInProcName.Get, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['pos', ArgProp.Flag], ['envir', ArgProp.Value], ['mode', ArgProp.Flag], ['inherits', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['library', 'require']),
		processor:       BuiltInProcName.Library, config:          { props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['attachNamespace', PkgName.Base])],
		processor:       BuiltInProcName.Library, config:          { characterOnly: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['requireNamespace', 'loadNamespace']),
		processor:       BuiltInProcName.Library, config:          { namespaceOnly: true, characterOnly: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['from', PkgName.Import])],
		processor:       BuiltInProcName.Library, config:          { fromImports: true, props: CallProp.Scope }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['use', PkgName.Box]), Identifier.from(['use', PkgName.Base])],
		processor:       BuiltInProcName.Library, config:          { boxUse: true, props: CallProp.Scope }, assumePrimitive: false },
	{ type:            'function', names:           ['<-', '='],
		processor:       BuiltInProcName.Assignment, config:          { canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from([':=', PkgName.DataTable])],
		processor:       BuiltInProcName.Assignment, config:          { props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['assign', PkgName.Base])],
		processor:       BuiltInProcName.Assignment, config:          { targetVariable: true, mayHaveMoreArgs: true, environmentArg: 'envir', props: CallProp.Scope | CallProp.Invisible, sig: [['x', ArgProp.Value], ['value', ArgProp.Value], ['pos', ArgProp.Flag], ['envir', ArgProp.Written], ['inherits', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['setValidity', PkgName.Methods])],
		processor:       BuiltInProcName.Assignment, config:          { targetVariable: true, mayHaveMoreArgs: true, environmentArg: 'envir', props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['setMethod', PkgName.Methods])],
		processor:       BuiltInProcName.AssignmentLike,
		config:          { targetVariable: true, canBeReplacement: false, target: { idx: 0, name: 'f' }, source: { idx: 2, name: 'definition' }, modesForFn: ['s4'] },
		assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['delayedAssign', PkgName.Base])],
		processor:       BuiltInProcName.Assignment, config:          { quoteSource: true, targetVariable: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true },
	{ type:            'function', names:           ['<<-'],
		processor:       BuiltInProcName.Assignment, config:          { superAssignment: true, canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type:            'function', names:           ['->'],
		processor:       BuiltInProcName.Assignment, config:          { swapSourceAndTarget: true, canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type:            'function', names:           ['->>'],
		processor:       BuiltInProcName.Assignment, config:          { superAssignment: true, swapSourceAndTarget: true, canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['data', PkgName.Utils]), Identifier.from(['getHdata', PkgName.Hmisc])],
		processor:       BuiltInProcName.DefineArgument, config:          { superAssignment: true }, assumePrimitive: false },
	/* only `&&`/`||` short-circuit */
	{ type:            'function', names:           [Identifier.from(['&&', PkgName.Base])],
		processor:       BuiltInProcName.SpecialBinOp, config:          { lazy: true, evalRhsWhen: true, props: CallProp.Pure }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Logical },
	{ type:            'function', names:           [Identifier.from(['||', PkgName.Base])],
		processor:       BuiltInProcName.SpecialBinOp, config:          { lazy: true, evalRhsWhen: false, props: CallProp.Pure }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Logical },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['&', '|']),
		processor:       BuiltInProcName.SpecialBinOp, config:          { lazy: false, props: CallProp.Pure }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Logical },
	/* a pipe hands back what the side it feeds hands back, which `Alias` is what states */
	{ type:            'function', names:           ['|>'],
		processor:       BuiltInProcName.Pipe, config:          { pipePlaceholderName: '_', assignLhs: false, returnLhs: false, sig: [['lhs', ArgProp.Value], ['rhs', ArgProp.Alias]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['%>%', PkgName.Magrittr]), '%!>%'], processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: false, returnLhs: false, rhsMightBeSymbol: true, sig: [['lhs', ArgProp.Value], ['rhs', ArgProp.Alias]] }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['%<>%', PkgName.Magrittr])],        processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: true, returnLhs: false, rhsMightBeSymbol: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['%T>%', PkgName.Magrittr])],        processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: false, returnLhs: true, rhsMightBeSymbol: true, sig: [['lhs', ArgProp.Alias], ['rhs', ArgProp.Value]] }, assumePrimitive: true  },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['map', 'map_lgl', 'map_int', 'map_dbl', 'map_chr']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['pmap', 'pmap_lgl', 'pmap_int', 'pmap_dbl', 'pmap_chr']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.l': { index: 0, name: '.l' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['map2', 'map2_lgl', 'map2_int', 'map2_dbl', 'map2_chr']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' },
			'.y': { index: 1, name: '.y' },
		},
		'.f':   { index: 2, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['modify', 'imodify', 'imap', 'imap_lgl', 'imap_int', 'imap_dbl', 'imap_chr', 'imap_vec', 'lmap']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: []
	} },
	{ type:      'function', names:     [Identifier.from(['modify2', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' },
			'.y': { index: 1, name: '.y' }
		},
		'.f':   { index: 2, name: '.f' },
		ignore: []
	} },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['map_at', 'modify_at']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x':  { index: 0, name: '.x' },
			'.at': { index: 1, name: '.at' },
		},
		'.f':   { index: 2, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     [Identifier.from(['lmap_at', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x':  { index: 0, name: '.x' },
			'.at': { index: 1, name: '.at' },
		},
		'.f':   { index: 2, name: '.f' },
		ignore: []
	} },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['map_if', 'modify_if', 'lmap_if']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' },
			'.p': { index: 1, name: '.p' },
		},
		'.f':   { index: 2, name: '.f' },
		ignore: ['.else']
	} },
	{ type:      'function', names:     [Identifier.from(['walk', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' }
		},
		'.f':      { index: 1, name: '.f' },
		ignore:    ['.progress'],
		returnArg: '.x'
	} },
	{ type:      'function', names:     [Identifier.from(['iwalk', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' }
		},
		'.f':      { index: 1, name: '.f' },
		ignore:    [],
		returnArg: '.x'
	} },
	{ type:      'function', names:     [Identifier.from(['pwalk', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.l': { index: 0, name: '.l' }
		},
		'.f':      { index: 1, name: '.f' },
		ignore:    ['.progress'],
		returnArg: '.l'
	} },
	{ type:      'function', names:     [Identifier.from(['walk2', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' },
			'.y': { index: 1, name: '.y' }
		},
		'.f':      { index: 2, name: '.f' },
		ignore:    ['.progress'],
		returnArg: '.x'
	} },
	{ type:      'function', names:     [Identifier.from(['map_vec', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: ['.progress', '.ptype']
	} },
	{ type:      'function', names:     [Identifier.from(['pmap_vec', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.l': { index: 0, name: '.l' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: ['.progress', '.ptype']
	} },
	{ type:      'function', names:     Identifier.fromAll(PkgName.Purrr, ['map_depth', 'modify_depth']), processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x':     { index: 0, name: '.x' },
			'.depth': { index: 2, name: '.depth' }
		},
		'.f':   { index: 2, name: '.f' },
		ignore: ['.ragged', '.is_node']
	} },
	{ type:      'function', names:     [Identifier.from(['map2_vec', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' },
			'.y': { index: 1, name: '.y' }
		},
		'.f':   { index: 2, name: '.f' },
		ignore: ['.progress', '.ptype']
	} },
	{ type:      'function', names:     [Identifier.from(['across', PkgName.Dplyr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.cols' },
		},
		'.f':   { index: 1, name: '.fns' },
		ignore: ['.names', '.unpack']
	} },
	{ type:      'function', names:     [Identifier.from(['rename_with', PkgName.Dplyr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.data' },
		},
		'.f':   { index: 1, name: '.fn' },
		ignore: ['.cols']
	} },
	{ type:            'function', names:           ['function', '\\'],
		processor:       BuiltInProcName.FunctionDefinition, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['quote', PkgName.Base])],
		processor:       BuiltInProcName.Quote, config:          { quoteArgumentsWithIndex: 0, keepEnvironment: true, tags: [SemanticProp.Lang], sig: [['expr', ArgProp.Nse]] }, assumePrimitive: true },
	/* `bquote` evaluates the operand of `.()` */
	{ type:            'function', names:           [Identifier.from(['bquote', PkgName.Base])],
		processor:       BuiltInProcName.Quote, config:          { quoteArgumentsWithIndex: 0, unquote: Unquote.Bquote, keepEnvironment: true, tags: [SemanticProp.Lang], sig: [['expr', ArgProp.Nse]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['substitute', PkgName.Base])],
		processor:       BuiltInProcName.Quote, config:          { quoteArgumentsWithIndex: 0, envArgIndex: 1, keepEnvironment: true, tags: [SemanticProp.Lang], sig: [['expr', ArgProp.Nse], ['env', ArgProp.Value]] }, assumePrimitive: true },
	/* the rlang functions that capture unevaluated, the rest take a value */
	{ type: 'function', names: Identifier.fromAll(PkgName.Rlang, ['quo', 'quos', 'expr', 'exprs']), processor: BuiltInProcName.Quote, config: { quoteArgumentsWithIndex: 0, unquote: Unquote.Rlang, keepEnvironment: true, libFn: true, tags: [SemanticProp.Lang] }, assumePrimitive: true  },
	{ type:            'function', names:           [Identifier.from(['exec', PkgName.Rlang])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: '.fn', unquoteFunction: true, hasUnknownSideEffects: true, libFn: true, props: CallProp.MayPure, sig: [['.fn', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Purrr, ['invoke', 'invoke_map']),
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: '.f', unquoteFunction: true, hasUnknownSideEffects: true, libFn: true, props: CallProp.MayPure | CallProp.Deprecated, sig: [['.f', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	/* the `{...}` of a template holds R code, evaluated where the call is; `cli_abort` stays with the other
	 * error exits, as terminating a branch matters more than interpolating its message */
	{ type:            'function', names:           [...Identifier.fromAll(PkgName.Glue, ['glue', 'glue_safe', 'glue_collapse']), Identifier.from(['str_glue', PkgName.Stringr])],
		processor:       BuiltInProcName.StringTemplate, config:          { props: CallProp.MayPure }, assumePrimitive: false },
	{ type:  'function', names: Identifier.fromAll(PkgName.Cli, ['cli_text', 'cli_alert', 'cli_alert_info', 'cli_alert_success',
		'cli_alert_warning', 'cli_alert_danger', 'cli_h1', 'cli_h2', 'cli_h3', 'cli_li', 'cli_bullets', 'cli_inform', 'cli_warn',
		'format_inline', 'cli_verbatim']),
	processor: BuiltInProcName.StringTemplate, config: { markup: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['str_interp', PkgName.Stringr])],
		processor:       BuiltInProcName.StringTemplate, config:          { open: '${', props: CallProp.MayPure | CallProp.Deprecated }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['local', PkgName.Base])],
		processor:       BuiltInProcName.Local, config:          { args: { env: 'envir', expr: 'expr' } }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['with', 'within']),
		processor:       BuiltInProcName.With, config:          {}, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['new.env', PkgName.Base]), Identifier.from(['new_environment', PkgName.Rlang])],
		processor:       BuiltInProcName.NewEnv, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['R6Class', PkgName.R6]), Identifier.from(['setRefClass', PkgName.Methods])],
		processor:       BuiltInProcName.ClassGenerator, config:          {}, assumePrimitive: false },
	/* env-returning builtins pointing into the current search-path stack (`e <- globalenv(); e$x`) */
	{ type:  'function', names: Object.entries(StackEnvBuiltins)
		.filter(([n, kind]) => !n.startsWith('.') && (kind === StackEnvKind.Global || kind === StackEnvKind.Base || kind === StackEnvKind.Empty))
		.map(([n]) => Identifier.from([n, PkgName.Base])),
	processor: BuiltInProcName.StackEnv, config: {}, assumePrimitive: true },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['parent.env', 'parent.frame', 'environmentName', 'as.environment', 'pos.to.env', 'sys.frame', 'sys.frames', 'topenv']), processor: BuiltInProcName.Default, config: {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['load', PkgName.Base])],
		processor:       BuiltInProcName.Load,
		config:          { props: CallProp.Invisible | CallProp.Scope, tags: [SemanticProp.File, SemanticProp.Reads], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	/* attach injects an environment's contents into the search path; detach reverses it (treated as unknown side effect) */
	{ type:            'function', names:           [Identifier.from(['attach', PkgName.Base])],
		processor:       BuiltInProcName.Attach, config:          {}, assumePrimitive: false },
	{ type: 'function', names: ['for'],    processor: BuiltInProcName.ForLoop,    config: {}, assumePrimitive: true },
	{ type: 'function', names: ['repeat'], processor: BuiltInProcName.RepeatLoop, config: {}, assumePrimitive: true },
	{ type: 'function', names: ['while'],  processor: BuiltInProcName.WhileLoop,  config: {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['do.call', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, unquoteFunction: true, props: CallProp.MayPure, sig: [['what', ArgProp.Callee], ['args', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['UseMethod', PkgName.Base])],
		processor:       BuiltInProcName.S3Dispatch, config:          { args: { generic: 'generic', object: 'object' }, props: CallProp.Generic }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['NextMethod', PkgName.Base])],
		processor:       BuiltInProcName.S3Dispatch, config:          { args: { generic: 'generic', object: 'object' }, inferFromClosure: true, props: CallProp.Generic }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['new_generic', PkgName.S7])],
		processor:       BuiltInProcName.S7NewGeneric, config:          { args: { name: 'name', dispatchArg: 'dispatch_args', fun: 'fun' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['setGeneric', PkgName.Methods])],
		processor:       BuiltInProcName.S7NewGeneric, config:          { args: { name: 'name', dispatchArg: undefined, fun: 'fun' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['S7_dispatch', PkgName.S7])],
		processor:       BuiltInProcName.S7Dispatch, config:          { libFn: true }, assumePrimitive: true },
	{ type:  'function', names: [
		Identifier.from(['make_constructor', PkgName.GgPlot2]),
		Identifier.from(['new_class', PkgName.S7])
	], processor: BuiltInProcName.S7MakeConstructor, config: { mode: ['s7'] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['setClass', PkgName.Methods])],
		processor:       BuiltInProcName.S7MakeConstructor, config:          { mode: ['s4'] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['Negate', PkgName.Base])],    processor: BuiltInProcName.S7MakeConstructor, config: { wrapIndex: 0, props: CallProp.Pure, sig: [['f', ArgProp.Callee]] },   assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['Vectorize', PkgName.Base])], processor: BuiltInProcName.S7MakeConstructor, config: { wrapIndex: 0, props: CallProp.Pure, sig: [['FUN', ArgProp.Callee]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['partial', PkgName.Purrr])],
		processor:       BuiltInProcName.S7MakeConstructor, config:          { wrapIndex: 0, wrapName: '.f' }, assumePrimitive: true },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['.Primitive', '.Internal']),
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['interference', PkgName.Inferference])],
		processor:       BuiltInProcName.Apply, config:          { unquoteFunction: true, nameOfFunctionArgument: 'propensity_integrand', libFn: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['ddply', PkgName.Plyr])],
		processor:       BuiltInProcName.Apply, config:          { unquoteFunction: true, indexOfFunction: 2, nameOfFunctionArgument: '.fun', libFn: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['list', PkgName.Base])],
		processor:       BuiltInProcName.List, config:          { props: CallProp.Pure, sig: [['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['Recall', PkgName.Base])],
		processor:       BuiltInProcName.Recall, config:          { libFn: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['sys.function', PkgName.Base])],
		processor:       BuiltInProcName.Recall, config:          { libFn: true, unknownOnNonZeroArg: true, tags: [SemanticProp.Lang] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['c', PkgName.Base])],
		processor:       BuiltInProcName.Vector, config:          { props: CallProp.Pure, sig: [['...', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.Vector },
	{ type: 'function', names: [Identifier.from(['cmpfun', PkgName.Compiler])], processor: BuiltInProcName.Default, config: { sig: [['f', ArgProp.Alias]] } },
	{ type: 'function', names: [Identifier.from(['compile', PkgName.Compiler])], processor: BuiltInProcName.Default, config: { sig: [['e', ArgProp.Alias]] } },
	{ type: 'function', names: [Identifier.from(['loadcmp', PkgName.Compiler])],                                                processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true } },
	{
		type:  'function',
		names: [
			Identifier.from(['setnames', PkgName.DataTable]), Identifier.from(['setNames', PkgName.Base]),
			...Identifier.fromAll(PkgName.DataTable, ['setkey', 'setkeyv', 'setindex', 'setindexv', 'setattr'])
		],
		processor: BuiltInProcName.Assignment,
		config:    {
			canBeReplacement: false,
			targetVariable:   false,
			makeMaybe:        true,
			mayHaveMoreArgs:  true
		}
	},
	{
		type:  'function',
		names: [
			Identifier.from(['sys.on.exit', PkgName.Base]),
			/* library/require/(require|load|attach)Namespace/use are handled above */
			Identifier.from(['asNamespace', PkgName.Base]),
			Identifier.from(['unname', PkgName.Base]),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true },
		assumePrimitive: false
	},
	/* they create, move, or delete files */
	{
		type:  'function',
		names: [
			Identifier.from(['dir.create', PkgName.Base]), Identifier.from(['dir_create', PkgName.Fs]),
			...Identifier.fromAll(PkgName.Base, ['Sys.chmod', 'unlink', 'file.remove', 'file.rename', 'file.copy', 'file.link', 'file.append', 'Sys.junction']),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true, tags: [SemanticProp.File, SemanticProp.Writes] },
		assumePrimitive: false
	},
	/* `sink` diverts the output, `par`/`tpar` set the parameters of the current device */
	{ type:            'function', names:           [Identifier.from(['sink', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['par', PkgName.Graphics]), Identifier.from(['tpar', PkgName.TinyPlot])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, tags: [SemanticProp.Graphics] }, assumePrimitive: false },
	{
		type:  'function',
		names: [
			Identifier.from(['tinytheme', PkgName.TinyPlot]), Identifier.from(['theme_set', PkgName.GgPlot2]),
			Identifier.from(['context', PkgName.Testthat]),  Identifier.from(['library.dynam', PkgName.Base]),
			/* installs from a path that is already there */
			Identifier.from(['install_local', PkgName.Remotes]), Identifier.from(['install_local', PkgName.Devtools]),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true, libFn: true },
		assumePrimitive: false
	},
	/* installers fetch the package and put it into the library (devtools re-exports the entire remotes install API) */
	{
		type:  'function',
		names: [
			Identifier.from(['install.packages', PkgName.Utils]), Identifier.from(['install', PkgName.Devtools]),
			...['install_github', 'install_gitlab', 'install_bitbucket', 'install_url', 'install_git', 'install_svn', 'install_version', 'update_packages']
				.flatMap(f => [Identifier.from([f, PkgName.Remotes]), Identifier.from([f, PkgName.Devtools])]),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true, libFn: true, props: CallProp.Invisible, tags: [SemanticProp.Network, SemanticProp.File, SemanticProp.Writes] },
		assumePrimitive: false
	},
	{
		type:      'function',
		names:     [Identifier.from(['on.exit', PkgName.Base])],
		processor: BuiltInProcName.RegisterHook,
		config:    {
			hook: KnownHooks.OnFnExit,
			args: {
				expr:  { idx: 0, name: 'expr' },
				add:   { idx: 1, name: 'add', default: false },
				after: { idx: 2, name: 'after', default: true },
			}
		},
		assumePrimitive: true
	},
	{ type:            'function', names:           [Identifier.from(['on_load', PkgName.Rlang])],
		processor:       BuiltInProcName.Default,
		config:          { libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: [['expr', ArgProp.Forced], ['env', ArgProp.Value], ['ns', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['on_package_load', PkgName.Rlang])],
		processor:       BuiltInProcName.Default,
		config:          { libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: [['pkg', ArgProp.Value], ['expr', ArgProp.Forced], ['env', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['run_on_load', PkgName.Rlang])],
		processor:       BuiltInProcName.Default,
		config:          { libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: [['ns', ArgProp.Value]] }, assumePrimitive: false },
	/* `parse(text=)` turns text into an expression, with `file=` it reads that file */
	{ type:            'function', names:           [Identifier.from(['parse', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', props: CallProp.Pure }, assumePrimitive: false },
	/* they answer with whatever is on disk when they run */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['list.files', 'dir', 'list.dirs']),
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', props: CallProp.Glob, tags: [SemanticProp.File, SemanticProp.Reads], sig: [['path', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['Sys.glob', PkgName.Base])],
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', props: CallProp.Glob, tags: [SemanticProp.File, SemanticProp.Reads], sig: [['paths', ArgProp.Resource]] }, assumePrimitive: false },
	/* language objects */
	{
		type:  'function',
		names: Identifier.fromAll(PkgName.Base, ['enquote', 'call', 'as.call', 'as.expression', 'as.name', 'as.symbol',
			'as.language', 'match.call', 'sys.call', 'args', 'deparse', 'deparse1']),
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', tags: [SemanticProp.Lang] },
		assumePrimitive: false
	},
	/* `alist` keeps its arguments unevaluated, `evalq` evaluates its first one in another frame */
	{ type:            'function', names:           [Identifier.from(['alist', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { tags: [SemanticProp.Lang], sig: [['...', ArgProp.Nse]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['evalq', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { tags: [SemanticProp.Lang], sig: [['expr', ArgProp.Nse], ['envir', ArgProp.Value]] }, assumePrimitive: false },
	{
		type:  'function',
		names: Identifier.fromAll(PkgName.Rlang, ['enexpr', 'enexprs', 'inject', 'enquo', 'enquos', 'enquo0', 'enquos0',
			'ensym', 'ensyms', 'new_formula',
			'f_rhs', 'f_lhs', 'fn_body', 'fn_fmls', 'fn_fmls_names', 'call2', 'sym', 'syms', 'quo_name', 'as_name',
			'as_label', 'as_string']),
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, tags: [SemanticProp.Lang] },
		assumePrimitive: false
	},
	/* native code */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['dyn.load', 'getNativeSymbolInfo']),
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', tags: [SemanticProp.Ffi] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['sourceCpp', PkgName.Rcpp])],
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, tags: [SemanticProp.Ffi, SemanticProp.File, SemanticProp.Reads], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	/* ambient state: options, environment variables, the clock, the session itself */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['getOption', 'Sys.getenv', 'Sys.info', 'Sys.getpid', 'getwd', 'getRversion', 'R.Version', 'Sys.time', 'Sys.Date', 'Sys.timezone', 'date', 'proc.time', 'interactive']),
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', props: CallProp.Ambient }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['commandArgs', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', props: CallProp.Ambient | CallProp.CommandLine }, assumePrimitive: false },
	/* system commands */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['system', 'system2', 'shell', 'shell.exec']),
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', tags: [SemanticProp.Process] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['pipe', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', props: CallProp.Opens, tags: [SemanticProp.Process], sig: [['description', ArgProp.Resource]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['runjs', PkgName.ShinyJs])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', libFn: true, tags: [SemanticProp.Process] }, assumePrimitive: false },
	/* whatever the user types, picks, or sends along with a request */
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Base, ['readline', 'file.choose']),
			...Identifier.fromAll(PkgName.Utils, ['askYesNo', 'choose.files', 'choose.dir', 'menu', 'select.list', 'winDialogString', 'winDialog']),
		],
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', tags: [SemanticProp.User] },
		assumePrimitive: false
	},
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.RstudioApi, ['showPrompt', 'askForPassword', 'selectDirectory', 'selectFile', 'showQuestion']),
			...Identifier.fromAll(PkgName.SvDialogs, ['dlgInput', 'dlgOpen', 'dlgList', 'dlgSave', 'dlgDir']),
			...Identifier.fromAll(PkgName.Tcltk, ['tk_choose.files', 'tk_choose.dir']),
			...Identifier.fromAll(PkgName.Shiny, ['parseQueryString', 'getQueryString', 'getUrlHash', 'restoreInput']),
			...Identifier.fromAll(PkgName.ShinyFiles, ['parseFilePaths', 'parseDirPath', 'parseSavePath', 'shinyFileChoose', 'shinyDirChoose', 'shinyFileSave']),
			/* what comes out of a cohort depends on the filters the user set, and on the gui that sets them */
			...Identifier.fromAll(PkgName.CohortBuilder, ['get_data', 'sum_up', 'attrition', 'get_state', 'code', 'stat']),
			...Identifier.fromAll(PkgName.ShinyCohortBuilder, ['cb_server', 'cb_ui', 'cb_chat_server', 'cb_chat_ui', 'gui', 'demo_app']),
		],
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, tags: [SemanticProp.User] },
		assumePrimitive: false
	},
	/* they only make up a path, they do not go near the file system, so `File` would be wrong here */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['tempfile', 'tempdir']),
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', tags: [SemanticProp.TempFile] }, assumePrimitive: false },
	{
		type:  'function',
		names: [
			...Identifier.fromAll(PkgName.Fs, ['file_temp', 'dir_temp']),
			...Identifier.fromAll(PkgName.Withr, ['local_tempfile', 'with_tempfile', 'local_tempdir', 'with_tempdir']),
		],
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, tags: [SemanticProp.TempFile] },
		assumePrimitive: false
	},
	/* wrappers that run the expression they are handed; `observe`/`render*` are left out, they yield a handle instead */
	{
		type:  'function',
		names: Identifier.fromAll(PkgName.Shiny, ['reactive', 'eventReactive', 'bindEvent', 'bindCache', 'isolate', 'req',
			'debounce', 'throttle', 'reactiveVal', 'reactiveValues', 'reactiveValuesToList', 'freezeReactiveVal']),
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, props: CallProp.MayPure },
		assumePrimitive: false
	},
	/* assembling a cohort keeps the data of its source; `filter` is registered above, dplyr holds that name */
	{
		type:  'function',
		names: Identifier.fromAll(PkgName.CohortBuilder, ['cohort', 'set_source', 'add_source', 'update_source', 'add_filter',
			'update_filter', 'rm_filter', 'bind_key', 'bind_keys', 'as.tblist', 'tblist',
			'step', 'add_step', 'rm_step', 'run', 'restore']),
		processor:       BuiltInProcName.Default,
		config:          { forceArgs: 'all', libFn: true, props: CallProp.Pure },
		assumePrimitive: false
	},
	/* they are all mapped to `<-` but we separate super assignments */
	{
		type:     'replacement',
		suffixes: ['<-', '<<-'],
		names:    [
			'[', '[[',
			...Identifier.fromAll(PkgName.Base, ['names', 'dimnames', 'attributes', 'attr', 'class', 'levels', 'rownames', 'colnames', 'body', 'environment', 'formals', 'length', 'dim']),
		],
		config: { readIndices: true, props: CallProp.Scope }
	},
	{
		type:     'replacement',
		suffixes: ['<-', '<<-'],
		names:    [Identifier.from(['method', PkgName.S7])],
		config:   { readIndices: true, constructName: 's7' }
	},
	{
		type:     'replacement',
		suffixes: ['<-', '<<-'],
		names:    ['$', '@'],
		config:   { readIndices: false, props: CallProp.Scope }
	},
	/* the string and shape functions R declares formals for, restated one by one: the group above gives them
	   what they do, this gives them the arguments they do it with (the names are R's own) */
	{ type:            'function', names:           [Identifier.from(['sprintf', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['fmt', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['format', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: SigXDots }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['grep', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['pattern', ArgProp.Value], ['x', ArgProp.Value], ['ignore.case', ArgProp.Flag], ['perl', ArgProp.Flag], ['value', ArgProp.Flag], ['fixed', ArgProp.Flag], ['useBytes', ArgProp.Flag], ['invert', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['sub', 'gsub']),
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['pattern', ArgProp.Value], ['replacement', ArgProp.Value], ['x', ArgProp.Value], ['ignore.case', ArgProp.Flag], ['perl', ArgProp.Flag], ['fixed', ArgProp.Flag], ['useBytes', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['substr', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['start', ArgProp.Value], ['stop', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['substring', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['text', ArgProp.Value], ['first', ArgProp.Value], ['last', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['strsplit', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['split', ArgProp.Value], ['fixed', ArgProp.Flag], ['perl', ArgProp.Flag], ['useBytes', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['trimws', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['which', ArgProp.Flag], ['whitespace', ArgProp.Value]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	{ type:            'function', names:           [Identifier.from(['strtoi', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['base', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['matrix', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { props: CallProp.Pure, sig: [['data', ArgProp.Value], ['nrow', ArgProp.Value], ['ncol', ArgProp.Value], ['byrow', ArgProp.Flag], ['dimnames', ArgProp.Value]] }, assumePrimitive: true },

	/* the tidyverse verbs, under the names R declares them with. They keep the data mask the group above
	   gives them; what this adds is which argument is the data and what the further ones are called */
	{ type:            'function', names:           Identifier.fromAll(PkgName.Dplyr, ['mutate', 'select', 'rename']),
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: SigDataDots }, assumePrimitive: false },
	/* `transmute` is one of them and deprecated on top of it */
	{ type:            'function', names:           [Identifier.from(['transmute', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure | CallProp.Deprecated, sig: SigDataDots }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['filter', PkgName.Dplyr]), Identifier.from(['slice', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [...SigDataDots, ['.by', ArgProp.Value], ['.preserve', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Dplyr, ['summarise', 'summarize']),
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [...SigDataDots, ['.by', ArgProp.Value], ['.groups', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['arrange', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [...SigDataDots, ['.by_group', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['group_by', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [...SigDataDots, ['.add', ArgProp.Flag], ['.drop', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['distinct', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [...SigDataDots, ['.keep_all', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['relocate', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [...SigDataDots, ['.before', ArgProp.Value], ['.after', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['count', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [['x', ArgProp.Value], ['...', ArgProp.Value], ['wt', ArgProp.Value], ['sort', ArgProp.Flag], ['name', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['pull', PkgName.Dplyr])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [['.data', ArgProp.Value], ['var', ArgProp.Value], ['name', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['nest', PkgName.TidyR])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: SigDataDots }, assumePrimitive: false },
	/* `drop_na` names its first argument `data`, not `.data`, so it gets a line of its own */
	{ type:            'function', names:           [Identifier.from(['drop_na', PkgName.TidyR])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['data', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['pivot_longer', PkgName.TidyR])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [['data', ArgProp.Value], ['cols', ArgProp.Value], ['...', ArgProp.Value], ['names_to', ArgProp.Value], ['values_to', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['pivot_wider', PkgName.TidyR])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [['data', ArgProp.Value], ['...', ArgProp.Value], ['names_from', ArgProp.Value], ['values_from', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['separate', PkgName.TidyR])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure | CallProp.Deprecated,
			sig:              [['data', ArgProp.Value], ['col', ArgProp.Value], ['into', ArgProp.Value], ['sep', ArgProp.Value], ['remove', ArgProp.Flag], ['convert', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['unite', PkgName.TidyR])],
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props:            CallProp.Pure,
			sig:              [['data', ArgProp.Value], ['col', ArgProp.Value], ['...', ArgProp.Value], ['sep', ArgProp.Value], ['remove', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['subset', 'transform']),
		processor:       BuiltInProcName.Default,
		config:          { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['x', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },

	/* these share the `f(x, ...)` shape above, but R puts one more formal before the `...`: leaving it out
	   would shift every position after it, so each names its own */
	{ type:            'function', names:           [Identifier.from(['sort', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['decreasing', ArgProp.Flag], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           Identifier.fromAll(PkgName.Base, ['unique', 'duplicated']),
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['incomparables', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['as.data.frame', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['row.names', ArgProp.Value], ['optional', ArgProp.Flag], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['median', PkgName.Stats])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['na.rm', ArgProp.Flag], ['...', ArgProp.Value]] }, assumePrimitive: true },
	/* the ones the earlier list left short where a reader would notice */
	{ type:            'function', names:           [Identifier.from(['nchar', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['x', ArgProp.Shape], ['type', ArgProp.Value], ['allowNA', ArgProp.Flag], ['keepNA', ArgProp.Flag]] }, assumePrimitive: true, evalHandler:     BuiltInEvalName.StringFn },
	{ type:            'function', names:           [Identifier.from(['grepl', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: [['pattern', ArgProp.Value], ['x', ArgProp.Value], ['ignore.case', ArgProp.Flag], ['perl', ArgProp.Flag], ['fixed', ArgProp.Flag], ['useBytes', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['match', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['table', ArgProp.Value], ['nomatch', ArgProp.Value], ['incomparables', ArgProp.Value]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['lengths', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Pure, tags: [SemanticProp.Narrows], sig: [['x', ArgProp.Shape], ['use.names', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['readLines', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.File, SemanticProp.Reads], sig: [['con', ArgProp.Resource], ['n', ArgProp.Value], ['ok', ArgProp.Flag], ['warn', ArgProp.Flag], ['encoding', ArgProp.Value], ['skipNul', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['writeLines', PkgName.Base])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['text', ArgProp.Value], ['con', ArgProp.Resource], ['sep', ArgProp.Value], ['useBytes', ArgProp.Flag]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['write.table', PkgName.Utils])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { props: CallProp.Invisible, tags: [SemanticProp.File, SemanticProp.Writes], sig: [['x', ArgProp.Value], ['file', ArgProp.Resource], ['append', ArgProp.Flag], ['quote', ArgProp.Flag], ['sep', ArgProp.Value]] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['download.file', PkgName.Utils])],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          { tags: [SemanticProp.Network, SemanticProp.File, SemanticProp.Writes], sig: [['url', ArgProp.Resource], ['destfile', ArgProp.Resource], ['method', ArgProp.Value], ['quiet', ArgProp.Flag], ['mode', ArgProp.Value], ['cacheOK', ArgProp.Flag], ['extra', ArgProp.Value], ['headers', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },
	/** Deprecated Functions */
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.Dplyr, ['id', 'top_n', 'sample_n', 'recode', 'progress_estimated', 'group_nest', 'add_rownames', 'tbl_df', 'src_local', 'summarise_each', 'summarize_', 'summarise_', 'slice_', 'select_vars_', 'select_', 'rename_vars_', 'rename_', 'transmute_', 'tally_', 'mutate_', 'group_indices_', 'group_by_', 'funs_', 'filter_', 'do_', 'distinct_', 'count_', 'arrange_', 'add_tally_', 'add_count_', 'funs', 'do', 'combine', 'changes', 'location', 'eval_tbls2', 'eval_tbls', 'compare_tbls2', 'compare_tbls', 'bench_tbls', 'current_vars', 'select_var', 'rename_vars', 'select_vars', 'failwith', 'all_vars', 'vars', 'select_all', 'mutate_all', 'summarise_all', 'group_by_all', 'filter_all', 'all_equal', 'arrange_all', 'distinct_all'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: [ Identifier.make('fct_explicit_na', PkgName.Forecats) ]  },
	/* deprecated, but still data-masking: restating the mask keeps the column names out of the variable resolution */
	{ type:      'function', processor: BuiltInProcName.Default, config:    { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure | CallProp.Deprecated },
		names:     [...Identifier.fromAll(PkgName.Dplyr, ['nest_by', 'with_groups', 'group_split']), ...Identifier.fromAll(PkgName.TidyR, ['spread', 'separate_rows', 'gather', 'extract'])]  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.GgPlot2, ['gg_dep', 'is.theme', 'is.ggplot', 'guide_train', 'is.ggproto', 'fortify', 'is.facet', 'coord_map', 'coord_flip', 'is.Coord', 'annotation_logticks', 'aes_auto', 'aes_'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.Plyr, ['liply', 'isplit2'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.Purrr, ['transpose', 'as_vector', 'map_dfr', 'flatten', 'reduce_right', 'accumulate', 'map_raw', 'update_list', 'when', 'rdunif', 'rbernoulli', 'splice', 'rerun', 'prepend', 'at_depth', 'cross', 'list_along' ])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: [ '`%@%`' ]  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.Readr, ['read_table2', 'melt_table', 'melt_fwf', 'melt_delim'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.Tibble, ['repair_names', 'set_tidy_names', 'tidy_names', 'is.tibble', 'trunc_mat', 'frame_data', 'as.tibble', 'as_data_frame', 'lst_', 'data_frame_', 'tibble_', 'data_frame', 'as_tibble' ])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Deprecated }, names: Identifier.fromAll(PkgName.TidyR, ['nest_legacy', 'unnest_', 'unite_', 'spread_', 'separate_', 'separate_rows_', 'nest_', 'gather_', 'fill_', 'extract_', 'nesting_', 'crossing_', 'expand_', 'drop_na_', 'complete_', 'extract_numeric' ])  },
] as const satisfies AnyBuiltInDefinition[];

/**
 * Contains the built-in definitions recognized by flowR
 */
export const DefaultBuiltinConfig = markGenerics(WrittenBuiltinDefinitions);


/**
 * Expensive and naive lookup of the default processor for a built-in function name
 */
export function getDefaultProcessor(name: string): BuiltInProcName | undefined {
	if(name.startsWith(UnnamedFunctionCallPrefix)) {
		return BuiltInProcName.Unnamed;
	}
	const fn = DefaultBuiltinConfig.find(def =>
		((def.names as readonly Identifier[]).some(n => Identifier.getName(n) === name) && def.type !== 'constant')
		|| (def.type === 'replacement' && def.suffixes.flatMap(d => def.names.map(n => `${Identifier.getName(n)}${d}`)).includes(name))
	) as BuiltInFunctionDefinition<BuiltInProcName.Default | BuiltInProcName.DefaultReadAllArgs> | BuiltInReplacementDefinition | undefined;
	if(fn?.type === 'replacement') {
		return BuiltInProcName.Replacement;
	}
	return fn?.processor === BuiltInProcName.DefaultReadAllArgs ? BuiltInProcName.Default : fn?.processor;
}
