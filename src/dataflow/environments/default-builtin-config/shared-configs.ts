import { pkg, base } from './define';
import { sig, Forced } from './signatures';
import type { BuiltInDefinitions } from '../built-in-config';
import { FunctionSemantics } from '../../fn/function-semantics';
import { getValueOfArgument } from '../../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { DataflowGraph } from '../../graph/graph';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { BuiltInOperators, OperatorCategory } from './operators';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexInfo, DfgVertex } from '../../graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CascadeAction } from '../../../queries/catalog/call-context-query/cascade-action';
import { Identifier, PkgName } from '../identifier';
import { ArgProp, CallProp, type FnSig, SemanticCallTag, type SemanticCallTags } from '../built-in-props';
import { AttachedBasePackageSet, baseRExportOwner } from '../../../util/r-base-packages';
import { RBasePrimitives } from '../../../data/r-base-primitives.generated';
import { RBasePackageStore } from '../../../data/r-base-packages.generated';
import { AmbientStateAccessType, PrintingOptions } from '../../internal/process/functions/call/built-in/built-in-ambient-state';
import { AmbientStateName, KeyedState, UnknownKey } from '../ambient-state-name';

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
	ggplot2:    ['annotate', 'annotation_borders', 'annotation_custom', 'annotation_logticks', 'annotation_map', 'annotation_raster', 'autoplot',
		'borders', 'coord_cartesian', 'coord_equal', 'coord_fixed', 'coord_flip', 'coord_map', 'coord_munch',
		'coord_polar', 'coord_quickmap', 'coord_radial', 'coord_sf', 'coord_trans', 'coord_transform', 'expand_limits', 'expand_scale',
		'expansion', 'facet_grid', 'facet_null', 'facet_wrap', 'geom_abline', 'geom_area', 'geom_bar', 'geom_bin2d',
		'geom_bin_2d', 'geom_blank', 'geom_boxplot', 'geom_col', 'geom_contour', 'geom_contour_filled', 'geom_count',
		'geom_crossbar', 'geom_curve', 'geom_density', 'geom_density2d', 'geom_density2d_filled', 'geom_density_2d',
		'geom_density_2d_filled', 'geom_dotplot', 'geom_errorbar', 'geom_errorbarh', 'geom_freqpoly', 'geom_function',
		'geom_hex', 'geom_histogram', 'geom_hline', 'geom_jitter', 'geom_label', 'geom_line', 'geom_linerange',
		'geom_map', 'geom_path', 'geom_point', 'geom_pointrange', 'geom_polygon', 'geom_qq', 'geom_qq_line',
		'geom_quantile', 'geom_raster', 'geom_rect', 'geom_ribbon', 'geom_rug', 'geom_segment', 'geom_sf',
		'geom_sf_label', 'geom_sf_text', 'geom_smooth', 'geom_spoke', 'geom_step', 'geom_text', 'geom_tile',
		'geom_violin', 'geom_vline', 'ggplot', 'ggtitle', 'guides', 'labs', 'last_plot', 'lims', 'qplot', 'quickplot',
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
		'stat_bin_hex', 'stat_binhex', 'stat_boxplot', 'stat_connect', 'stat_contour', 'stat_contour_filled', 'stat_count',
		'stat_density', 'stat_density2d', 'stat_density2d_filled', 'stat_density_2d', 'stat_density_2d_filled',
		'stat_ecdf', 'stat_ellipse', 'stat_function', 'stat_identity', 'stat_manual', 'stat_qq', 'stat_qq_line', 'stat_quantile',
		'stat_sf', 'stat_sf_coordinates', 'stat_smooth', 'stat_spoke', 'stat_sum', 'stat_summary', 'stat_summary2d',
		'stat_summary_2d', 'stat_summary_bin', 'stat_summary_hex', 'stat_unique', 'stat_ydensity', 'theme', 'theme_bw',
		'theme_classic', 'theme_dark', 'theme_get', 'theme_gray', 'theme_grey', 'theme_light', 'theme_linedraw',
		'theme_minimal', 'theme_replace', 'theme_sub_axis', 'theme_sub_axis_bottom', 'theme_sub_axis_left', 'theme_sub_axis_right', 'theme_sub_axis_top', 'theme_sub_axis_x', 'theme_sub_axis_y', 'theme_sub_legend', 'theme_sub_panel', 'theme_sub_plot', 'theme_sub_strip', 'theme_test', 'theme_update', 'theme_void', 'xlab', 'xlim', 'ylab', 'ylim'],
	ggpubr: ['ggballoonplot', 'ggbarplot', 'ggdensity', 'ggdonutchart', 'ggdotchart', 'ggdotplot', 'ggecdf', 'ggerrorplot', 'gghistogram',
		'ggline', 'ggmaplot', 'ggpaired', 'ggpie', 'ggqqplot', 'ggscatterhist', 'ggstripchart', 'ggviolin', 'gradient_color'],
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
	ggmirt: ['conRelPlot', 'itemDist', 'itemInfoPlot', 'itemfitPlot', 'itempersonMap', 'personDist', 'personfitPlot',
		'scaleCharPlot', 'summaryPlot', 'testInfoCompare', 'testInfoPlot', 'tracePlot'],
	GGally: ['ggbivariate', 'ggcoef', 'ggcoef_compare', 'ggcoef_model', 'ggcorr', 'ggduo', 'ggnet2', 'ggnostic', 'ggpairs',
		'ggparcoord', 'ggscatmat', 'ggsurv', 'ggtable', 'ggts'],
	ggstatsplot: ['ggbarstats', 'ggbetweenstats', 'ggcoefstats', 'ggcorrmat', 'ggdotplotstats', 'gghistostats', 'ggpiestats',
		'ggscatterstats', 'ggwithinstats', 'grouped_ggbarstats', 'grouped_ggbetweenstats', 'grouped_ggcorrmat',
		'grouped_ggdotplotstats', 'grouped_gghistostats', 'grouped_ggpiestats', 'grouped_ggscatterstats', 'grouped_ggwithinstats'],
	sjPlot:          ['plot_frq', 'plot_grpfrq', 'plot_likert', 'plot_models', 'plot_residuals', 'plot_scatter', 'plot_stackfrq', 'plot_xtab'],
	EnhancedVolcano: ['EnhancedVolcano'],
	qgraph:          ['centralityPlot', 'clusteringPlot', 'qgraph'],
	semPlot:         ['semPaths'],
	psych:           ['cor.plot', 'corPlot', 'error.bars', 'fa.diagram', 'pairs.panels', 'scatter.hist'],
	mirt:            ['itemplot'],
	gplots:          ['bandplot', 'barplot2', 'boxplot2', 'bubbleplot', 'heatmap.2', 'lmplot2', 'overplot', 'plotCI',
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
export const PlotFunctionOwners: ReadonlyMap<string, string[]> = Object.entries(PlotFunctionPackages)
	.reduce((owners, [pkg, names]) => {
		for(const n of names) {
			owners.set(n, [...(owners.get(n) ?? []), pkg]);
		}
		return owners;
	}, new Map<string, string[]>());

/**
 * The packages exporting a plotting function, in the order {@link PlotFunctionPackages} lists them. More than
 * one means the name is ambiguous, so nothing may pin a call of it to a single package.
 * @example
 * ```ts
 * plotFunctionOwners('ggplot');  // ['ggplot2']
 * plotFunctionOwners('foo');     // []
 * ```
 */
export function plotFunctionOwners(name: string): readonly string[] {
	return PlotFunctionOwners.get(name) ?? [];
}

/** `names` under every package exporting each: base R from the shipped data, the rest from {@link PlotFunctionPackages}. */
export function namespacePlotFunctions(names: readonly string[]): (Identifier | string)[] {
	return names.flatMap<Identifier | string>(n => {
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
	/* ggmirt, plots of mirt models */
	'conRelPlot', 'itemDist', 'itemInfoPlot', 'itemfitPlot', 'itempersonMap', 'personDist', 'personfitPlot', 'scaleCharPlot', 'summaryPlot',
	'testInfoCompare', 'testInfoPlot', 'tracePlot',
	'ggbivariate', 'ggcoef', 'ggcoef_compare', 'ggcoef_model', 'ggcorr', 'ggduo', 'ggnet2', 'ggnostic', 'ggpairs', 'ggparcoord', 'ggscatmat', 'ggsurv', 'ggtable', 'ggts',
	'ggbarstats', 'ggbetweenstats', 'ggcoefstats', 'ggcorrmat', 'ggdotplotstats', 'gghistostats', 'ggpiestats', 'ggscatterstats', 'ggwithinstats',
	'grouped_ggbarstats', 'grouped_ggbetweenstats', 'grouped_ggcorrmat', 'grouped_ggdotplotstats', 'grouped_gghistostats', 'grouped_ggpiestats',
	'grouped_ggscatterstats', 'grouped_ggwithinstats',
	'ggbarplot', 'ggdensity', 'ggdotchart', 'ggdotplot', 'ggecdf', 'ggerrorplot', 'gghistogram', 'ggline', 'ggmaplot', 'ggpaired', 'ggpie',
	'ggdonutchart', 'ggqqplot', 'ggscatterhist', 'ggstripchart', 'ggviolin', 'ggballoonplot',
	'plot_frq', 'plot_grpfrq', 'plot_likert', 'plot_models', 'plot_residuals', 'plot_scatter', 'plot_stackfrq', 'plot_xtab',
	'EnhancedVolcano', 'centralityPlot', 'clusteringPlot'
] as const;
export const TinyPlotCrate = [
	'tinyplot', 'plt'
] as const;
export const GraphicsPlotCreate = [
	'plot', 'plot.new', 'xspline', 'map', 'curve', 'image', 'boxplot', 'dotchart', 'sunflowerplot', 'barplot', 'matplot', 'hist',
	'smoothScatter', 'contour', 'persp', 'xyplot', 'stripplot', 'bwplot', 'dotPlot', 'dotplot', 'histPlot', 'densityPlot', 'qqplot', 'qqPlot', 'boxPlot',
	'bxp', 'assocplot', 'mosaicplot', 'stripchart', 'fourfoldplot', 'plot.xy', 'plot.formula', 'plot.default', 'plot.design', 'stars', 'cotabplot', 'pheatmap',
	'spineplot', 'regressogram', 'bootcurve', 'meanplot', 'vioplot', 'pairs', 'coplot', 'histogram', 'splom', 'leaflet', 'tm_shape', 'plot_ly', 'plotSimulatedResiduals', 'plotmeans',
	'overplot', 'residplot', 'heatmap.2', 'lmplot2', 'sinkplot', 'textplot', 'boxplot2',
	'ggarrange', 'ggboxplot', 'ggscatter', 'corrplot', 'plot_grid', 'wrap_plots', 'levelplot', 'image.plot', 'biplot', 'screeplot',
	'interaction.plot', 'termplot', 'plot_model', 'emmip',
	'qgraph', 'semPaths', 'pairs.panels', 'fa.diagram', 'corPlot', 'cor.plot', 'error.bars', 'scatter.hist', 'itemplot'
];
export const PlotCreate = GraphicsPlotCreate.concat(TinyPlotCrate, GgPlotCreate);
/** the creators above that, other than base graphics, return their plot visibly instead of drawing it at once */
export const VisiblePlotCreate: ReadonlySet<string> = new Set(['xyplot', 'stripplot', 'bwplot', 'dotplot', 'histogram', 'splom', 'leaflet', 'plot_ly', 'tm_shape', 'itemplot']);
/** the plot creators that return the plot to draw when printed, where base graphics draw at once and return something else */
export const PlotObjectCreate: ReadonlySet<string> = new Set([...GgPlotCreate.filter(f => f !== 'grid.arrange'), 'last_plot', ...VisiblePlotCreate, 'pheatmap']);
export const GraphicDeviceOpen = [
	'pdf', 'jpeg', 'png', 'windows', 'postscript', 'xfig', 'bitmap', 'pictex', 'cairo_pdf', 'svg', 'bmp', 'tiff', 'X11', 'quartz', 'image_graph',
	'image_draw', 'dev.new', 'trellis.device', 'raster_pdf',
	'agg_png', 'agg_jpeg', 'agg_tiff', 'agg_ppm', 'agg_webp', 'agg_capture'
] as const;
export const TinyPlotAddons = [
	'tinyplot_add', 'plt_add'
];
/** the addons that change the theme of later plots and hand back the old one invisibly */
export const InvisibleGgPlotAddons: readonly string[] = ['theme_update', 'theme_replace'];
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
	'stat_density2d_filled', 'stat_bin', 'stat_sum', 'stat_spoke', 'stat_bin2d', 'stat_connect', 'stat_manual',
	'labs', 'theme_void', 'theme_test', 'theme_minimal', 'theme_light', 'theme', 'theme_get', 'theme_gray', 'theme_dark', 'theme_classic', 'theme_linedraw', 'theme_update',
	'theme_replace', 'theme_grey', 'theme_bw', 'theme_tufte', 'theme_survminer', 'theme_sub_axis', 'theme_sub_axis_bottom', 'theme_sub_axis_left', 'theme_sub_axis_right', 'theme_sub_axis_top',
	'theme_sub_axis_x', 'theme_sub_axis_y', 'theme_sub_legend', 'theme_sub_panel', 'theme_sub_plot', 'theme_sub_strip', 'facet_null', 'facet_grid', 'facet_wrap', 'xlab', 'xlim', 'ylab', 'ylim', 'lims',
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
	'coord_trans', 'coord_transform', 'coord_sf', 'coord_cartesian', 'coord_fixed', 'coord_flip', 'coord_quickmap', 'coord_equal', 'coord_map', 'coord_polar', 'coord_munch', 'coord_radial',
	'annotate', 'annotation_custom', 'annotation_raster', 'annotation_map', 'annotation_logticks', 'borders', 'annotation_borders', 'ggtitle', 'expansion', 'expand_limits', 'expand_scale', 'guides',
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
export const PlotAddons = GraphicsPlotAddons.concat(GgPlotImplicitAddons, ...PlotFunctionsWithAddParam);

/** The packages exporting magrittr's `%>%`: the tidyverse and friends re-export the very same function. */
export const MagrittrPipePackages = [PkgName.Magrittr, PkgName.Dplyr, PkgName.Purrr, PkgName.Stringr, PkgName.Tibble,
	PkgName.TidyR, PkgName.Testthat, PkgName.Magick, PkgName.Promises] as const;

/** The packages re-exporting rlang's tidy-evaluation helpers unchanged. */
export const TidyEvalPackages = [PkgName.Rlang, PkgName.Dplyr, PkgName.GgPlot2] as const;
/** the database a connection opens is a file: its tables are read and changed through the connection */
export const DbConnectSig: FnSig = sig({ drv: Forced.Value, dbname: Forced.Resource, '...': Forced.Value });
export const DbConnSig: FnSig = sig({ conn: Forced.Resource });
export const DbReads = { type: AmbientStateAccessType.ReadFiles, sig: DbConnSig } as const;
export const DbReadsWrites = (sig: FnSig) => [{ type: AmbientStateAccessType.ReadFiles, sig }, { type: AmbientStateAccessType.WriteFiles, sig }] as const;
export const DbPackages = [PkgName.Dbi, PkgName.Rsqlite, 'RPostgres', 'RMariaDB', 'odbc', 'pool'] as const;
/** reads the files some arguments name and writes the ones its {@link ArgProp.Written} arguments name, like `file.copy` or `unzip` */
export const SetsAnyEnvVar = [AmbientStateName.keyed(KeyedState.Env, UnknownKey), AmbientStateName.allOf(KeyedState.Env)].map(state => ({ type: AmbientStateAccessType.SetState, state }) as const);
export const CopiesFiles = [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Writes];
/** reads what its URL (or remote object) arguments name from the network and writes the file its {@link ArgProp.Written} arguments name, like `download.file` */
export const Downloads = [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Writes];

/* data.table's `set*` functions change their first argument in place */
export const DataTableSetter = { canBeReplacement: false, targetVariable: false, makeMaybe: true, mayHaveMoreArgs: true, readTarget: true, props: CallProp.Invisible, sig: sig({ x: Forced.Value | ArgProp.Written | ArgProp.Alias, '...': Forced.Value }) } as const;
/* the calls that reshape, filter, join or aggregate data and are not data-masking, each under the package that declares it, so `stats::filter` is none */
export const OtherTransforms: Identifier[] = [
	...Identifier.fromAll(PkgName.Dplyr, ['ungroup', 'left_join', 'right_join', 'inner_join', 'full_join', 'semi_join', 'anti_join', 'nest_join', 'cross_join', 'bind_rows', 'bind_cols',
		...['mutate', 'transmute', 'filter', 'select', 'rename', 'arrange', 'summarise', 'summarize', 'group_by', 'distinct'].flatMap(verb => ['all', 'at', 'if'].map(scope => `${verb}_${scope}`))]),
	...Identifier.fromAll(PkgName.DataTable, ['as.data.table', 'melt', 'dcast', 'rbindlist', 'merge.data.table']),
	...Identifier.fromAll(PkgName.Tibble, ['add_column', 'add_row']),
	...base('merge'), ...Identifier.fromAll(PkgName.Stats, ['aggregate', 'reshape', 'ave']),
	...Identifier.fromAll(PkgName.Base, ['split', 'unsplit', 'expand.grid']), ...Identifier.fromAll(PkgName.Utils, ['stack', 'unstack']),
	...Identifier.fromAll(PkgName.Reshape2, ['melt', 'dcast', 'acast']),
	...Identifier.fromAll(PkgName.Plyr, ['ldply', 'llply', 'dlply', 'join', 'rbind.fill'])
];
/* the calls that fit a statistical model to data */
export const ModelFits: Identifier[] = [
	...Identifier.fromAll(PkgName.Stats, ['lm', 'glm', 'nls']), ...Identifier.fromAll(PkgName.Lme4, ['lmer', 'glmer']),
	...pkg(PkgName.Survival, 'coxph'), ...pkg(PkgName.Mass, 'glm.nb'), ...pkg(PkgName.Fixest, 'feols')
];
/* `with(data, expr)`: `expr` is evaluated in the data */
/* the expression runs in the data's environment, not where it is written */
export const WithSig: FnSig  = sig({ data: ArgProp.NoDefault | ArgProp.Written, expr: ArgProp.NoDefault | ArgProp.Nse, '...': 0 });

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
export const PrimitivesPerTopic: Readonly<Record<string, readonly string[]>> = {
	'Arithmetic':   ['%%', '%/%', '*', '+', '-', '/', '^'],
	'assignOps':    ['<-', '<<-', '='],
	'call':         ['as.call'],
	'CallExternal': ['.Call', '.External'],
	'character':    ['as.character', 'is.character'],
	'Colon':        [':'],
	'Comparison':   BuiltInOperators.ofCategory(OperatorCategory.Comparison),
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
	'Logic':        BuiltInOperators.ofCategory(OperatorCategory.Logical),
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
 * The one of {@link statedSignatures} a reader means: the definition for `pkg` when there is one, else base
 * R's, else whichever came first. `undefined` when flowR states nothing about the name at all.
 * @example
 * ```ts
 * const stated = statedSignatures();
 * statedSignatureOf(stated, 'filter', 'dplyr')?.pkg; // 'dplyr', not the one of stats
 * ```
 */
export function statedSignatureOf(stated: ReadonlyMap<string, readonly StatedSignature[]>, name: string, pkg?: string): StatedSignature | undefined {
	const known = stated.get(name);
	return known?.find(entry => entry.pkg === pkg) ?? known?.find(entry => entry.pkg === PkgName.Base) ?? known?.[0];
}

export const RegexConvIn = /[-/\\^$*+?.()|[\]{}]/g;
/** Builds a regex from an array of plain names or namespaced {@link Identifier}s, deduplicating by name. */
export function toRegex(n: readonly Identifier[]): RegExp {
	return new RegExp(`^(${
		Array.from(new Set(n.map(Identifier.getName)), s => s.replaceAll(RegexConvIn, String.raw`\$&`)).filter(s => s.length > 0).join('|')
	})$`);
}

export const DeviceClose = ['dev.off', 'graphics.off'];

/** `dev.off()` closes the active device, `dev.off(which)` maybe another one */
export function closesActiveDevice(target: DataflowGraphVertexInfo): boolean {
	if(!DfgVertex.isFunctionCall(target)) {
		return false;
	}
	const name = Identifier.getName(target.name);
	return name === 'graphics.off' || (name === 'dev.off' && target.args.length === 0);
}

/** what ggplot's `last_plot()` is: the last ggplot created or added to */
export const LinkToLastGgPlot = {
	type:     'link-to-last-call',
	callName: toRegex((GgPlotCreate as readonly string[]).concat(GgPlotImplicitAddons, GgPlotAddons))
} as const;
/** what closing or exporting a device links back to: the plot calls that filled it */
export const LinkToLastPlot = {
	type:     'link-to-last-call',
	callName: toRegex((GraphicDeviceOpen as readonly string[]).concat(PlotCreate, PlotAddons, GgPlotAddons, TinyPlotAddons))
} as const;

/** The internal generics: they dispatch in C rather than through `UseMethod`, so the list has to be written down. */
export const InternalGenerics: ReadonlySet<string> = new Set([
	'$', '[', '[[', '+', '-', '*', '/', '^', '%%', '%/%', '==', '!=', '<', '>', '<=', '>=', '&', '|', '!',
	'c', 'length', 'dim', 'dimnames', 'names', 'max', 'min', 'range', 'sum', 'prod', 'abs', 'sqrt', 'exp',
	'log', 'floor', 'ceiling', 'round', 'signif', 'trunc', 'cumsum', 'cumprod', 'cummax', 'cummin',
	'as.character', 'as.integer', 'as.double', 'as.logical', 'as.complex', 'as.numeric', 'as.raw',
	'is.na', 'is.nan', 'is.finite', 'is.infinite', 'is.matrix', 'is.numeric', 'cbind', 'rbind', 'anyNA', 'as.environment',
	'as.call', 'is.array', 'log2', 'log10', 'rep', 'seq.int', 'xtfrm'
]);

/**
 * Every name R dispatches on: the generated closure generics plus the {@link InternalGenerics} (no R body, so
 * {@link fnInfoFromSignature} never sees them). `npm run check:generic-labels` checks this against a synced database.
 */
export const RGenerics: ReadonlySet<string> = new Set([...RBasePackageStore.generics, ...InternalGenerics]);

/** Label every {@link RGenerics} {@link CallProp.Generic}, splitting an entry that mixes them with names that do not dispatch (`&` does, `&&` does not). */
export function markGenerics(definitions: BuiltInDefinitions): BuiltInDefinitions {
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
 * Label every name the R language itself provides {@link CallProp.Primitive}, splitting an entry that mixes
 * them with names R does not (one definition covers `base::stopifnot` and `assertthat::assert_that`, and only
 * the first is R's). {@link RBasePrimitives} is read out of a real R, so this states what that R has.
 */
export function markPrimitives(definitions: BuiltInDefinitions): BuiltInDefinitions {
	const out: BuiltInDefinitions = [];
	for(const def of definitions) {
		if(def.type !== 'function') {
			out.push(def);
			continue;
		}
		let primitives: Identifier[] | undefined = undefined;
		let rest: Identifier[] | undefined = undefined;
		for(const name of def.names) {
			/* the set is base's own, so a name of another namespace is not the one R provides */
			if(RBasePrimitives.has(Identifier.getName(name)) && (Identifier.getNamespace(name) ?? PkgName.Base) === PkgName.Base) {
				(primitives ??= []).push(name);
			} else {
				(rest ??= []).push(name);
			}
		}
		if(primitives === undefined) {
			out.push(def);
			continue;
		}
		out.push({ ...def, names: primitives, config: { ...def.config, props: (def.config?.props ?? 0) | CallProp.Primitive } });
		if(rest !== undefined) {
			out.push({ ...def, names: rest });
		}
	}
	return out;
}

/**
 * Whether the call names a plot function with an `add` parameter ({@link PlotFunctionsWithAddParam}), and if so whether its `add`
 * argument says that it appends to the existing plot, and `undefined` for any other function.
 * Keep in mind that only a literal `TRUE` counts as appending, so `add = flag` is `false` here, and that the id must be one of a function call.
 * @example
 * ```ts
 * appendsToPlot(callId, graph); // true for `boxplot(x, add = TRUE)`, false for `boxplot(x)`, undefined for `plot(x)`
 * ```
 */
export function appendsToPlot(source: NodeId, graph: DataflowGraph): boolean | undefined {
	const vertex = graph.getVertex(source) as DataflowGraphVertexFunctionCall;
	return PlotFunctionsWithAddParam.has(Identifier.getName(vertex.name))
		? getValueOfArgument(graph, vertex, { index: -1, name: 'add' }, [RType.Logical])?.content === true
		: undefined;
}

/** what adding to a plot does */
export const PlotAddonConfig = {
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
	tags: [SemanticCallTag.Graphics] as SemanticCallTags, sig: sig({ '...': ArgProp.Forced }) } as const;

/** the devices withr opens for a scope, as `with_<device>` and `local_<device>` */
export const WithrDevices = ['bmp', 'cairo_pdf', 'cairo_ps', 'jpeg', 'pdf', 'png', 'svg', 'tiff', 'xfig', 'postscript'] as const;

export const ReadGraphicsState = { type: AmbientStateAccessType.ReadGraphics } as const;
export const ReadPrintingOptions = { type: AmbientStateAccessType.ReadOptions, keys: PrintingOptions } as const;
/* a method for the printed value may read any option, see {@link AmbientStateAccess} */
export const PrintDispatched = { type: AmbientStateAccessType.ReadOptions, keys: PrintingOptions, dispatchOn: 0 } as const;
export const OpenDevice = { type: AmbientStateAccessType.OpenDevice } as const;
/** the devices that are open, which `dev.cur()` and `dev.list()` report */
export const ReadDevices = [AmbientStateName.device, AmbientStateName.otherDevicesOpenedBy].map(state => ({ type: AmbientStateAccessType.ReadState, state }) as const);
/** sets the entries of an environment variable, a locale or a search path state that the call names with the parameter `name` of the given signature */
export const SetsEntryNamedBy = (state: KeyedState, signature: readonly string[], name: string, rest: { readonly fallback?: string, readonly quoted?: boolean | string } = {}) =>
	({ type: AmbientStateAccessType.SetKeyed, state, keys: { from: 'parameter', signature, names: [name], ...rest } }) as const;
export const SetsEntry = (state: KeyedState, key: string) => ({ type: AmbientStateAccessType.SetKeyed, state, keys: { from: 'constant', key } }) as const;
/** `library(pkg)` and `library("pkg")` name the package, `library(pkg, character.only = TRUE)` looks the variable up */
export const LibrarySearchPath = SetsEntryNamedBy(KeyedState.SearchPath, ['package', 'help', 'pos', 'lib.loc', 'character.only'], 'package', { quoted: 'character.only' });
export const LoaderSearchPath = (quoted: boolean) => ({ type: AmbientStateAccessType.SetKeyed, state: KeyedState.SearchPath, keys: { from: 'unnamed', quoted } }) as const;
/* which entry a detach removes depends on every earlier attach, so it reads the search path as well */
export const DetachSearchPath = [
	SetsEntryNamedBy(KeyedState.SearchPath, ['name', 'pos', 'unload', 'character.only', 'force'], 'name', { quoted: 'character.only' }),
	{ type: AmbientStateAccessType.ReadState, state: AmbientStateName.allOf(KeyedState.SearchPath) }
] as const;
export const ImportSearchPath = SetsEntryNamedBy(KeyedState.SearchPath, ['.from', '...', '.into', '.library', '.directory', '.all', '.except', '.chdir', '.character_only', '.S3'], '.into', { fallback: 'imports' });
/** `attach(df)` is named `df`, `attach(df, name = "data")` is named `data` */
export const AttachSearchPath = { type: AmbientStateAccessType.SetKeyed, state: KeyedState.SearchPath, keys: { from: 'parameter', signature: ['what', 'pos', 'name', 'warn.conflicts'], names: ['name', 'what'], quoted: true } } as const;

/** what creating a plot does; restated by the deprecated plot creators, which do the same but should not be used */
export const PlotCreateConfig = {
	hasUnknownSideEffects: {
		type:      'link-to-last-call',
		ignoreIf:  (source: NodeId, graph: DataflowGraph) => appendsToPlot(source, graph) === true,
		callName:  toRegex((GraphicDeviceOpen as readonly string[]).concat(DeviceClose)),
		/* a device closed in between is not the one the plot goes to (the graphics state knows which one it is) */
		cascadeIf: (target: DataflowGraphVertexInfo) => closesActiveDevice(target) ? CascadeAction.Block : CascadeAction.Stop
	},
	tags: [SemanticCallTag.Graphics] as SemanticCallTags, sig: sig({ '...': ArgProp.Forced }) } as const;