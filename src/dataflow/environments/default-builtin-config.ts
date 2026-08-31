import type { AnyBuiltInDefinition, BuiltInDefinitions, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from './built-in-config';
import { FunctionSemantics } from '../fn/function-semantics';
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
import { ArgProp, CallProp, type FnSig, SemanticCallTag, type SemanticCallTags, type StatedProps } from './built-in-props';
import { ClassSystem, MemberVisibility } from '../fn/class-declaration';
import { AttachedBasePackageSet, baseRExportOwner } from '../../util/r-base-packages';
import { RBasePackageStore } from '../../data/r-base-packages.generated';
import { Top } from '../eval/values/r-value';

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
 * The package exporting each plotting function flowR models, so {@link namespacePlotFunctions} can namespace it
 * instead of leaving it bare (bare stays always-on, which is the conservative default for an unknown owner).
 */
export const PlotFunctionPackages: Readonly<Record<string, readonly string[]>> = {
	DHARMa:     ['plotSimulatedResiduals'],
	ape:        ['tiplabels'],
	car:        ['densityPlot', 'qqPlot'],
	cowplot:    ['ggdraw', 'theme_map'],
	fBasics:    ['boxPlot', 'densityPlot', 'histPlot'],
	factoextra: ['fviz_cluster', 'fviz_dend', 'fviz_mca', 'fviz_mca_biplot', 'fviz_mca_ind', 'fviz_mca_var', 'fviz_pca',
		'fviz_pca_biplot', 'fviz_pca_ind', 'fviz_pca_var', 'fviz_screeplot'],
	forecast:   ['ggseasonplot'],
	ggExtra:    ['ggMarginal', 'removeGrid', 'removeGridX', 'removeGridY', 'rotateTextX'],
	ggalt:      ['geom_dumbbell', 'geom_encircle'],
	ggcorrplot: ['ggcorrplot'],
	ggdendro:   ['ggdendrogram'],
	ggmap:      ['qmap'],
	ggplot2:    ['annotate', 'annotation_custom', 'annotation_logticks', 'annotation_map', 'annotation_raster', 'autoplot',
		'borders', 'coord_cartesian', 'coord_equal', 'coord_fixed', 'coord_flip', 'coord_map', 'coord_munch',
		'coord_polar', 'coord_quickmap', 'coord_radial', 'coord_sf', 'coord_trans', 'expand_limits', 'expand_scale',
		'expansion', 'facet_grid', 'facet_null', 'facet_wrap', 'geom_abline', 'geom_area', 'geom_bar', 'geom_bin2d',
		'geom_bin_2d', 'geom_blank', 'geom_boxplot', 'geom_col', 'geom_contour', 'geom_contour_filled', 'geom_count',
		'geom_crossbar', 'geom_curve', 'geom_density', 'geom_density2d', 'geom_density2d_filled', 'geom_density_2d',
		'geom_density_2d_filled', 'geom_dotplot', 'geom_errorbar', 'geom_errorbarh', 'geom_freqpoly', 'geom_function',
		'geom_hex', 'geom_histogram', 'geom_hline', 'geom_jitter', 'geom_label', 'geom_line', 'geom_linerange',
		'geom_map', 'geom_path', 'geom_point', 'geom_pointrange', 'geom_polygon', 'geom_qq', 'geom_qq_line',
		'geom_quantile', 'geom_raster', 'geom_rect', 'geom_ribbon', 'geom_rug', 'geom_segment', 'geom_sf',
		'geom_sf_label', 'geom_sf_text', 'geom_smooth', 'geom_spoke', 'geom_step', 'geom_text', 'geom_tile',
		'geom_violin', 'geom_vline', 'ggplot', 'ggtitle', 'guides', 'labs', 'last_plot', 'qplot', 'quickplot',
		'scale_alpha', 'scale_alpha_binned', 'scale_alpha_continuous', 'scale_alpha_date', 'scale_alpha_datetime',
		'scale_alpha_discrete', 'scale_alpha_identity', 'scale_alpha_manual', 'scale_alpha_ordinal',
		'scale_color_binned', 'scale_color_brewer', 'scale_color_continuous', 'scale_color_date',
		'scale_color_datetime', 'scale_color_discrete', 'scale_color_distiller', 'scale_color_fermenter',
		'scale_color_gradient', 'scale_color_gradient2', 'scale_color_gradientn', 'scale_color_grey', 'scale_color_hue',
		'scale_color_identity', 'scale_color_manual', 'scale_color_ordinal', 'scale_color_steps', 'scale_color_steps2',
		'scale_color_stepsn', 'scale_color_viridis_b', 'scale_color_viridis_c', 'scale_color_viridis_d',
		'scale_colour_binned', 'scale_colour_brewer', 'scale_colour_continuous', 'scale_colour_date',
		'scale_colour_datetime', 'scale_colour_discrete', 'scale_colour_distiller', 'scale_colour_fermenter',
		'scale_colour_gradient', 'scale_colour_gradient2', 'scale_colour_gradientn', 'scale_colour_grey',
		'scale_colour_hue', 'scale_colour_identity', 'scale_colour_manual', 'scale_colour_ordinal',
		'scale_colour_steps', 'scale_colour_steps2', 'scale_colour_stepsn', 'scale_colour_viridis_b',
		'scale_colour_viridis_c', 'scale_colour_viridis_d', 'scale_continuous_identity', 'scale_discrete_identity',
		'scale_discrete_manual', 'scale_fill_binned', 'scale_fill_brewer', 'scale_fill_continuous', 'scale_fill_date',
		'scale_fill_datetime', 'scale_fill_discrete', 'scale_fill_distiller', 'scale_fill_fermenter',
		'scale_fill_gradient', 'scale_fill_gradient2', 'scale_fill_gradientn', 'scale_fill_grey', 'scale_fill_hue',
		'scale_fill_identity', 'scale_fill_manual', 'scale_fill_ordinal', 'scale_fill_steps', 'scale_fill_steps2',
		'scale_fill_stepsn', 'scale_fill_viridis_b', 'scale_fill_viridis_c', 'scale_fill_viridis_d', 'scale_linetype',
		'scale_linetype_binned', 'scale_linetype_continuous', 'scale_linetype_discrete', 'scale_linetype_identity',
		'scale_linetype_manual', 'scale_linewidth', 'scale_linewidth_binned', 'scale_linewidth_continuous',
		'scale_linewidth_date', 'scale_linewidth_datetime', 'scale_linewidth_discrete', 'scale_linewidth_identity',
		'scale_linewidth_manual', 'scale_linewidth_ordinal', 'scale_radius', 'scale_shape', 'scale_shape_binned',
		'scale_shape_continuous', 'scale_shape_discrete', 'scale_shape_identity', 'scale_shape_manual',
		'scale_shape_ordinal', 'scale_size', 'scale_size_area', 'scale_size_binned', 'scale_size_binned_area',
		'scale_size_continuous', 'scale_size_date', 'scale_size_datetime', 'scale_size_discrete', 'scale_size_identity',
		'scale_size_manual', 'scale_size_ordinal', 'scale_type', 'scale_x_binned', 'scale_x_continuous', 'scale_x_date',
		'scale_x_datetime', 'scale_x_discrete', 'scale_x_log10', 'scale_x_reverse', 'scale_x_sqrt', 'scale_x_time',
		'scale_y_binned', 'scale_y_continuous', 'scale_y_date', 'scale_y_datetime', 'scale_y_discrete', 'scale_y_log10',
		'scale_y_reverse', 'scale_y_sqrt', 'scale_y_time', 'stat_align', 'stat_bin', 'stat_bin2d', 'stat_bin_2d',
		'stat_bin_hex', 'stat_binhex', 'stat_boxplot', 'stat_contour', 'stat_contour_filled', 'stat_count',
		'stat_density', 'stat_density2d', 'stat_density2d_filled', 'stat_density_2d', 'stat_density_2d_filled',
		'stat_ecdf', 'stat_ellipse', 'stat_function', 'stat_identity', 'stat_qq', 'stat_qq_line', 'stat_quantile',
		'stat_sf', 'stat_sf_coordinates', 'stat_smooth', 'stat_spoke', 'stat_sum', 'stat_summary', 'stat_summary2d',
		'stat_summary_2d', 'stat_summary_bin', 'stat_summary_hex', 'stat_unique', 'stat_ydensity', 'theme', 'theme_bw',
		'theme_classic', 'theme_dark', 'theme_get', 'theme_gray', 'theme_grey', 'theme_light', 'theme_linedraw',
		'theme_minimal', 'theme_replace', 'theme_test', 'theme_update', 'theme_void', 'xlab', 'xlim', 'ylab', 'ylim'],
	ggpubr:   ['gradient_color'],
	ggthemes: ['scale_color_calc', 'scale_color_canva', 'scale_color_colorblind', 'scale_color_continuous_tableau',
		'scale_color_economist', 'scale_color_excel', 'scale_color_excel_new', 'scale_color_few',
		'scale_color_fivethirtyeight', 'scale_color_gdocs', 'scale_color_gradient2_tableau',
		'scale_color_gradient_tableau', 'scale_color_hc', 'scale_color_pander', 'scale_color_ptol',
		'scale_color_solarized', 'scale_color_stata', 'scale_color_tableau', 'scale_color_wsj', 'scale_colour_calc',
		'scale_colour_canva', 'scale_colour_colorblind', 'scale_colour_economist', 'scale_colour_excel',
		'scale_colour_excel_new', 'scale_colour_few', 'scale_colour_fivethirtyeight', 'scale_colour_gdocs',
		'scale_colour_gradient2_tableau', 'scale_colour_gradient_tableau', 'scale_colour_hc', 'scale_colour_pander',
		'scale_colour_ptol', 'scale_colour_solarized', 'scale_colour_stata', 'scale_colour_tableau', 'scale_colour_wsj',
		'scale_fill_calc', 'scale_fill_canva', 'scale_fill_colorblind', 'scale_fill_continuous_tableau',
		'scale_fill_economist', 'scale_fill_excel', 'scale_fill_excel_new', 'scale_fill_few',
		'scale_fill_fivethirtyeight', 'scale_fill_gdocs', 'scale_fill_gradient2_tableau', 'scale_fill_gradient_tableau',
		'scale_fill_hc', 'scale_fill_pander', 'scale_fill_ptol', 'scale_fill_solarized', 'scale_fill_stata',
		'scale_fill_tableau', 'scale_fill_wsj', 'scale_linetype_stata', 'scale_shape_calc', 'scale_shape_circlefill',
		'scale_shape_cleveland', 'scale_shape_few', 'scale_shape_stata', 'scale_shape_tableau', 'scale_shape_tremmel',
		'theme_base', 'theme_calc', 'theme_clean', 'theme_economist', 'theme_economist_white', 'theme_excel',
		'theme_excel_new', 'theme_few', 'theme_fivethirtyeight', 'theme_foundation', 'theme_gdocs', 'theme_hc',
		'theme_igray', 'theme_map', 'theme_pander', 'theme_par', 'theme_solarized', 'theme_solarized_2', 'theme_solid',
		'theme_stata', 'theme_tufte', 'theme_wsj'],
	HoRM:   ['regressogram'],
	gplots: ['bandplot', 'barplot2', 'boxplot2', 'bubbleplot', 'heatmap.2', 'lmplot2', 'overplot', 'plotCI',
		'plotmeans', 'residplot', 'sinkplot', 'textplot'],
	gridExtra: ['grid.arrange'],
	lattice:   ['bwplot', 'dotplot', 'histogram', 'splom', 'stripplot', 'trellis.device', 'xyplot'],
	leaflet:   ['leaflet'],
	magick:    ['image_draw', 'image_graph'],
	maps:      ['map'],
	openintro: ['boxPlot', 'densityPlot', 'histPlot'],
	pheatmap:  ['pheatmap'],
	jmcm:      ['bootcurve', 'meanplot', 'regressogram'],
	seqinr:    ['dotPlot'],
	plotly:    ['ggplotly', 'plot_ly'],
	ragg:      ['agg_capture', 'agg_jpeg', 'agg_png', 'agg_ppm', 'agg_tiff', 'agg_webp'],
	rasterpdf: ['raster_pdf'],
	survminer: ['ggsurvplot', 'ggsurvplot_add_all', 'theme_survminer'],
	tinyplot:  ['plt', 'plt_add', 'tinyplot', 'tinyplot_add'],
	tmap:      ['tm_shape'],
	vcd:       ['cotabplot'],
	vioplot:   ['vioplot']
};

/** the packages exporting each name, several when more than one of them draws under that name */
const PlotFunctionOwners: ReadonlyMap<string, string[]> = Object.entries(PlotFunctionPackages)
	.reduce((owners, [pkg, names]) => {
		for(const n of names) {
			owners.set(n, [...(owners.get(n) ?? []), pkg]);
		}
		return owners;
	}, new Map<string, string[]>());

/**
 * The packages exporting a plotting function, in the order {@link PlotFunctionPackages} lists them. More than
 * one means the name is ambiguous, so nothing may pin a call of it to a single package.
 */
export function plotFunctionOwners(name: string): readonly string[] {
	return PlotFunctionOwners.get(name) ?? [];
}

/** `names` under every package exporting each: base R from the shipped data, the rest from {@link PlotFunctionPackages}. */
export function namespacePlotFunctions(names: readonly string[]): (Identifier | string)[] {
	return names.flatMap(n => {
		const base = baseRExportOwner(n);
		if(base !== undefined) {
			return [Identifier.make(n, base)];
		}
		const pkgs = PlotFunctionOwners.get(n);
		return pkgs === undefined ? [n] : pkgs.map(pkg => Identifier.make(n, pkg));
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
	'density', 'smoothScatter', 'contour', 'persp', 'xyplot', 'stripplot', 'bwplot', 'dotPlot', 'dotplot', 'histPlot', 'densityPlot', 'qqplot', 'qqPlot', 'boxPlot',
	'bxp', 'assocplot', 'mosaicplot', 'stripchart', 'fourfoldplot', 'plot.xy', 'plot.formula', 'plot.default', 'plot.design', 'stars', 'cotabplot', 'pheatmap',
	'spineplot', 'regressogram', 'bootcurve', 'meanplot', 'vioplot', 'pairs', 'coplot', 'histogram', 'splom', 'leaflet', 'tm_shape', 'plot_ly', 'plotSimulatedResiduals', 'plotmeans',
	'overplot', 'residplot', 'heatmap.2', 'lmplot2', 'sinkplot', 'textplot', 'boxplot2',
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

/** The packages exporting magrittr's `%>%`: the tidyverse and friends re-export the very same function. */
const MagrittrPipePackages = [PkgName.Magrittr, PkgName.Dplyr, PkgName.Purrr, PkgName.Stringr, PkgName.Tibble,
	PkgName.TidyR, PkgName.Readr, PkgName.Testthat, PkgName.Magick, PkgName.Promises] as const;

/** The packages re-exporting rlang's tidy-evaluation helpers unchanged. */
const TidyEvalPackages = [PkgName.Rlang, PkgName.Dplyr, PkgName.GgPlot2] as const;

const SigAtomicBinOp: FnSig = [['e1', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic], ['e2', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic]];
const SigAtomicX: FnSig     = [['x', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic]];
const SigXY: FnSig    = [['x', ArgProp.Forced | ArgProp.Value], ['y', ArgProp.Forced | ArgProp.Value]];
const SigX: FnSig     = [['x', ArgProp.Forced | ArgProp.Value]];
/* `f(x, ...)`, the shape of most of R's summarizing and coercing functions */
const SigXDots: FnSig = [['x', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]];
/* `verb(.data, ...)`, the shape of the tidyverse verbs: the data first, the columns after */
const SigDataDots: FnSig = [['.data', ArgProp.Value], ['...', ArgProp.Value]];
const SigShape: FnSig  = [['x', ArgProp.Forced | ArgProp.Shape]];
const SigXTable: FnSig = [['x', ArgProp.Forced | ArgProp.Value], ['table', ArgProp.Forced | ArgProp.Value]];
const SigDots: FnSig  = [['...', ArgProp.Forced | ArgProp.Value]];

/** what flowR states about one of the functions it defines, in the words a page shows */
export interface StatedSignature {
	/** the package the definition is for, `base` when it names none */
	readonly pkg:     string;
	/** The formals flowR models, `x, ...`, or `undefined` where it declares none (not R's own declaration). */
	readonly params?: string;
	/** what it does, from {@link FunctionSemantics.call.props.labels} */
	readonly props:   readonly string[];
	/** each formal with what it is used for, from {@link FunctionSemantics.call.argument.words}; the roles read like the types R has none of */
	readonly args?:   readonly (readonly [name: string, roles: readonly string[]])[];
}

/**
 * The manual page documenting a base R primitive, for the ones not documented under their own name (a primitive
 * is written in C, so no signature/source/help-topic extractor sees it; `sin` is documented under `Trig`).
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
 * What flowR states about every function it carries a definition for, as `name -> signatures` (a name may be
 * defined for several packages, so all of them are here; {@link statedSignatureOf} picks by package).
 */
export function statedSignatures(definitions: BuiltInDefinitions = DefaultBuiltinConfig): Map<string, StatedSignature[]> {
	const stated = new Map<string, StatedSignature[]>();
	for(const definition of definitions) {
		const info = (definition as { config?: StatedProps & { sig?: FnSig } }).config;
		for(const id of definition.names) {
			const name = String(Identifier.getName(id));
			const pkg = String(Identifier.getNamespace(id) ?? PkgName.Base);
			const declared = info?.sig ?? [];
			const entry = {
				pkg,
				params: declared.length > 0 ? declared.map(([param]) => param).join(', ') : undefined,
				props:  FunctionSemantics.call.props.labels(info),
				args:   declared.length > 0 ? declared.map(([param, props]) => [param, FunctionSemantics.call.argument.words(props)] as const) : undefined
			};
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

/** The internal generics: they dispatch in C rather than through `UseMethod`, so the list has to be written down. */
const InternalGenerics: readonly string[] = [
	'$', '[', '[[', '+', '-', '*', '/', '^', '%%', '%/%', '==', '!=', '<', '>', '<=', '>=', '&', '|', '!',
	'c', 'length', 'dim', 'dimnames', 'names', 'max', 'min', 'range', 'sum', 'prod', 'abs', 'sqrt', 'exp',
	'log', 'floor', 'ceiling', 'round', 'signif', 'trunc', 'cumsum', 'cumprod', 'cummax', 'cummin',
	'as.character', 'as.integer', 'as.double', 'as.logical', 'as.complex', 'as.numeric', 'as.raw',
	'is.na', 'is.nan', 'is.finite', 'is.infinite', 'is.matrix', 'is.numeric', 'cbind', 'rbind'
];

/**
 * Every name R dispatches on: the generated closure generics plus the {@link InternalGenerics} (no R body, so
 * {@link fnInfoFromSignature} never sees them). `npm run check:generic-labels` checks this against a synced database.
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

/**
 * Whether the call names a plot function that can append to an existing plot, and if so whether its `add`
 * argument says so; `undefined` for a call that has no such argument at all.
 */
function appendsToPlot(source: NodeId, graph: DataflowGraph): boolean | undefined {
	const vertex = graph.getVertex(source) as DataflowGraphVertexFunctionCall;
	return PlotFunctionsWithAddParam.has(Identifier.getName(vertex.name))
		? getValueOfArgument(graph, vertex, { index: -1, name: 'add' }, [RType.Logical])?.content === true
		: undefined;
}

/** what adding to a plot does; restated by the deprecated addons, which do the same but should not be used */
const PlotAddonConfig = {
	treatAsFnCall: {
		'facet_grid': ['labeller']
	},
	hasUnknownSideEffects: {
		type:      'link-to-last-call',
		callName:  toRegex(PlotCreate.concat(PlotAddons)),
		ignoreIf:  (source: NodeId, graph: DataflowGraph) => appendsToPlot(source, graph) === false,
		cascadeIf: (targetVertex: DataflowGraphVertexInfo, _: NodeId, graph: DataflowGraph) => {
			const target = targetVertex as DataflowGraphVertexFunctionCall;
			/* `add = TRUE` appends to an existing plot, so the chain carries on through it */
			return Identifier.getName(target.name) ? (getValueOfArgument(graph, target, {
				index: 11,
				name:  'add'
			}, [RType.Logical])?.content === true ? CascadeAction.Continue : CascadeAction.Stop) : CascadeAction.Stop;
		}
	},
	tags: [SemanticCallTag.Graphics] as SemanticCallTags, sig: [['...', ArgProp.Forced]] as FnSig } as const;

/** what creating a plot does; restated by the deprecated plot creators, which do the same but should not be used */
const PlotCreateConfig = {
	hasUnknownSideEffects: {
		type:     'link-to-last-call',
		ignoreIf: (source: NodeId, graph: DataflowGraph) => appendsToPlot(source, graph) === true,
		callName: toRegex(GraphicDeviceOpen)
	},
	tags: [SemanticCallTag.Graphics] as SemanticCallTags, sig: [['...', ArgProp.Forced]] as FnSig } as const;

/**
 * Contains the built-in definitions recognized by flowR, as they are written down: {@link DefaultBuiltinConfig}
 * is what {@link markGenerics} makes of them, and a test checks that this is all it changes.
 */
export const WrittenBuiltinDefinitions = [
	{ type: 'constant', names: [Identifier.from(['NULL', PkgName.Base])], value: null, assumePrimitive: true },
	/* an `NA` is a value R has and flowR has no way to hold, which is not the same as having none: `is.null(NA)` is FALSE */
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['NA', 'NA_integer_', 'NA_real_', 'NA_complex_', 'NA_character_']), value: Top, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['NaN', PkgName.Base])], value: NaN, assumePrimitive: true },
	/* an environment is no more `NULL` than an `NA` is; which one it stands for is what the stack-env handling answers */
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['.GlobalEnv', '.BaseNamespaceEnv', '.BaseEnv']), value: Top, assumePrimitive: true },
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['TRUE', 'T']),  value: true,  assumePrimitive: true },
	{ type: 'constant', names: Identifier.fromAll(PkgName.Base, ['FALSE', 'F']),  value: false, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['Inf', PkgName.Base])],  value: Infinity,  assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['-Inf', PkgName.Base])], value: -Infinity, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['pi', PkgName.Base])],   value: Math.PI,   assumePrimitive: true },
	{ type:            'constant', names:           [Identifier.from(['LETTERS', PkgName.Base])],
		value:           Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), assumePrimitive: true },
	{ type:            'constant', names:           [Identifier.from(['letters', PkgName.Base])],
		value:           Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)), assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['month.abb', PkgName.Base])], value: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['month.name', PkgName.Base])], value: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], assumePrimitive: true },
	/* formula: operands are model terms/columns, not variables */
	{ type: 'function', names: [Identifier.from(['~', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { markArgsAsMasked: NseArguments.All }, assumePrimitive: false },
	/* cohortBuilder has a `filter` too, and built-ins go by name, so dplyr's entry below wins in the environment
	   while this one still states what cohortBuilder's does */
	{ type: 'function', names: [Identifier.from(['filter', PkgName.CohortBuilder])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Pure, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* data-masking: the non-data arguments name columns of the (first) data object, not variables */
	{ type: 'function', names: DataMaskingFunctionIdentifiers, processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure }, assumePrimitive: false },
	/* slice_sample draws rows at random; registered after the block above, so this definition is the one that sticks */
	{ overrides: true, type: 'function', names: [Identifier.from(['slice_sample', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, tags: [SemanticCallTag.Random] }, assumePrimitive: false },
	/* data-masking without a data argument, e.g. `aes(x, y)` */
	{ type: 'function', names: [...Identifier.fromAll(PkgName.GgPlot2, ['aes', 'vars']), Identifier.from(['join_by', PkgName.Dplyr]), ...Identifier.fromAllIn([PkgName.Tibble, PkgName.Dplyr, PkgName.TidyR], ['tibble', 'tribble'])], processor: BuiltInProcName.DefaultReadAllArgs, config: { markArgsAsMasked: NseArguments.All }, assumePrimitive: false },
	/* an {@link BuiltInEvalName} marks what the value solver folds; a test checks the names against the handler tables */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['+', '-', '*', '/', '^', '**', '%%', '%/%']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigAtomicBinOp }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['==', '!=', '>', '<', '>=', '<=']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigAtomicBinOp }, assumePrimitive: true, evalHandler: BuiltInEvalName.Comparison },
	{ type: 'function', names: [Identifier.from(['%*%', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigXY }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['%in%', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigXTable }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from([':', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['from', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic], ['to', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Seq },
	{ type: 'function', names: [Identifier.from(['!', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigAtomicX }, assumePrimitive: true, evalHandler: BuiltInEvalName.Logical },
	{ type:            'function', names:           [Identifier.from(['?', PkgName.Utils])], /* shows the help page of what it is given */
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          { sig: [['e1', ArgProp.Nse], ['e2', ArgProp.Nse]] }, assumePrimitive: true },
	/* the result follows from how large the argument is, not from what is in it, so it is bounded (`Narrows`) */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['length', 'lengths', 'nrow', 'ncol', 'NROW', 'NCOL', 'dim', 'is.null', 'is.factor', 'is.vector', 'is.matrix', 'is.data.frame', 'is.numeric', 'is.character', 'is.logical', 'is.function', 'is.list']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigShape }, assumePrimitive: true },
	/* the names and the class are read off the argument, so whatever it carries can show up in the result */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['dimnames', 'names', 'rownames', 'colnames', 'class']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigShape }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['nchar', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigShape }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	{ type: 'function', names: [Identifier.from(['missing', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Presence]] }, assumePrimitive: true },
	/* `hasArg(x)` is `missing()` asked the other way round: it too only looks at whether an argument was supplied */
	{ type: 'function', names: [Identifier.from(['hasArg', PkgName.Methods])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['name', ArgProp.Presence]] }, assumePrimitive: true },
	/* they fold everything they are handed into one result */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['sum', 'prod', 'min', 'max', 'range', 'pmin', 'pmax', 'cbind', 'rbind', 'data.frame', 'order', 'any']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigDots }, assumePrimitive: true },
	/* the separator sits behind the `...`, so R (and the {@link FnSig}) only ever matches it by its full name */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['paste', 'paste0']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['...', ArgProp.Forced | ArgProp.Value], ['sep', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	{ type: 'function', names: [Identifier.from(['file.path', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['...', ArgProp.Forced | ArgProp.Value], ['fsep', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	/* `here` joins its arguments below the project root, which stays implicit */
	{ type: 'function', names: [Identifier.from(['here', PkgName.Here])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, props: CallProp.Pure, sig: [['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false, evalHandler: BuiltInEvalName.StringFn },
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
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['is.na', 'nzchar', 'is.finite', 'is.infinite', 'is.nan']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigX }, assumePrimitive: true },
	/* the numeric functions the value solver folds; each one is an entry of `NumericFns`, which states its parameters */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['sqrt', 'abs', 'floor', 'ceiling', 'trunc', 'sign', 'exp', 'expm1', 'log2', 'log10', 'log1p', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigX }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['round', 'signif']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['digits', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: [Identifier.from(['log', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['base', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['tolower', 'toupper', 'trimws']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigX }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['basename', 'dirname']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['path', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['Re', 'Im', 'Mod', 'Arg', 'Conj']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['z', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	/* the vector constructors take the length of the result, not its contents */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['numeric', 'character', 'logical', 'integer', 'double', 'raw']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['length', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['na.omit', PkgName.Stats])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['object', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	/* two data arguments, under the names R gives them */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['xor', 'crossprod', 'tcrossprod', 'intersect', 'union', 'setdiff']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigXY }, assumePrimitive: true },
	/* they answer with a position or a logical, never with what they matched */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['match', 'pmatch', 'charmatch']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigXTable }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['is.element', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['el', ArgProp.Forced | ArgProp.Value], ['set', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	/* the result is one of the `choices`, so what flows in is bounded by that argument */
	{ type: 'function', names: [Identifier.from(['match.arg', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['arg', ArgProp.Forced | ArgProp.Value], ['choices', ArgProp.Forced | ArgProp.Bounds]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['atan2', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['y', ArgProp.Forced | ArgProp.Value], ['x', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['bitwAnd', 'bitwOr', 'bitwXor']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['a', ArgProp.Forced | ArgProp.Value], ['b', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['bitwShiftL', 'bitwShiftR']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['a', ArgProp.Forced | ArgProp.Value], ['n', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: [Identifier.from(['bitwNot', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['a', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric },
	{ type: 'function', names: [Identifier.from(['grepl', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['pattern', ArgProp.Forced | ArgProp.Value], ['x', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['startsWith', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['x', ArgProp.Forced | ArgProp.Value], ['prefix', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['endsWith', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['x', ArgProp.Forced | ArgProp.Value], ['suffix', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
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
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Stats, ['anova', 'ansari.test', 'aov', 'bartlett.test', 'binom.test', 'Box.test', 'chisq.test', 'cor.test', 'fisher.test', 'fligner.test', 'friedman.test', 'kruskal.test', 'ks.test', 'manova', 'mantelhaen.test', 'mauchly.test', 'mcnemar.test', 'mood.test', 'oneway.test', 'pairwise.prop.test', 'pairwise.t.test', 'pairwise.wilcox.test', 'poisson.test', 'PP.test', 'prop.test', 'prop.trend.test', 'quade.test', 'shapiro.test', 't.test', 'TukeyHSD', 'var.test', 'wilcox.test']), ...Identifier.fromAll(PkgName.Car, ['Anova', 'durbinWatsonTest', 'leveneTest', 'linearHypothesis', 'ncvTest', 'outlierTest']), ...Identifier.fromAll(PkgName.LmTest, ['bgtest', 'bptest', 'coeftest', 'dwtest', 'gqtest', 'lrtest', 'raintest', 'resettest', 'waldtest']), ...Identifier.fromAll(PkgName.NorTest, ['ad.test', 'cvm.test', 'lillie.test', 'pearson.test', 'sf.test']), ...Identifier.fromAll(PkgName.Tseries, ['adf.test', 'jarque.bera.test', 'kpss.test', 'pp.test', 'runs.test', 'white.test']), ...Identifier.fromAll(PkgName.Rstatix, ['anova_test', 'chisq_test', 'cor_test', 'kruskal_test', 'shapiro_test', 't_test', 'wilcox_test']), Identifier.from(['glht', PkgName.Multcomp])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Statistics] }, assumePrimitive: false },

	/* indices and index sequences: bounded by the shape of what they are handed, never by its contents */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['which', 'which.max', 'which.min', 'seq_len', 'seq_along']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows] }, assumePrimitive: true },

	/* they open a device that writes the plot to the file they are given, under the name each of them uses */
	{ type: 'function', names: [...Identifier.fromAll(PkgName.GrDevices, ['png', 'jpeg', 'bmp', 'tiff', 'svg', 'cairo_pdf']), Identifier.from(['raster_pdf', PkgName.RasterPdf]), ...Identifier.fromAll(PkgName.Ragg, ['agg_png', 'agg_jpeg', 'agg_tiff', 'agg_ppm', 'agg_webp'])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['width', ArgProp.Forced | ArgProp.Value], ['height', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: Identifier.fromAll(PkgName.GrDevices, ['pdf', 'postscript', 'xfig', 'bitmap', 'pictex']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['type', ArgProp.Forced | ArgProp.Value], ['height', ArgProp.Forced | ArgProp.Value], ['width', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	/* devices that draw on the screen or into memory instead */
	{ type: 'function', names: [...Identifier.fromAll(PkgName.GrDevices, ['X11', 'windows', 'quartz', 'dev.new']), Identifier.from(['trellis.device', PkgName.Lattice]), ...Identifier.fromAll(PkgName.Magick, ['image_graph', 'image_draw'])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Graphics] }, assumePrimitive: true },

	{ type: 'function', names: [Identifier.from(['read.csv', PkgName.Utils])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['header', ArgProp.Forced | ArgProp.Flag], ['sep', ArgProp.Forced | ArgProp.Value], ['quote', ArgProp.Forced | ArgProp.Value], ['dec', ArgProp.Forced | ArgProp.Value], ['fill', ArgProp.Forced | ArgProp.Flag], ['comment.char', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['scan', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.User], sig: [['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	/* the package functions that read or write a file, each naming the argument that holds the path; the
	   dependency query reads its `read` and `write` categories back from here rather than listing them again */
	{ type: 'function', names: [Identifier.from(['read.dcf', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.fwf', PkgName.Utils])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readRenviron', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_csv', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_csv2', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_lines', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_delim', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_fwf', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_tsv', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_table', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_log', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_lines_raw', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_lines_chunked', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_rds', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.xlsx', PkgName.Xlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.xlsx2', PkgName.Xlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['fread', PkgName.DataTable])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_sas', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_sav', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_por', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_dta', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_xpt', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_feather', PkgName.Feather])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.arff', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.dbf', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.dta', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.epiinfo', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.mtp', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.octave', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.spss', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.ssd', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.systat', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.xport', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Import', PkgName.Car])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['image_read', PkgName.Magick])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['image_read_svg', PkgName.Magick])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['image_read_pdf', PkgName.Magick])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['image_read_video', PkgName.Magick])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Read', PkgName.Lim])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read', PkgName.Sourcetools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_lines', PkgName.Sourcetools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_bytes', PkgName.Sourcetools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_lines_bytes', PkgName.Sourcetools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['tokenize_file', PkgName.Sourcetools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_spss', PkgName.Expss])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.geno', PkgName.SimPhe])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['fname', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readland.tps', PkgName.Geomorph])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_excel', PkgName.Readxl])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_xls', PkgName.Readxl])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_xlsx', PkgName.Readxl])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_sf', PkgName.Sf])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['st_read', PkgName.Sf])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readOGR', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['ogrInfo', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['ogrFIDs', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['OGRSpatialRef', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['ogrListLayers', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readGDAL', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['fname', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.dta13', PkgName.Readstata13])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_parquet', PkgName.Arrow])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readShapePoly', PkgName.Maptools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['fn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readWorksheetFromFile', PkgName.XlConnect])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readNamedRegionFromFile', PkgName.XlConnect])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['loadWorkbook', PkgName.XlConnect])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['import_graph', PkgName.DiagrammeR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['graph_file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['open_graph', PkgName.DiagrammeR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.ftable', PkgName.Stats])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_json', PkgName.Jsonlite])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['import', PkgName.Rio])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['import_list', PkgName.Rio])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.xlsx', PkgName.OpenXlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['xlsxFile', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['loadWorkbook', PkgName.OpenXlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_ods', PkgName.ReadOds])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['vroom', PkgName.Vroom])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readJPEG', PkgName.Jpeg])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['source', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readPNG', PkgName.Png])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['source', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readTIFF', PkgName.Tiff])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['source', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['load.image', PkgName.Imager])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['load.video', PkgName.Imager])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['load.dir', PkgName.Imager])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readImage', PkgName.OpenImageR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readImage', PkgName.EbImage])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['files', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['av_video_images', PkgName.Av])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['video', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_audio_bin', PkgName.Av])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['audio', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_audio_fft', PkgName.Av])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['audio', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readWave', PkgName.TuneR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readMP3', PkgName.TuneR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readMidi', PkgName.TuneR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.audacity', PkgName.Seewave])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['load.wave', PkgName.Audio])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['where', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['rast', PkgName.Terra])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['vect', PkgName.Terra])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['raster', PkgName.Raster])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['brick', PkgName.Raster])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['shapefile', PkgName.Raster])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_stars', PkgName.Stars])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['.x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_ncdf', PkgName.Stars])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['.x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readShapeLines', PkgName.Maptools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['fn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readShapePoints', PkgName.Maptools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['fn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readShapeSpatial', PkgName.Maptools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['fn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['nc_open', PkgName.Ncdf4])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['open.nc', PkgName.Rnetcdf])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['con', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readMat', PkgName.Rmatlab])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['con', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['h5read', PkgName.Rhdf5])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['h5ls', PkgName.Rhdf5])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_fst', PkgName.Fst])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['qread', PkgName.Qs])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.nexus', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.nexus.data', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.dna', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.FASTA', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read.fasta', PkgName.Seqinr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['dump', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['list', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_csv', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_csv2', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_delim', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_excel_csv', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_excel_csv2', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_file', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_tsv', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_lines', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_rds', PkgName.Readr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_sas', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['data', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_sav', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['data', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_dta', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['data', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_xpt', PkgName.Haven])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['data', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_feather', PkgName.Feather])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.arff', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.dbf', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['dataframe', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.dta', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['dataframe', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.foreign', PkgName.Foreign])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['df', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.xlsx', PkgName.Xlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.xlsx2', PkgName.Xlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Export', PkgName.Car])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.tree', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['phy', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.nexus', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['phy', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.phyloXML', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['phy', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_nexus_matrix', PkgName.Claddis])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['cladistic_matrix', ArgProp.Forced | ArgProp.Value], ['file_name', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_tnt_matrix', PkgName.Claddis])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['cladistic_matrix', ArgProp.Forced | ArgProp.Value], ['file_name', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeOGR', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['obj', ArgProp.Forced | ArgProp.Value], ['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeGDAL', PkgName.Rgdal])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['dataset', ArgProp.Forced | ArgProp.Value], ['fname', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_parquet', PkgName.Arrow])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['sink', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['st_write', PkgName.Sf])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['obj', ArgProp.Forced | ArgProp.Value], ['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writePolyShape', PkgName.Maptools])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['fn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeNamedRegionToFile', PkgName.XlConnect])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeWorksheetToFile', PkgName.XlConnect])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['visSave', PkgName.VisNetwork])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['graph', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['save_graph', PkgName.DiagrammeR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['graph', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['ggsave', PkgName.GgPlot2])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['ggsave2', PkgName.Cowplot])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_json', PkgName.Jsonlite])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['fwrite', PkgName.DataTable])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_xlsx', PkgName.Writexl])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.xlsx', PkgName.OpenXlsx])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['vroom_write', PkgName.Vroom])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['vroom_write_lines', PkgName.Vroom])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['export', PkgName.Rio])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['export_list', PkgName.Rio])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeTIFF', PkgName.Tiff])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['what', ArgProp.Forced | ArgProp.Value], ['where', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['make.video', PkgName.Imager])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['dname', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeImage', PkgName.OpenImageR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['data', ArgProp.Forced | ArgProp.Value], ['file_name', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeImage', PkgName.EbImage])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['files', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['gifski', PkgName.Gifski])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['png_files', ArgProp.Forced | ArgProp.Value], ['gif_file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['save_gif', PkgName.Gifski])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['expr', ArgProp.Forced | ArgProp.Value], ['gif_file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['svglite', PkgName.Svglite])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['av_encode_video', PkgName.Av])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['input', ArgProp.Forced | ArgProp.Value], ['output', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['av_audio_convert', PkgName.Av])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['audio', ArgProp.Forced | ArgProp.Value], ['output', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['av_capture_graphics', PkgName.Av])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['expr', ArgProp.Forced | ArgProp.Value], ['output', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeWave', PkgName.TuneR])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['object', ArgProp.Forced | ArgProp.Value], ['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['save.wave', PkgName.Audio])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['what', ArgProp.Forced | ArgProp.Value], ['where', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeRaster', PkgName.Terra])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeVector', PkgName.Terra])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeCDF', PkgName.Terra])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeRaster', PkgName.Raster])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_stars', PkgName.Stars])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['obj', ArgProp.Forced | ArgProp.Value], ['dsn', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['nc_create', PkgName.Ncdf4])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['create.nc', PkgName.Rnetcdf])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['filename', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeMat', PkgName.Rmatlab])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['con', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['h5write', PkgName.Rhdf5])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['obj', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['h5createFile', PkgName.Rhdf5])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_fst', PkgName.Fst])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['path', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['qsave', PkgName.Qs])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write_yaml', PkgName.Yaml])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.dna', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.nexus.data', PkgName.Ape])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.fasta', PkgName.Seqinr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['sequences', ArgProp.Forced | ArgProp.Value], ['names', ArgProp.Forced | ArgProp.Value], ['file.out', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* the connections and the calls that move data through them, so anything reaching them inherits it */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['file', 'gzfile', 'bzfile', 'xzfile', 'unz', 'fifo']), processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Opens, SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Writes], sig: [['description', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['url', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Opens, SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['description', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['socketConnection', 'serverSocket']), processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Opens, SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['host', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['textConnection', 'rawConnection']), processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Opens], sig: [['object', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* the calls that always reach the network, each naming the argument that carries the address; the
	   `network-functions` rule reads them back from here rather than keeping a list of its own */
	{ type: 'function', names: Identifier.fromAll(PkgName.Httr, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'BROWSE']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['config', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* `VERB`/`RETRY` take the method first, so the address is the second argument rather than the first */
	{ type: 'function', names: Identifier.fromAll(PkgName.Httr, ['VERB', 'RETRY']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['verb', ArgProp.Forced | ArgProp.Value], ['url', ArgProp.Forced | ArgProp.Resource], ['config', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['handle', PkgName.Httr])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Opens, SemanticCallTag.Network], sig: [['url', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['oauth_endpoint', PkgName.Httr])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network], sig: [['request', ArgProp.Forced | ArgProp.Resource], ['authorize', ArgProp.Forced | ArgProp.Resource], ['access', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value], ['base_url', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['curl', PkgName.Curl])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Opens, SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['open', ArgProp.Forced | ArgProp.Flag], ['handle', ArgProp.Forced | ArgProp.Handle]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Curl, ['curl_fetch_memory', 'curl_fetch_disk', 'curl_fetch_stream', 'nslookup', 'curl_escape', 'has_internet']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['curl_download', PkgName.Curl])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['destfile', ArgProp.Forced | ArgProp.Resource], ['quiet', ArgProp.Forced | ArgProp.Flag], ['mode', ArgProp.Forced | ArgProp.Value], ['handle', ArgProp.Forced | ArgProp.Handle]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['multi_download', PkgName.Curl])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['urls', ArgProp.Forced | ArgProp.Resource], ['destfiles', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* `curl_upload` sends a file somewhere, so the file it reads comes first and the address second */
	{ type: 'function', names: [Identifier.from(['curl_upload', PkgName.Curl])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['url', ArgProp.Forced | ArgProp.Resource], ['verbose', ArgProp.Forced | ArgProp.Flag], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['curl_echo', PkgName.Curl])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network], sig: [['handle', ArgProp.Forced | ArgProp.Handle], ['port', ArgProp.Forced | ArgProp.Value], ['progress', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['new_handle', PkgName.Curl])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Opens, SemanticCallTag.Network], sig: [['...', ArgProp.Forced | ArgProp.Value], ['url', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['getURL', PkgName.Rcurl]), Identifier.from(['getForm', PkgName.Rbdat])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Xml2, ['read_html', 'read_xml']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['encoding', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['download_html', PkgName.Rvest])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* `html_nodes`/`html_text` take a document, but rvest lets that be an address it fetches first */
	{ type: 'function', names: Identifier.fromAll(PkgName.Rvest, ['html_nodes', 'html_text']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['read_html_live', PkgName.Rvest])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Xfun, ['url_filename', 'url_accessible', 'url_destination']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network], sig: [['x', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.GoogleDrive, ['drive_get', 'drive_download', 'shared_drive_get', 'shared_drive_rm']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.AwsS3, ['s3read_using', 's3write_using']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['FUN', ArgProp.Forced | ArgProp.Callee], ['...', ArgProp.Forced | ArgProp.Value], ['object', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['storage_download', PkgName.GoogleCloudStorageR])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['object_name', ArgProp.Forced | ArgProp.Resource], ['saveToDisk', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['AnnotationHub', PkgName.AnnotationHub]), Identifier.from(['ExperimentHub', PkgName.ExperimentHub])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['hub', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Devtools, ['source_url', 'source_gist']), processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['github_pull', PkgName.Remotes])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['pull', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.UseThis, ['create_from_github', 'use_git_remote', 'use_github_action', 'use_github_file', 'use_tidy_thanks']), processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['repo_spec', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.RstudioApi, ['viewer', 'getDelegatedAzureToken']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Network], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Shiny, ['runGist', 'runUrl', 'httpResponse']), processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['addServer', PkgName.RsConnect])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Configures, tags: [SemanticCallTag.Network], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['name', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['copy_to', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Database, SemanticCallTag.Writes], sig: [['dest', ArgProp.Forced | ArgProp.Handle], ['df', ArgProp.Forced | ArgProp.Value], ['name', ArgProp.Forced | ArgProp.Resource], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['dbConnect', PkgName.Dbi])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.Opens, SemanticCallTag.Database] }, assumePrimitive: false },
	/* the calls ending what an opener started, each stating the argument holding the handle */
	{ type: 'function', names: [Identifier.from(['close', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible | CallProp.Generic, tags: [SemanticCallTag.Closes], sig: [['con', ArgProp.Forced | ArgProp.Handle], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['closeAllConnections', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.Closes] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['dbDisconnect', PkgName.Dbi])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, props: CallProp.Invisible, tags: [SemanticCallTag.Closes, SemanticCallTag.Database], sig: [['conn', ArgProp.Forced | ArgProp.Handle], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* withr closes the connection it is handed when the scope it is called in ends */
	{ type: 'function', names: [Identifier.from(['local_connection', PkgName.Withr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, tags: [SemanticCallTag.Closes], sig: [['con', ArgProp.Forced | ArgProp.Handle], ['.local_envir', ArgProp.Forced | ArgProp.Written]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['with_connection', PkgName.Withr])], processor: BuiltInProcName.DefaultReadAllArgs, config: { libFn: true, props: CallProp.MayPure, tags: [SemanticCallTag.Closes], sig: [['con', ArgProp.Forced | ArgProp.Handle], ['code', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['readLines', 'readBin', 'readChar']), processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['con', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['readRDS', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['writeLines', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints], sig: [['text', ArgProp.Forced | ArgProp.Value], ['con', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['writeBin', 'writeChar']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['object', ArgProp.Forced | ArgProp.Value], ['con', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['saveRDS', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['object', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['save', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['...', ArgProp.Forced | ArgProp.Value], ['list', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['save.image', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['dput', 'write']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.dcf', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['write.table', PkgName.Utils])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Utils, ['write.csv', 'write.csv2']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Utils, ['read.table', 'read.delim', 'read.csv2', 'read.delim2']), processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['download.file', PkgName.Utils])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['destfile', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['jitter', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Random] }, assumePrimitive: true },
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Base, ['sample', 'sample.int']), ...Identifier.fromAll(PkgName.Stats, ['runif', 'rnorm', 'rbinom', 'rpois', 'rexp', 'rgamma', 'rbeta', 'rcauchy', 'rchisq', 'rgeom', 'rhyper', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rsignrank', 'rt', 'rf', 'rweibull', 'rwilcox', 'arima.sim', 'simulate', 'kmeans'])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Random] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['expression', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Lang }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['rm', PkgName.Base])], processor: BuiltInProcName.Rm, config: { props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true },
	/* they read the state they set, so both bits apply */
	{ type: 'function', names: [Identifier.from(['options', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Invisible | CallProp.Ambient | CallProp.Configures, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* `Sys.putenv` is defunct in current R, older scripts still use it */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['Sys.setenv', 'Sys.unsetenv', 'Sys.setlocale', 'Sys.putenv', 'Sys.setLanguage']), processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Invisible | CallProp.Configures, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['future', PkgName.Future])], processor: BuiltInProcName.Default, config: { props: CallProp.Concurrent, sig: [['expr', ArgProp.Nse], ['envir', ArgProp.Written], ['substitute', ArgProp.Flag], ['globals', ArgProp.Value], ['packages', ArgProp.Value], ['lazy', ArgProp.Flag], ['seed', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['futureCall', PkgName.Future])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure | CallProp.Concurrent, sig: [['FUN', ArgProp.Callee], ['args', ArgProp.Value], ['globals', ArgProp.Value], ['seed', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Future, ['value', 'resolved', 'nbrOfWorkers']), processor: BuiltInProcName.Default, config: { props: CallProp.Concurrent, sig: [['future', ArgProp.Handle], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['plan', PkgName.Future])], processor: BuiltInProcName.Default, config: { props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, sig: [['strategy', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.FutureApply, ['future_lapply', 'future_sapply', 'future_vapply', 'future_apply', 'future_eapply', 'future_tapply', 'future_replicate']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure | CallProp.Concurrent, sig: [['X', ArgProp.Value], ['FUN', ArgProp.Callee], ['...', ArgProp.Value], ['future.seed', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.FutureApply, ['future_mapply', 'future_Map']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure | CallProp.Concurrent, sig: [['FUN', ArgProp.Callee], ['...', ArgProp.Value], ['MoreArgs', ArgProp.Value], ['future.seed', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Furrr, ['future_map', 'future_map_chr', 'future_map_dbl', 'future_map_int', 'future_map_lgl', 'future_map_dfr', 'future_map_dfc', 'future_imap', 'future_walk', 'future_modify']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: '.f', unquoteFunction: true, props: CallProp.MayPure | CallProp.Concurrent, sig: [['.x', ArgProp.Value], ['.f', ArgProp.Callee], ['...', ArgProp.Value], ['.options', ArgProp.Value], ['.progress', ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Furrr, ['future_map2', 'future_pmap', 'future_pwalk']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: '.f', unquoteFunction: true, props: CallProp.MayPure | CallProp.Concurrent, sig: [['.x', ArgProp.Value], ['.f', ArgProp.Callee], ['...', ArgProp.Value], ['.options', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['future_promise', PkgName.Promises])], processor: BuiltInProcName.Default, config: { props: CallProp.Concurrent, sig: [['expr', ArgProp.Nse], ['substitute', ArgProp.Flag], ['globals', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['%dopar%', PkgName.Foreach]), Identifier.from(['%dofuture%', PkgName.DoFuture])], processor: BuiltInProcName.Default, config: { props: CallProp.MayPure | CallProp.Concurrent, sig: [['obj', ArgProp.Value], ['ex', ArgProp.Nse]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['registerDoParallel', PkgName.DoParallel]), Identifier.from(['registerDoMC', PkgName.DoMc]), Identifier.from(['registerDoSNOW', PkgName.DoSnow]), Identifier.from(['registerDoFuture', PkgName.DoFuture])], processor: BuiltInProcName.Default, config: { props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, sig: [['cl', ArgProp.Handle], ['cores', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['mirai', PkgName.Mirai])], processor: BuiltInProcName.Default, config: { props: CallProp.Concurrent, sig: [['.expr', ArgProp.Nse], ['...', ArgProp.Value], ['.args', ArgProp.Value], ['.timeout', ArgProp.Value], ['.compute', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['mirai_map', PkgName.Mirai])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: '.f', unquoteFunction: true, props: CallProp.MayPure | CallProp.Concurrent, sig: [['.x', ArgProp.Value], ['.f', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['daemons', PkgName.Mirai])], processor: BuiltInProcName.Default, config: { props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, tags: [SemanticCallTag.Process], sig: [['n', ArgProp.Value], ['url', ArgProp.Resource], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Callr, ['r_bg', 'rcmd_bg']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'func', unquoteFunction: true, props: CallProp.Concurrent, tags: [SemanticCallTag.Process, SemanticCallTag.Opens], sig: [['func', ArgProp.Callee], ['args', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.RcppParallel, ['parallelFor', 'parallelReduce']), processor: BuiltInProcName.Default, config: { props: CallProp.Concurrent | CallProp.Ffi, sig: [['begin', ArgProp.Value], ['end', ArgProp.Value], ['worker', ArgProp.Callee], ['grainSize', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['setThreadOptions', PkgName.RcppParallel])], processor: BuiltInProcName.Default, config: { props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, sig: [['numThreads', ArgProp.Value], ['stackSize', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['mapply', PkgName.Base]), Identifier.from(['Mapply', PkgName.Functools])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure, sig: [['FUN', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['lapply', 'sapply', 'vapply']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure, sig: [['X', ArgProp.Value], ['FUN', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	/* `vapply` takes the shape of the result before its `...`, so naming it keeps the positions honest */
	{ overrides: true, type: 'function', names: [Identifier.from(['vapply', PkgName.Base])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure, sig: [['X', ArgProp.Value], ['FUN', ArgProp.Callee], ['FUN.VALUE', ArgProp.Shape], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Functools, ['Lapply', 'Sapply', 'Vapply']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Base, ['apply', 'tapply']), Identifier.from(['Tapply', PkgName.Functools])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 2, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Map', PkgName.Base])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Filter', PkgName.Base])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee], ['x', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['Find', 'Position']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee], ['x', ArgProp.Value], ['right', ArgProp.Flag], ['nomatch', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Reduce', PkgName.Base])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: [['f', ArgProp.Callee]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['rapply', PkgName.Base])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 1, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['print', PkgName.Base])], processor: BuiltInProcName.Default, config: { keepArgumentOut: true, hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ }, props: CallProp.Invisible | CallProp.Generic, tags: [SemanticCallTag.Prints], sig: [['x', ArgProp.Alias | ArgProp.Forced], ['...', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Base, ['message', 'warning']), Identifier.from(['warn', PkgName.Rlang]), Identifier.from(['warn', PkgName.Rutils]), Identifier.from(['info', PkgName.Msgr])], processor: BuiltInProcName.Default, config: { keepArgumentOut: true, hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ }, props: CallProp.Invisible, tags: [SemanticCallTag.Prints], sig: [['...', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['invisible', PkgName.Base])], processor: BuiltInProcName.Default, config: { keepArgumentOut: true, props: CallProp.Pure | CallProp.Invisible, sig: [['x', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: true },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['force', 'identity']), processor: BuiltInProcName.Default, config: { keepArgumentOut: true, props: CallProp.Pure, sig: [['x', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: false },
	// graphics base
	{ type: 'function', names: namespacePlotFunctions(PlotCreate), processor: BuiltInProcName.Default, config: PlotCreateConfig, assumePrimitive: true },
	/* `qplot` creates a plot like the ones above and is deprecated on top of it; registered after them so this
	   definition is the one that sticks */
	{ overrides: true, type: 'function', names: [Identifier.from(['qplot', PkgName.GgPlot2])], processor: BuiltInProcName.Default, config: { ...PlotCreateConfig, tags: [SemanticCallTag.Graphics, SemanticCallTag.Deprecated] as SemanticCallTags }, assumePrimitive: true },
	// graphics addons
	{ overrides: true, type: 'function', names: namespacePlotFunctions(PlotAddons), processor: BuiltInProcName.Default, config: PlotAddonConfig, assumePrimitive: true },
	/* addons ggplot2 deprecated: they still add to a plot, so they keep what the ones above state */
	{ overrides: true, type: 'function', names: Identifier.fromAll(PkgName.GgPlot2, ['coord_map', 'coord_flip', 'annotation_logticks']), processor: BuiltInProcName.Default, config: { ...PlotAddonConfig, tags: [SemanticCallTag.Graphics, SemanticCallTag.Deprecated] as SemanticCallTags }, assumePrimitive: true },
	// plot tags
	{ type: 'function', names: namespacePlotFunctions(GgPlotAddons), processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: { type: 'link-to-last-call', callName: toRegex((GgPlotCreate as readonly string[]).concat(GgPlotAddons)) }, tags: [SemanticCallTag.Graphics], sig: [['...', ArgProp.Forced]] }, assumePrimitive: true },
	{ type: 'function', names: namespacePlotFunctions(TinyPlotAddons), processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: { type: 'link-to-last-call', callName: toRegex([...TinyPlotCrate, ...TinyPlotAddons]) }, tags: [SemanticCallTag.Graphics], sig: [['...', ArgProp.Forced]] }, assumePrimitive: true },
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Magick, ['image_capture']), ...Identifier.fromAll(PkgName.GrDevices, ['dev.capture'])], processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticCallTag.Graphics], sig: [['...', ArgProp.Forced]] }, assumePrimitive: true },
	/* they put what the device holds on disk */
	{ type: 'function', names: [Identifier.from(['image_write', PkgName.Magick])], processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['image', ArgProp.Forced | ArgProp.Value], ['path', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: true },
	{ type: 'function', names: Identifier.fromAll(PkgName.GrDevices, ['dev.off', 'graphics.off']), processor: BuiltInProcName.Default, config: { libFn: true, hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticCallTag.Graphics, SemanticCallTag.Closes, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['...', ArgProp.Forced]] }, assumePrimitive: true },
	{ type: 'function', names: ['('], processor: BuiltInProcName.Default, config: { keepArgumentOut: true, props: CallProp.Pure, sig: [['x', ArgProp.Alias]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Group },
	{ type: 'function', names: [Identifier.from(['load_all', PkgName.PkgLoad]), Identifier.from(['load_all', PkgName.Devtools])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Scope, sig: [['path', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['setwd', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Invisible | CallProp.Ambient | CallProp.Configures, sig: [['dir', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['set.seed', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Invisible | CallProp.Configures, tags: [SemanticCallTag.Random], sig: [['seed', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['body', 'formals']), processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Lang, sig: [['fun', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: true },
	/* `environment()` without an argument is the frame the call sits in, which is how `as.list(environment())` gets at every argument */
	{ type: 'function', names: [Identifier.from(['environment', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, frame: ArgProp.Value, sig: [['fun', ArgProp.Handle | ArgProp.Forced]] }, assumePrimitive: true },
	{
		type:      'function',
		names:     Identifier.fromAll(PkgName.Base, ['.Call', '.External', '.C', '.Fortran']),
		processor: BuiltInProcName.Default,
		config:    {
			hasUnknownSideEffects: true,
			sig:                   [['.NAME', ArgProp.Value | ArgProp.Forced]],
			/* the routine usually comes from useDynLib, but it may be a variable holding a symbol */
			markArgsAsMasked:      NseArguments.First,
			treatAsFnCall:         {
				'.Call':     ['.NAME'],
				'.External': ['.NAME'],
				'.C':        ['.NAME'],
				'.Fortran':  ['.NAME']
			},
			props: CallProp.Ffi
		},
		assumePrimitive: true
	},
	{ type: 'function', names: [Identifier.from(['eval', PkgName.Base])], processor: BuiltInProcName.Eval, config: { includeFunctionCall: true, supportFunctionCall: false, keepEnvironment: true, tags: [SemanticCallTag.Eval], sig: [['expr', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['envir', ArgProp.Forced | ArgProp.Value], ['enclos', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['evalText', PkgName.Soda]), Identifier.from(['evalText', PkgName.FastUtils])], processor: BuiltInProcName.Eval, config: { includeFunctionCall: true, supportFunctionCall: true, keepEnvironment: true, tags: [SemanticCallTag.Eval], sig: [['text', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['envir', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['cat', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ }, props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints], sig: [['...', ArgProp.Value | ArgProp.Forced], ['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['switch', PkgName.Base])], processor: BuiltInProcName.Default, config: { alternativeArgsFrom: 1, useAsProcessor: BuiltInProcName.Switch, props: CallProp.Pure, sig: [['EXPR', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: ['return'], processor: BuiltInProcName.Default, config: { cfg: ExitPointType.Return, keepArgumentOut: true, useAsProcessor: BuiltInProcName.Return, props: CallProp.Pure, sig: [['value', ArgProp.Alias]] }, assumePrimitive: true },
	{
		type:  'function',
		names: [
			Identifier.from(['stop', PkgName.Base]),
			Identifier.from(['abort', PkgName.Rlang]), Identifier.from(['cli_abort', PkgName.Cli]),
			Identifier.from(['throw', PkgName.RmethodsS3]), Identifier.from(['throw', PkgName.Roo]), /* R.oo re-exports R.methodsS3::throw */
			...Identifier.fromAll(PkgName.Purrr, ['stop_bad_type', 'stop_bad_element_type', 'stop_bad_element_length'])
		],
		processor:       BuiltInProcName.Default,
		config:          { useAsProcessor: BuiltInProcName.Stop, cfg: ExitPointType.Error, props: CallProp.Throws, sig: [['...', ArgProp.Forced]] },
		assumePrimitive: false
	},
	/* the block is evaluated whatever happens, the handlers only when something does, and an error keeps the value from coming back */
	{ type: 'function', names: [Identifier.from(['try', PkgName.Base])], processor: BuiltInProcName.Try, config: { block: 'expr', handlers: {}, sig: [['expr', ArgProp.Value | ArgProp.Forced]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['tryCatch', PkgName.Base]), Identifier.from(['tryCatchLog', PkgName.TryCatchLog])], processor: BuiltInProcName.Try, config: { block: 'expr', handlers: { error: 'error', finally: 'finally' }, sig: [['expr', ArgProp.Value | ArgProp.Forced], ['error', ArgProp.Callee], ['finally', ArgProp.Nse]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['stopifnot', PkgName.Base]), Identifier.from(['assert_that', PkgName.AssertThat])], processor: BuiltInProcName.StopIfNot, config: { props: CallProp.Invisible | CallProp.Throws }, assumePrimitive: false },
	{ type: 'function', names: ['break'], processor: BuiltInProcName.Default, config: { useAsProcessor: BuiltInProcName.Break, cfg: ExitPointType.Break }, assumePrimitive: false },
	{ type: 'function', names: ['next'], processor: BuiltInProcName.Default, config: { cfg: ExitPointType.Next }, assumePrimitive: false },
	{ type: 'function', names: ['{'], processor: BuiltInProcName.ExpressionList, config: {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['source', PkgName.Base])],
		/* it hands back what it evaluated invisibly, so a top-level `source()` prints nothing of its own */
		processor:       BuiltInProcName.Source,
		config:          { includeFunctionCall: true, forceFollow:         false, props:               CallProp.Invisible, tags:                [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:                 [['file', ArgProp.Forced | ArgProp.Resource], ['local', ArgProp.Forced | ArgProp.Flag], ['echo', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['sys.source', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource], ['envir', ArgProp.Forced | ArgProp.Written]] }, assumePrimitive: false },
	{ type: 'function', names: ['['], processor: BuiltInProcName.Access, config: { treatIndicesAsString: false, props: CallProp.Pure, sig: [['x', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: ['[['], processor: BuiltInProcName.Access, config: { treatIndicesAsString: false, resolveField: true, props: CallProp.Pure, sig: [['x', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: true },
	/* the field is a name rather than a value, so it is never evaluated */
	{ type: 'function', names: ['$', '@'], processor: BuiltInProcName.Access, config: { treatIndicesAsString: true, resolveField: true, props: CallProp.Pure, sig: [['x', ArgProp.Value], ['name', ArgProp.Nse]] }, assumePrimitive: true },
	{ type: 'function', names: ['::'], processor: BuiltInProcName.NamespaceAccess, config: { internal: false }, assumePrimitive: true },
	{ type: 'function', names: [':::'], processor: BuiltInProcName.NamespaceAccess, config: { internal: true }, assumePrimitive: true },
	{ type: 'function', names: ['if'], processor: BuiltInProcName.IfThenElse, config: {}, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['ifelse', PkgName.Base]), Identifier.from(['fifelse', PkgName.DataTable]), Identifier.from(['IfElse', PkgName.Functools])], processor: BuiltInProcName.IfThenElse, config: { args: { cond: 'test', yes: 'yes', no: 'no' }, props: CallProp.Pure }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['if_else', PkgName.Dplyr])], processor: BuiltInProcName.IfThenElse, config: { args: { cond: 'condition', yes: 'true', no: 'false' }, props: CallProp.Pure }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['get', PkgName.Base])], processor: BuiltInProcName.Get, config: { props: CallProp.Pure, tags: [SemanticCallTag.Eval], sig: [['x', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['pos', ArgProp.Flag], ['envir', ArgProp.Forced | ArgProp.Value], ['mode', ArgProp.Forced | ArgProp.Flag], ['inherits', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['get0', PkgName.Base])], processor: BuiltInProcName.Get, config: { props: CallProp.Pure, tags: [SemanticCallTag.Eval], sig: [['x', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['envir', ArgProp.Forced | ArgProp.Value], ['mode', ArgProp.Forced | ArgProp.Flag], ['inherits', ArgProp.Forced | ArgProp.Flag], ['ifnotfound', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['match.fun', PkgName.Base])], processor: BuiltInProcName.Get, config: { props: CallProp.Pure, tags: [SemanticCallTag.Eval], sig: [['FUN', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['descend', ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['library', 'require']), processor: BuiltInProcName.Library, config: { props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['attachNamespace', PkgName.Base])], processor: BuiltInProcName.Library, config: { characterOnly: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['requireNamespace', 'loadNamespace']), processor: BuiltInProcName.Library, config: { namespaceOnly: true, characterOnly: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['from', PkgName.Import])], processor: BuiltInProcName.Library, config: { fromImports: true, props: CallProp.Scope }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['use', PkgName.Box]), Identifier.from(['use', PkgName.Base])], processor: BuiltInProcName.Library, config: { boxUse: true, props: CallProp.Scope }, assumePrimitive: false },
	{ type: 'function', names: ['<-', '='], processor: BuiltInProcName.Assignment, config: { canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from([':=', PkgName.DataTable])], processor: BuiltInProcName.Assignment, config: { props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['assign', PkgName.Base])], processor: BuiltInProcName.Assignment, config: { targetVariable: true, mayHaveMoreArgs: true, environmentArg: 'envir', props: CallProp.Scope | CallProp.Invisible, sig: [['x', ArgProp.Value], ['value', ArgProp.Value], ['pos', ArgProp.Flag], ['envir', ArgProp.Written], ['inherits', ArgProp.Flag]] }, assumePrimitive: true },
	{ type:      'function', names:     [Identifier.from(['setValidity', PkgName.Methods])],
		processor: BuiltInProcName.ClassRelation,
		config:    {
			assignment: { targetVariable: true, mayHaveMoreArgs: true, environmentArg: 'envir' },
			/* `setValidity(Class, method)` attributes the validator to the class it names, not to a binding */
			classDecl:  { system: ClassSystem.S4, nameArg: { idx: 0, name: 'Class' }, relation: 'validity' },
			props:      CallProp.Scope | CallProp.Invisible
		}, assumePrimitive: true },
	{ type:      'function', names:     [Identifier.from(['setIs', PkgName.Methods])],
		processor: BuiltInProcName.ClassRelation,
		config:    {
			/* `setIs(class1, class2)` states the same is-a relation `contains` does, after the fact */
			classDecl: { system: ClassSystem.S4, nameArg: { idx: 0, name: 'class1' }, containsArg: { idx: 1, name: 'class2' }, relation: 'is' },
			props:     CallProp.Scope | CallProp.Invisible
		}, assumePrimitive: true },
	{ type:      'function', names:     [Identifier.from(['setMethod', PkgName.Methods])],
		processor: BuiltInProcName.ClassRelation,
		config:    {
			assignmentLike: { targetVariable: true, canBeReplacement: false, target: { idx: 0, name: 'f' }, source: { idx: 2, name: 'definition' }, modesForFn: ['s4'] },
			/* a method answers an existing generic for existing classes, both named by string rather than bound */
			genericArg:     { idx: 0, name: 'f' },
			classArgs:      [{ idx: 1, name: 'signature' }]
		}, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['delayedAssign', PkgName.Base])], processor: BuiltInProcName.Assignment, config: { quoteSource: true, targetVariable: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true },
	{ type: 'function', names: ['<<-'], processor: BuiltInProcName.Assignment, config: { superAssignment: true, canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type: 'function', names: ['->'], processor: BuiltInProcName.Assignment, config: { swapSourceAndTarget: true, canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type: 'function', names: ['->>'], processor: BuiltInProcName.Assignment, config: { superAssignment: true, swapSourceAndTarget: true, canBeReplacement: true, props: CallProp.Scope | CallProp.Invisible }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['data', PkgName.Utils]), Identifier.from(['getHdata', PkgName.Hmisc])], processor: BuiltInProcName.DefineArgument, config: { superAssignment: true }, assumePrimitive: false },
	/* only `&&`/`||` short-circuit */
	{ type: 'function', names: [Identifier.from(['&&', PkgName.Base])], processor: BuiltInProcName.SpecialBinOp, config: { lazy: true, evalRhsWhen: true, props: CallProp.Pure }, assumePrimitive: true, evalHandler: BuiltInEvalName.Logical },
	{ type: 'function', names: [Identifier.from(['||', PkgName.Base])], processor: BuiltInProcName.SpecialBinOp, config: { lazy: true, evalRhsWhen: false, props: CallProp.Pure }, assumePrimitive: true, evalHandler: BuiltInEvalName.Logical },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['&', '|']), processor: BuiltInProcName.SpecialBinOp, config: { lazy: false, props: CallProp.Pure }, assumePrimitive: true, evalHandler: BuiltInEvalName.Logical },
	/* a pipe hands back what the side it feeds hands back, which `Alias` is what states */
	{ type: 'function', names: ['|>'], processor: BuiltInProcName.Pipe, config: { pipePlaceholderName: '_', assignLhs: false, returnLhs: false, sig: [['lhs', ArgProp.Value], ['rhs', ArgProp.Alias]] }, assumePrimitive: true },
	{ type: 'function', names: [...Identifier.fromAllIn(MagrittrPipePackages, ['%>%']), '%!>%'], processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: false, returnLhs: false, rhsMightBeSymbol: true, sig: [['lhs', ArgProp.Value], ['rhs', ArgProp.Alias]] }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['%<>%', PkgName.Magrittr])],        processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: true, returnLhs: false, rhsMightBeSymbol: true, props: CallProp.Invisible | CallProp.Scope }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['%T>%', PkgName.Magrittr])],        processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: false, returnLhs: true, rhsMightBeSymbol: true, sig: [['lhs', ArgProp.Alias], ['rhs', ArgProp.Value]] }, assumePrimitive: true  },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['map', 'map_lgl', 'map_int', 'map_dbl', 'map_chr']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress'] } },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['pmap', 'pmap_lgl', 'pmap_int', 'pmap_dbl', 'pmap_chr']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.l': { index: 0, name: '.l' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress'] } },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['map2', 'map2_lgl', 'map2_int', 'map2_dbl', 'map2_chr']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } }, '.f': { index: 2, name: '.f' }, ignore: ['.progress'] } },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['modify', 'imodify', 'imap', 'imap_lgl', 'imap_int', 'imap_dbl', 'imap_chr', 'imap_vec', 'lmap']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: [] } },
	{ type: 'function', names: [Identifier.from(['modify2', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } }, '.f': { index: 2, name: '.f' }, ignore: [] } },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['map_at', 'modify_at']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.at': { index: 1, name: '.at' } }, '.f': { index: 2, name: '.f' }, ignore: ['.progress'] } },
	{ type: 'function', names: [Identifier.from(['lmap_at', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.at': { index: 1, name: '.at' } }, '.f': { index: 2, name: '.f' }, ignore: [] } },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['map_if', 'modify_if', 'lmap_if']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.p': { index: 1, name: '.p' } }, '.f': { index: 2, name: '.f' }, ignore: ['.else'] } },
	{ type: 'function', names: [Identifier.from(['walk', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress'], returnArg: '.x' } },
	{ type: 'function', names: [Identifier.from(['iwalk', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: [], returnArg: '.x' } },
	{ type: 'function', names: [Identifier.from(['pwalk', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.l': { index: 0, name: '.l' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress'], returnArg: '.l' } },
	{ type: 'function', names: [Identifier.from(['walk2', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } }, '.f': { index: 2, name: '.f' }, ignore: ['.progress'], returnArg: '.x' } },
	{ type: 'function', names: [Identifier.from(['map_vec', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress', '.ptype'] } },
	{ type: 'function', names: [Identifier.from(['pmap_vec', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.l': { index: 0, name: '.l' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress', '.ptype'] } },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['map_depth', 'modify_depth']), processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.depth': { index: 2, name: '.depth' } }, '.f': { index: 2, name: '.f' }, ignore: ['.ragged', '.is_node'] } },
	{ type: 'function', names: [Identifier.from(['map2_vec', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } }, '.f': { index: 2, name: '.f' }, ignore: ['.progress', '.ptype'] } },
	{ type: 'function', names: [Identifier.from(['across', PkgName.Dplyr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.cols' } }, '.f': { index: 1, name: '.fns' }, ignore: ['.names', '.unpack'] } },
	{ type: 'function', names: [Identifier.from(['rename_with', PkgName.Dplyr])], processor: BuiltInProcName.PurrrFormula, config: { args: { '.x': { index: 0, name: '.data' } }, '.f': { index: 1, name: '.fn' }, ignore: ['.cols'] } },
	{ type: 'function', names: ['function', '\\'], processor: BuiltInProcName.FunctionDefinition, config: {}, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['quote', PkgName.Base])], processor: BuiltInProcName.Quote, config: { quoteArgumentsWithIndex: 0, keepEnvironment: true, props: CallProp.Lang, sig: [['expr', ArgProp.Nse]] }, assumePrimitive: true },
	/* `bquote` evaluates the operand of `.()` */
	{ type: 'function', names: [Identifier.from(['bquote', PkgName.Base])], processor: BuiltInProcName.Quote, config: { quoteArgumentsWithIndex: 0, unquote: Unquote.Bquote, keepEnvironment: true, props: CallProp.Lang, sig: [['expr', ArgProp.Nse]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['substitute', PkgName.Base])], processor: BuiltInProcName.Quote, config: { quoteArgumentsWithIndex: 0, envArgIndex: 1, keepEnvironment: true, props: CallProp.Lang, sig: [['expr', ArgProp.Nse], ['env', ArgProp.Value]] }, assumePrimitive: true },
	/* the rlang functions that capture unevaluated, the rest take a value */
	{ type: 'function', names: [...Identifier.fromAllIn(TidyEvalPackages, ['quo', 'quos', 'expr']), Identifier.from(['exprs', PkgName.Rlang])], processor: BuiltInProcName.Quote, config: { quoteArgumentsWithIndex: 0, unquote: Unquote.Rlang, keepEnvironment: true, libFn: true, props: CallProp.Lang }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['exec', PkgName.Rlang])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: '.fn', unquoteFunction: true, hasUnknownSideEffects: true, libFn: true, props: CallProp.MayPure, sig: [['.fn', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Purrr, ['invoke', 'invoke_map']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, nameOfFunctionArgument: '.f', unquoteFunction: true, hasUnknownSideEffects: true, libFn: true, props: CallProp.MayPure, tags: [SemanticCallTag.Deprecated], sig: [['.f', ArgProp.Callee], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Glue, ['glue', 'glue_safe', 'glue_collapse']), Identifier.from(['str_glue', PkgName.Stringr])], processor: BuiltInProcName.StringTemplate, config: { props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Cli, ['cli_text', 'cli_alert', 'cli_alert_info', 'cli_alert_success', 'cli_alert_warning', 'cli_alert_danger', 'cli_h1', 'cli_h2', 'cli_h3', 'cli_li', 'cli_bullets', 'cli_inform', 'cli_warn', 'format_inline', 'cli_verbatim']), processor: BuiltInProcName.StringTemplate, config: { markup: true, props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['str_interp', PkgName.Stringr])], processor: BuiltInProcName.StringTemplate, config: { open: '${', props: CallProp.MayPure, tags: [SemanticCallTag.Deprecated] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['gstring', PkgName.Rutils])], processor: BuiltInProcName.StringTemplate, config: { open: '${', props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Wrapr, ['sinterp', 'si']), processor: BuiltInProcName.StringTemplate, config: { open: '.(', close: ')', props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Stringmagic, ['string_magic', '.string_magic', 'sma']), processor: BuiltInProcName.StringTemplate, config: { props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['whisker.render', PkgName.Whisker])], processor: BuiltInProcName.StringTemplate, config: { open: '{{', close: '}}', props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['brew', PkgName.Brew])], processor: BuiltInProcName.StringTemplate, config: { open: '<%=', close: '%>', props: CallProp.MayPure }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['rprintf', PkgName.Rprintf])], processor: BuiltInProcName.StringTemplate, config: { open: '$', close: '', props: CallProp.MayPure }, assumePrimitive: false },
	/* `local(expr)` evaluates `expr` in a frame of its own and hands its value back */
	{ type: 'function', names: [Identifier.from(['local', PkgName.Base])], processor: BuiltInProcName.Local, config: { args: { env: 'envir', expr: 'expr' }, sig: [['expr', ArgProp.Alias | ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['with', 'within']), processor: BuiltInProcName.With, config: {}, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['new.env', PkgName.Base]), Identifier.from(['new_environment', PkgName.Rlang])], processor: BuiltInProcName.NewEnv, config: {}, assumePrimitive: true },
	{ type:      'function', names:     [Identifier.from(['R6Class', PkgName.R6])],
		processor: BuiltInProcName.ClassGenerator,
		config:    { classDecl: {
			system:      ClassSystem.R6,
			nameArg:     { idx: 0, name: 'classname' },
			/* R6 inherits from the *generator object*, so the superclass arrives as a variable, not a string */
			containsArg: { name: 'inherit' },
			memberArgs:  [
				{ idx: 1, name: 'public', visibility: MemberVisibility.Public },
				{ name: 'private', visibility: MemberVisibility.Private },
				{ name: 'active', visibility: MemberVisibility.Active }
			]
		} }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['setRefClass', PkgName.Methods])], processor: BuiltInProcName.ClassGenerator, config: { classDecl: { system: ClassSystem.RefClass, nameArg: { idx: 0, name: 'Class' }, containsArg: { idx: 2, name: 'contains' }, memberArgs: [{ idx: 1, name: 'fields', typed: true }, { idx: 3, name: 'methods', methods: true }] } }, assumePrimitive: false },
	/* env-returning builtins pointing into the current search-path stack (`e <- globalenv(); e$x`) */
	{ type:  'function', names: Object.entries(StackEnvBuiltins)
		.filter(([n, kind]) => !n.startsWith('.') && (kind === StackEnvKind.Global || kind === StackEnvKind.Base || kind === StackEnvKind.Empty))
		.map(([n]) => Identifier.from([n, PkgName.Base])),
	processor: BuiltInProcName.StackEnv, config: {}, assumePrimitive: true },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['parent.env', 'parent.frame', 'environmentName', 'as.environment', 'pos.to.env', 'topenv']), processor: BuiltInProcName.Default, config: {}, assumePrimitive: true },
	/* `sys.frame(sys.nframe())` is the own frame written the long way round, and its values are there to be read */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['sys.frame', 'sys.frames']), processor: BuiltInProcName.Default, config: { frame: ArgProp.Value }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['load', PkgName.Base])], processor: BuiltInProcName.Load, config: { props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	/* attach injects an environment's contents into the search path; detach reverses it (treated as unknown side effect) */
	{ type: 'function', names: [Identifier.from(['attach', PkgName.Base])], processor: BuiltInProcName.Attach, config: {}, assumePrimitive: false },
	{ type: 'function', names: ['for'],    processor: BuiltInProcName.ForLoop,    config: {}, assumePrimitive: true },
	{ type: 'function', names: ['repeat'], processor: BuiltInProcName.RepeatLoop, config: {}, assumePrimitive: true },
	{ type: 'function', names: ['while'],  processor: BuiltInProcName.WhileLoop,  config: {}, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['do.call', PkgName.Base])], processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, unquoteFunction: true, props: CallProp.MayPure, tags: [SemanticCallTag.Eval], sig: [['what', ArgProp.Forced | ArgProp.Callee | ArgProp.Injectable], ['args', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['UseMethod', PkgName.Base])], processor: BuiltInProcName.S3Dispatch, config: { args: { generic: 'generic', object: 'object' }, props: CallProp.Generic }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['NextMethod', PkgName.Base])], processor: BuiltInProcName.S3Dispatch, config: { args: { generic: 'generic', object: 'object' }, inferFromClosure: true, props: CallProp.Generic }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['new_generic', PkgName.S7])], processor: BuiltInProcName.S7NewGeneric, config: { args: { name: 'name', dispatchArg: 'dispatch_args', fun: 'fun' } }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['setGeneric', PkgName.Methods])], processor: BuiltInProcName.S7NewGeneric, config: { args: { name: 'name', dispatchArg: undefined, fun: 'fun' }, binds: true }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['S7_dispatch', PkgName.S7])], processor: BuiltInProcName.S7Dispatch, config: { libFn: true }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['make_constructor', PkgName.GgPlot2]), Identifier.from(['new_class', PkgName.S7])], processor: BuiltInProcName.S7MakeConstructor, config: { mode: ['s7'], classDecl: { system: ClassSystem.S7, nameArg: { idx: 0, name: 'name' }, containsArg: { idx: 1, name: 'parent' }, memberArgs: [{ name: 'properties', typed: true }], virtualArg: { name: 'abstract' } } }, assumePrimitive: true },
	/* S4 keeps its classes and generics in string-keyed registries, so a call naming one depends on whatever registered it */
	{ type: 'function', names: [Identifier.from(['new', PkgName.Methods])], processor: BuiltInProcName.S4Use, config: { classArgs: [{ idx: 0, name: 'Class' }] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Methods, ['getClass', 'getClassDef', 'getSlots', 'slotNames', 'isVirtualClass', 'removeClass', 'resetClass', 'getValidity']), processor: BuiltInProcName.S4Use, config: { classArgs: [{ idx: 0, name: 'Class' }] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['as', PkgName.Methods])], processor: BuiltInProcName.S4Use, config: { classArgs: [{ idx: 1, name: 'Class' }] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['is', PkgName.Methods])], processor: BuiltInProcName.S4Use, config: { classArgs: [{ idx: 1, name: 'class2' }] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['setAs', PkgName.Methods])], processor: BuiltInProcName.S4Use, config: { classArgs: [{ idx: 0, name: 'from' }], registersArg: { idx: 1, name: 'to' } }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Methods, ['existsMethod', 'hasMethod', 'getMethod', 'selectMethod', 'removeMethod']), processor: BuiltInProcName.S4Use, config: { genericArg: { idx: 0, name: 'f' }, classArgs: [{ idx: 1, name: 'signature' }] }, assumePrimitive: false },
	{ type:      'function', names:     [Identifier.from(['setClass', PkgName.Methods])],
		processor: BuiltInProcName.S7MakeConstructor,
		config:    { mode:      ['s4'], classDecl: {
			system:       ClassSystem.S4,
			nameArg:      { idx: 0, name: 'Class' },
			containsArg:  { name: 'contains' },
			/* the modern `slots=` and the historical `representation()` state the same thing */
			memberArgs:   [{ idx: 1, name: 'representation', typed: true }, { name: 'slots', typed: true }],
			prototypeArg: { idx: 2, name: 'prototype' }
		} }, assumePrimitive: true },
	{ type:      'function', names:     [Identifier.from(['setClassUnion', PkgName.Methods])],
		processor: BuiltInProcName.S7MakeConstructor,
		config:    { mode:      ['s4'], classDecl: {
			system:   ClassSystem.S4,
			nameArg:  { idx: 0, name: 'name' },
			/* a union is a virtual class its members become subclasses of */
			unionArg: { idx: 1, name: 'members' }
		} }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['Negate', PkgName.Base])],    processor: BuiltInProcName.S7MakeConstructor, config: { wrapIndex: 0, props: CallProp.Pure, sig: [['f', ArgProp.Callee]] },   assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['Vectorize', PkgName.Base])], processor: BuiltInProcName.S7MakeConstructor, config: { wrapIndex: 0, props: CallProp.Pure, sig: [['FUN', ArgProp.Callee]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['partial', PkgName.Purrr])], processor: BuiltInProcName.S7MakeConstructor, config: { wrapIndex: 0, wrapName: '.f' }, assumePrimitive: true },
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['.Primitive', '.Internal']), processor: BuiltInProcName.Apply, config: { indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['interference', PkgName.Inferference])], processor: BuiltInProcName.Apply, config: { unquoteFunction: true, nameOfFunctionArgument: 'propensity_integrand', libFn: true }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['ddply', PkgName.Plyr])], processor: BuiltInProcName.Apply, config: { unquoteFunction: true, indexOfFunction: 2, nameOfFunctionArgument: '.fun', libFn: true }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['list', PkgName.Base])], processor: BuiltInProcName.List, config: { props: CallProp.Pure, sig: [['...', ArgProp.Value]] }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['Recall', PkgName.Base])], processor: BuiltInProcName.Recall, config: { libFn: true }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['sys.function', PkgName.Base])], processor: BuiltInProcName.Recall, config: { libFn: true, unknownOnNonZeroArg: true, props: CallProp.Lang, frame: ArgProp.Nse }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['c', PkgName.Base])], processor: BuiltInProcName.Vector, config: { props: CallProp.Pure, sig: [['...', ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.Vector },
	{ type: 'function', names: [Identifier.from(['cmpfun', PkgName.Compiler])], processor: BuiltInProcName.Default, config: { sig: [['f', ArgProp.Alias]] } },
	{ type: 'function', names: [Identifier.from(['compile', PkgName.Compiler])], processor: BuiltInProcName.Default, config: { sig: [['e', ArgProp.Alias]] } },
	{ type: 'function', names: [Identifier.from(['loadcmp', PkgName.Compiler])],                                                processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true } },
	{ type: 'function', names: [Identifier.from(['setnames', PkgName.DataTable]), Identifier.from(['setNames', PkgName.Base]), Identifier.from(['setNames', PkgName.FastUtils]), ...Identifier.fromAll(PkgName.DataTable, ['setkey', 'setkeyv', 'setindex', 'setindexv', 'setattr'])], processor: BuiltInProcName.Assignment, config: { canBeReplacement: false, targetVariable: false, makeMaybe: true, mayHaveMoreArgs: true } },
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
	{ type: 'function', names: [Identifier.from(['dir.create', PkgName.Base]), Identifier.from(['dir_create', PkgName.Fs]), ...Identifier.fromAll(PkgName.Base, ['Sys.chmod', 'unlink', 'file.remove', 'file.rename', 'file.copy', 'file.link', 'file.append', 'Sys.junction'])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes] }, assumePrimitive: false },
	/* `sink` diverts the output, `par`/`tpar` set the parameters of the current device */
	{ type: 'function', names: [Identifier.from(['sink', PkgName.Base])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['file', ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['par', PkgName.Graphics]), Identifier.from(['tpar', PkgName.TinyPlot])], processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true, tags: [SemanticCallTag.Graphics] }, assumePrimitive: false },
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
			...['install_github', 'install_gitlab', 'install_bitbucket', 'install_url', 'install_git', 'install_svn', 'install_version',
				'install_bioc', 'install_cran', 'install_dev', 'update_packages']
				.flatMap(f => [Identifier.from([f, PkgName.Remotes]), Identifier.from([f, PkgName.Devtools])]),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true, libFn: true, props: CallProp.Invisible, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes] },
		assumePrimitive: false
	},
	{ type: 'function', names: [Identifier.from(['on.exit', PkgName.Base])], processor: BuiltInProcName.RegisterHook, config: { hook: KnownHooks.OnFnExit, args: { expr: { idx: 0, name: 'expr' }, add: { idx: 1, name: 'add', default: false }, after: { idx: 2, name: 'after', default: true } } }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['on_load', PkgName.Rlang])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: [['expr', ArgProp.Forced], ['env', ArgProp.Value], ['ns', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['on_package_load', PkgName.Rlang])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: [['pkg', ArgProp.Value], ['expr', ArgProp.Forced], ['env', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['run_on_load', PkgName.Rlang])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: [['ns', ArgProp.Value]] }, assumePrimitive: false },
	/* `parse(text=)` turns text into an expression, with `file=` it reads that file */
	{ type: 'function', names: [Identifier.from(['parse', PkgName.Base])], processor: BuiltInProcName.Default, config: { props: CallProp.Pure, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* they answer with whatever is on disk when they run */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['list.files', 'dir', 'list.dirs']), processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Glob], sig: [['path', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['Sys.glob', PkgName.Base])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Glob], sig: [['paths', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	/* language objects */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['enquote', 'call', 'as.call', 'as.expression', 'as.name', 'as.symbol', 'as.language', 'args', 'deparse', 'deparse1']), processor: BuiltInProcName.Default, config: { props: CallProp.Lang, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* they hand back the call they sit in, so the function around them reads its arguments as written, unevaluated */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['match.call', 'sys.call', 'sys.calls']), processor: BuiltInProcName.Default, config: { props: CallProp.Lang, frame: ArgProp.Nse, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* `nargs()` counts what the call supplied, so it sees no argument, only whether there was one */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['nargs', 'sys.nframe']), processor: BuiltInProcName.Default, config: { props: CallProp.Lang, frame: ArgProp.Presence, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* `alist` keeps its arguments unevaluated, `evalq` evaluates its first one in another frame */
	{ type: 'function', names: [Identifier.from(['alist', PkgName.Base])], processor: BuiltInProcName.Default, config: { props: CallProp.Lang, sig: [['...', ArgProp.Nse]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['evalq', PkgName.Base])], processor: BuiltInProcName.Default, config: { props: CallProp.Lang, tags: [SemanticCallTag.Eval], sig: [['expr', ArgProp.Nse | ArgProp.Injectable], ['envir', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['eval.parent', PkgName.Base])], processor: BuiltInProcName.Default, config: { props: CallProp.Lang, tags: [SemanticCallTag.Eval], sig: [['expr', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['n', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['eval_tidy', PkgName.Rlang])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Lang, tags: [SemanticCallTag.Eval], sig: [['expr', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['data', ArgProp.Forced | ArgProp.Value], ['env', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['eval_bare', PkgName.Rlang])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Lang, tags: [SemanticCallTag.Eval], sig: [['expr', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['env', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [...Identifier.fromAllIn(TidyEvalPackages, ['enexpr', 'enexprs', 'enquo', 'enquos', 'ensym', 'ensyms', 'sym', 'syms', 'quo_name', 'as_label']), ...Identifier.fromAll(PkgName.Rlang, ['inject', 'enquo0', 'enquos0', 'new_formula', 'f_rhs', 'f_lhs', 'fn_body', 'fn_fmls', 'fn_fmls_names', 'call2', 'as_name', 'as_string'])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Lang, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* native code */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['dyn.load', 'getNativeSymbolInfo']), processor: BuiltInProcName.Default, config: { props: CallProp.Ffi, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['sourceCpp', PkgName.Rcpp])], processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Ffi, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['file', ArgProp.Forced | ArgProp.Resource]] }, assumePrimitive: false },
	/* ambient state: options, environment variables, the clock, the session itself */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['getOption', 'Sys.getenv', 'Sys.info', 'Sys.getpid', 'getwd', 'getRversion', 'R.Version', 'Sys.time', 'Sys.Date', 'Sys.timezone', 'date', 'proc.time', 'interactive']), processor: BuiltInProcName.Default, config: { props: CallProp.Ambient, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['commandArgs', PkgName.Base])], processor: BuiltInProcName.Default, config: { props: CallProp.Ambient, tags: [SemanticCallTag.CommandLine], sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* system commands */
	{ type: 'function', names: [Identifier.from(['system', PkgName.Base])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.Process], sig: [['command', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['intern', ArgProp.Forced | ArgProp.Flag], ['ignore.stdout', ArgProp.Forced | ArgProp.Flag], ['ignore.stderr', ArgProp.Forced | ArgProp.Flag], ['wait', ArgProp.Forced | ArgProp.Flag], ['input', ArgProp.Forced | ArgProp.Value], ['show.output.on.console', ArgProp.Flag], ['minimized', ArgProp.Flag], ['invisible', ArgProp.Flag], ['timeout', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['system2', PkgName.Base])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.Process], sig: [['command', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['args', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['stdout', ArgProp.Forced | ArgProp.Value], ['stderr', ArgProp.Forced | ArgProp.Value], ['stdin', ArgProp.Value], ['input', ArgProp.Forced | ArgProp.Value], ['env', ArgProp.Forced | ArgProp.Value], ['wait', ArgProp.Forced | ArgProp.Flag], ['minimized', ArgProp.Flag], ['invisible', ArgProp.Flag], ['timeout', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['shell', PkgName.Base])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.Process], sig: [['cmd', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['shell', ArgProp.Forced | ArgProp.Value], ['flag', ArgProp.Forced | ArgProp.Value], ['intern', ArgProp.Forced | ArgProp.Flag], ['wait', ArgProp.Forced | ArgProp.Flag], ['translate', ArgProp.Forced | ArgProp.Flag], ['mustWork', ArgProp.Flag], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['shell.exec', PkgName.Base])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.Process], sig: [['file', ArgProp.Forced | ArgProp.Resource | ArgProp.Injectable]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['pipe', PkgName.Base])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.Opens, SemanticCallTag.Process], sig: [['description', ArgProp.Forced | ArgProp.Resource | ArgProp.Injectable], ['open', ArgProp.Forced | ArgProp.Flag], ['encoding', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Processx, ['run', 'process']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Process], sig: [['command', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['args', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Sys, ['exec_wait', 'exec_internal', 'exec_background']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Process], sig: [['cmd', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['args', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable]] }, assumePrimitive: false },
	{ type: 'function', names: Identifier.fromAll(PkgName.Dbi, ['dbGetQuery', 'dbSendQuery', 'dbSendStatement', 'dbExecute']), processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Database], sig: [['conn', ArgProp.Forced | ArgProp.Handle], ['statement', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['sqldf', PkgName.Sqldf])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Database], sig: [['x', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['stringsAsFactors', ArgProp.Forced | ArgProp.Flag], ['row.names', ArgProp.Forced | ArgProp.Flag], ['envir', ArgProp.Forced | ArgProp.Value], ['method', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['sql', PkgName.Dplyr]), Identifier.from(['sql', PkgName.DbPlyr])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Database], sig: [['...', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['HTML', PkgName.Shiny]), Identifier.from(['HTML', PkgName.HtmlTools])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Html], sig: [['text', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['insertUI', PkgName.Shiny])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Html], sig: [['selector', ArgProp.Forced | ArgProp.Value], ['where', ArgProp.Forced | ArgProp.Flag], ['ui', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['immediate', ArgProp.Forced | ArgProp.Flag], ['session', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['JS', PkgName.HtmlWidgets])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.JavaScript], sig: [['...', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['runjs', PkgName.ShinyJs])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.JavaScript], sig: [['code', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['html', PkgName.ShinyJs])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.Html], sig: [['id', ArgProp.Forced | ArgProp.Value], ['html', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['add', ArgProp.Forced | ArgProp.Flag], ['selector', ArgProp.Forced | ArgProp.Value], ['asis', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['extendShinyjs', PkgName.ShinyJs])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.JavaScript, SemanticCallTag.File, SemanticCallTag.Reads], sig: [['script', ArgProp.Forced | ArgProp.Resource], ['text', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['functions', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/* whatever the user types, picks, or sends along with a request */
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Base, ['readline', 'file.choose']), ...Identifier.fromAll(PkgName.Utils, ['askYesNo', 'choose.files', 'choose.dir', 'menu', 'select.list', 'winDialogString', 'winDialog'])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.User], sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
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
		config:          { libFn: true, tags: [SemanticCallTag.User], sig: [['...', ArgProp.Forced]] },
		assumePrimitive: false
	},
	/* they only make up a path, they do not go near the file system, so `File` would be wrong here */
	{ type: 'function', names: Identifier.fromAll(PkgName.Base, ['tempfile', 'tempdir']), processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.TempFile], sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	{ type: 'function', names: [...Identifier.fromAll(PkgName.Fs, ['file_temp', 'path_temp', 'dir_temp']), ...Identifier.fromAll(PkgName.Withr, ['local_tempfile', 'with_tempfile', 'local_tempdir', 'with_tempdir'])], processor: BuiltInProcName.Default, config: { libFn: true, tags: [SemanticCallTag.TempFile], sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* wrappers that run the expression they are handed; `observe`/`render*` are left out, they yield a handle instead */
	{ type: 'function', names: Identifier.fromAll(PkgName.Shiny, ['reactive', 'eventReactive', 'bindEvent', 'bindCache', 'isolate', 'req', 'debounce', 'throttle', 'reactiveVal', 'reactiveValues', 'reactiveValuesToList', 'freezeReactiveVal']), processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.MayPure, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* assembling a cohort keeps the data of its source; `filter` is registered above, dplyr holds that name */
	{ type: 'function', names: Identifier.fromAll(PkgName.CohortBuilder, ['cohort', 'set_source', 'add_source', 'update_source', 'add_filter', 'update_filter', 'rm_filter', 'bind_key', 'bind_keys', 'as.tblist', 'tblist', 'step', 'add_step', 'rm_step', 'run', 'restore']), processor: BuiltInProcName.Default, config: { libFn: true, props: CallProp.Pure, sig: [['...', ArgProp.Forced]] }, assumePrimitive: false },
	/* they are all mapped to `<-` but we separate super assignments */
	{ type: 'replacement', suffixes: ['<-', '<<-'], names: ['[', '[[', ...Identifier.fromAll(PkgName.Base, ['names', 'dimnames', 'attributes', 'attr', 'class', 'levels', 'rownames', 'colnames', 'body', 'environment', 'formals', 'length', 'dim'])], config: { readIndices: true, props: CallProp.Scope } },
	{ type: 'replacement', suffixes: ['<-', '<<-'], names: [Identifier.from(['method', PkgName.S7])], config: { readIndices: true, constructName: 's7' } },
	{ type: 'replacement', suffixes: ['<-', '<<-'], names: ['$', '@'], config: { readIndices: false, props: CallProp.Scope } },
	/* the string and shape functions R declares formals for, restated one by one: the group above gives them
	   what they do, this gives them the arguments they do it with (the names are R's own) */
	{ overrides: true, type: 'function', names: [Identifier.from(['sprintf', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['fmt', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['format', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: SigXDots }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['grep', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['pattern', ArgProp.Forced | ArgProp.Value], ['x', ArgProp.Forced | ArgProp.Value], ['ignore.case', ArgProp.Forced | ArgProp.Flag], ['perl', ArgProp.Forced | ArgProp.Flag], ['value', ArgProp.Forced | ArgProp.Flag], ['fixed', ArgProp.Forced | ArgProp.Flag], ['useBytes', ArgProp.Forced | ArgProp.Flag], ['invert', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: Identifier.fromAll(PkgName.Base, ['sub', 'gsub']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['pattern', ArgProp.Forced | ArgProp.Value], ['replacement', ArgProp.Forced | ArgProp.Value], ['x', ArgProp.Forced | ArgProp.Value], ['ignore.case', ArgProp.Forced | ArgProp.Flag], ['perl', ArgProp.Forced | ArgProp.Flag], ['fixed', ArgProp.Forced | ArgProp.Flag], ['useBytes', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['substr', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['start', ArgProp.Forced | ArgProp.Value], ['stop', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['substring', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['text', ArgProp.Forced | ArgProp.Value], ['first', ArgProp.Forced | ArgProp.Value], ['last', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['strsplit', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['split', ArgProp.Forced | ArgProp.Value], ['fixed', ArgProp.Forced | ArgProp.Flag], ['perl', ArgProp.Forced | ArgProp.Flag], ['useBytes', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['trimws', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['which', ArgProp.Forced | ArgProp.Flag], ['whitespace', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	{ overrides: true, type: 'function', names: [Identifier.from(['strtoi', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['base', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['matrix', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['data', ArgProp.Forced | ArgProp.Value], ['nrow', ArgProp.Forced | ArgProp.Value], ['ncol', ArgProp.Forced | ArgProp.Value], ['byrow', ArgProp.Forced | ArgProp.Flag], ['dimnames', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },

	/* the tidyverse verbs, under the names R declares them with. They keep the data mask the group above
	   gives them; what this adds is which argument is the data and what the further ones are called */
	{ overrides: true, type: 'function', names: Identifier.fromAll(PkgName.Dplyr, ['mutate', 'select', 'rename']), processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: SigDataDots }, assumePrimitive: false },
	/* `transmute` is one of them and deprecated on top of it */
	{ overrides: true, type: 'function', names: [Identifier.from(['transmute', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Deprecated], sig: SigDataDots }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['filter', PkgName.Stats])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['filter', ArgProp.Forced | ArgProp.Value], ['method', ArgProp.Forced | ArgProp.Flag], ['sides', ArgProp.Forced | ArgProp.Value], ['circular', ArgProp.Forced | ArgProp.Flag], ['init', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ type: 'function', names: [Identifier.from(['step', PkgName.Stats])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Prints], sig: [['object', ArgProp.Forced | ArgProp.Value], ['scope', ArgProp.Forced | ArgProp.Value], ['scale', ArgProp.Forced | ArgProp.Value], ['direction', ArgProp.Forced | ArgProp.Flag], ['trace', ArgProp.Forced | ArgProp.Flag], ['steps', ArgProp.Forced | ArgProp.Value], ['k', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['filter', PkgName.Dplyr]), Identifier.from(['slice', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [...SigDataDots, ['.by', ArgProp.Value], ['.preserve', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: Identifier.fromAll(PkgName.Dplyr, ['summarise', 'summarize']), processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [...SigDataDots, ['.by', ArgProp.Value], ['.groups', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['arrange', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [...SigDataDots, ['.by_group', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['group_by', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [...SigDataDots, ['.add', ArgProp.Flag], ['.drop', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['distinct', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [...SigDataDots, ['.keep_all', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['relocate', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [...SigDataDots, ['.before', ArgProp.Value], ['.after', ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['count', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['x', ArgProp.Value], ['...', ArgProp.Value], ['wt', ArgProp.Value], ['sort', ArgProp.Flag], ['name', ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['pull', PkgName.Dplyr])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['.data', ArgProp.Value], ['var', ArgProp.Value], ['name', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['nest', PkgName.TidyR])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: SigDataDots }, assumePrimitive: false },
	/* `drop_na` names its first argument `data`, not `.data`, so it gets a line of its own */
	{ overrides: true, type: 'function', names: [Identifier.from(['drop_na', PkgName.TidyR])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['data', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['pivot_longer', PkgName.TidyR])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['data', ArgProp.Value], ['cols', ArgProp.Value], ['...', ArgProp.Value], ['names_to', ArgProp.Value], ['values_to', ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['pivot_wider', PkgName.TidyR])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['data', ArgProp.Value], ['...', ArgProp.Value], ['names_from', ArgProp.Value], ['values_from', ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['separate', PkgName.TidyR])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Deprecated], sig: [['data', ArgProp.Value], ['col', ArgProp.Value], ['into', ArgProp.Value], ['sep', ArgProp.Value], ['remove', ArgProp.Flag], ['convert', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['unite', PkgName.TidyR])], processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['data', ArgProp.Value], ['col', ArgProp.Value], ['...', ArgProp.Value], ['sep', ArgProp.Value], ['remove', ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: Identifier.fromAll(PkgName.Base, ['subset', 'transform']), processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, sig: [['x', ArgProp.Value], ['...', ArgProp.Value]] }, assumePrimitive: false },

	/* these share the `f(x, ...)` shape above, but R puts one more formal before the `...`: leaving it out
	   would shift every position after it, so each names its own */
	{ overrides: true, type: 'function', names: [Identifier.from(['sort', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['decreasing', ArgProp.Forced | ArgProp.Flag], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: Identifier.fromAll(PkgName.Base, ['unique', 'duplicated']), processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['incomparables', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['as.data.frame', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['row.names', ArgProp.Forced | ArgProp.Value], ['optional', ArgProp.Forced | ArgProp.Flag], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['median', PkgName.Stats])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, sig: [['x', ArgProp.Forced | ArgProp.Value], ['na.rm', ArgProp.Forced | ArgProp.Flag], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	/* the ones the earlier list left short where a reader would notice */
	{ overrides: true, type: 'function', names: [Identifier.from(['nchar', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['x', ArgProp.Forced | ArgProp.Shape], ['type', ArgProp.Forced | ArgProp.Value], ['allowNA', ArgProp.Forced | ArgProp.Flag], ['keepNA', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn },
	{ overrides: true, type: 'function', names: [Identifier.from(['grepl', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['pattern', ArgProp.Forced | ArgProp.Value], ['x', ArgProp.Forced | ArgProp.Value], ['ignore.case', ArgProp.Forced | ArgProp.Flag], ['perl', ArgProp.Forced | ArgProp.Flag], ['fixed', ArgProp.Forced | ArgProp.Flag], ['useBytes', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['match', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['x', ArgProp.Forced | ArgProp.Value], ['table', ArgProp.Forced | ArgProp.Value], ['nomatch', ArgProp.Forced | ArgProp.Value], ['incomparables', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['lengths', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: [['x', ArgProp.Forced | ArgProp.Shape], ['use.names', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: true },
	{ overrides: true, type: 'function', names: [Identifier.from(['readLines', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: [['con', ArgProp.Forced | ArgProp.Resource], ['n', ArgProp.Forced | ArgProp.Value], ['ok', ArgProp.Forced | ArgProp.Flag], ['warn', ArgProp.Forced | ArgProp.Flag], ['encoding', ArgProp.Forced | ArgProp.Value], ['skipNul', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['writeLines', PkgName.Base])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints], sig: [['text', ArgProp.Forced | ArgProp.Value], ['con', ArgProp.Forced | ArgProp.Resource], ['sep', ArgProp.Forced | ArgProp.Value], ['useBytes', ArgProp.Forced | ArgProp.Flag]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['write.table', PkgName.Utils])], processor: BuiltInProcName.DefaultReadAllArgs, config: { props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: [['x', ArgProp.Forced | ArgProp.Value], ['file', ArgProp.Forced | ArgProp.Resource], ['append', ArgProp.Forced | ArgProp.Flag], ['quote', ArgProp.Forced | ArgProp.Flag], ['sep', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	{ overrides: true, type: 'function', names: [Identifier.from(['download.file', PkgName.Utils])], processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: [['url', ArgProp.Forced | ArgProp.Resource], ['destfile', ArgProp.Forced | ArgProp.Resource], ['method', ArgProp.Forced | ArgProp.Value], ['quiet', ArgProp.Forced | ArgProp.Flag], ['mode', ArgProp.Forced | ArgProp.Value], ['cacheOK', ArgProp.Forced | ArgProp.Flag], ['extra', ArgProp.Forced | ArgProp.Value], ['headers', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]] }, assumePrimitive: false },
	/** Deprecated Functions */
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.Dplyr, ['id', 'top_n', 'sample_n', 'recode', 'progress_estimated', 'group_nest', 'add_rownames', 'tbl_df', 'src_local', 'summarise_each', 'summarize_', 'summarise_', 'slice_', 'select_vars_', 'select_', 'rename_vars_', 'rename_', 'transmute_', 'tally_', 'mutate_', 'group_indices_', 'group_by_', 'funs_', 'filter_', 'do_', 'distinct_', 'count_', 'arrange_', 'add_tally_', 'add_count_', 'funs', 'do', 'combine', 'changes', 'location', 'eval_tbls2', 'eval_tbls', 'compare_tbls2', 'compare_tbls', 'bench_tbls', 'current_vars', 'select_var', 'rename_vars', 'select_vars', 'failwith', 'all_vars', 'vars', 'select_all', 'mutate_all', 'summarise_all', 'group_by_all', 'filter_all', 'all_equal', 'arrange_all', 'distinct_all'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: [Identifier.make('fct_explicit_na', PkgName.Forecats)]  },
	/* deprecated, but still data-masking: restating the mask keeps the column names out of the variable resolution */
	{ overrides: true, type: 'function', processor: BuiltInProcName.Default, config: { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Deprecated] }, names: [...Identifier.fromAll(PkgName.Dplyr, ['nest_by', 'with_groups', 'group_split']), ...Identifier.fromAll(PkgName.TidyR, ['spread', 'separate_rows', 'gather', 'extract'])] },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.GgPlot2, ['gg_dep', 'is.theme', 'is.ggplot', 'guide_train', 'is.ggproto', 'fortify', 'is.facet', 'is.Coord', 'aes_auto', 'aes_'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.Plyr, ['liply', 'isplit2'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.Purrr, ['transpose', 'as_vector', 'map_dfr', 'flatten', 'reduce_right', 'accumulate', 'map_raw', 'update_list', 'when', 'rdunif', 'rbernoulli', 'splice', 'rerun', 'prepend', 'at_depth', 'cross', 'list_along'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: ['`%@%`']  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.Readr, ['read_table2', 'melt_table', 'melt_fwf', 'melt_delim'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.Tibble, ['repair_names', 'set_tidy_names', 'tidy_names', 'is.tibble', 'trunc_mat', 'frame_data', 'as.tibble', 'as_data_frame', 'lst_', 'data_frame_', 'tibble_', 'data_frame', 'as_tibble'])  },
	{ type: 'function', processor: BuiltInProcName.DefaultReadAllArgs, config: { tags: [SemanticCallTag.Deprecated] }, names: Identifier.fromAll(PkgName.TidyR, ['nest_legacy', 'unnest_', 'unite_', 'spread_', 'separate_', 'separate_rows_', 'nest_', 'gather_', 'fill_', 'extract_', 'nesting_', 'crossing_', 'expand_', 'drop_na_', 'complete_', 'extract_numeric'])  },
] as const satisfies AnyBuiltInDefinition[];

/** Contains the built-in definitions recognized by flowR */
export const DefaultBuiltinConfig = markGenerics(WrittenBuiltinDefinitions);

/** Expensive and naive lookup of the default processor for a built-in function name */
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
