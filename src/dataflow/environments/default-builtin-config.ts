import type { BuiltInDefinitions, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from './built-in-config';
import { ExitPointType } from '../info';
import { getValueOfArgument } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { DataflowGraph } from '../graph/graph';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataflowGraphVertexFunctionCall } from '../graph/vertex';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import { UnnamedFunctionCallPrefix } from '../internal/process/functions/call/unnamed-call-handling';
import { KnownHooks } from '../hooks';
import { Identifier, PkgName } from './identifier';
import { BuiltInProcName } from './built-in-proc-name';

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
	'image_draw', 'dev.new', 'trellis.device', 'raster_pdf', 'agg_pdf'
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
	'theme_solid', 'theme_hc', 'theme_excel_new', 'theme_few', 'theme_clean', 'theme_wsj', 'theme_calc', 'theme_par', 'theme_tufte', 'theme_igray', 'theme_solarized_2', 'theme_excel',
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

const RegexConvIn = /[-/\\^$*+?.()|[\]{}]/g;
/** Builds a regex from an array of plain names or namespaced {@link Identifier}s, deduplicating by name. */
function toRegex(n: readonly Identifier[]): RegExp {
	return new RegExp(`^(${
		Array.from(new Set(n.map(Identifier.getName)), s => s.replaceAll(RegexConvIn, String.raw`\$&`)).filter(s => s.length > 0).join('|')
	})$`);
}

/**
 * Contains the built-in definitions recognized by flowR
 */
export const DefaultBuiltinConfig = [
	{ type:  'constant', names: [
		Identifier.from(['NULL', PkgName.Base]),        Identifier.from(['NA', PkgName.Base]),
		Identifier.from(['NaN', PkgName.Base]),         Identifier.from(['NA_integer_', PkgName.Base]),
		Identifier.from(['NA_real_', PkgName.Base]),    Identifier.from(['NA_complex_', PkgName.Base]),
		Identifier.from(['NA_character_', PkgName.Base])
	], value: null, assumePrimitive: true },
	{ type:  'constant', names: [
		Identifier.from(['.GlobalEnv', PkgName.Base]), Identifier.from(['.BaseNamespaceEnv', PkgName.Base]),
		Identifier.from(['.BaseEnv', PkgName.Base])
	], value: null, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['TRUE', PkgName.Base]),  Identifier.from(['T', PkgName.Base])],  value: true,  assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['FALSE', PkgName.Base]), Identifier.from(['F', PkgName.Base])],  value: false, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['Inf', PkgName.Base])],  value: Infinity, assumePrimitive: true },
	{ type: 'constant', names: [Identifier.from(['pi', PkgName.Base])],   value: Math.PI,  assumePrimitive: true },
	{ type:  'constant', names: [
		Identifier.from(['LETTERS', PkgName.Base]), Identifier.from(['letters', PkgName.Base]),
		Identifier.from(['month.abb', PkgName.Base]), Identifier.from(['month.name', PkgName.Base]),
	], value: null, assumePrimitive: true },
	{
		type:  'function',
		names: [
			/* arithmetic & comparison operators (base) */
			Identifier.from(['~', PkgName.Base]),
			Identifier.from(['+', PkgName.Base]),   Identifier.from(['-', PkgName.Base]),
			Identifier.from(['*', PkgName.Base]),   Identifier.from(['/', PkgName.Base]),
			Identifier.from(['^', PkgName.Base]),   Identifier.from(['**', PkgName.Base]),
			Identifier.from(['!', PkgName.Base]),   Identifier.from(['?', PkgName.Utils]),
			Identifier.from(['==', PkgName.Base]),  Identifier.from(['!=', PkgName.Base]),
			Identifier.from(['>', PkgName.Base]),   Identifier.from(['<', PkgName.Base]),
			Identifier.from(['>=', PkgName.Base]),  Identifier.from(['<=', PkgName.Base]),
			Identifier.from(['%%', PkgName.Base]),  Identifier.from(['%/%', PkgName.Base]),
			Identifier.from(['%*%', PkgName.Base]), Identifier.from(['%in%', PkgName.Base]),
			Identifier.from([':', PkgName.Base]),
			/* sequences & repetition (base) */
			Identifier.from(['rep', PkgName.Base]),      Identifier.from(['seq', PkgName.Base]),
			Identifier.from(['seq_len', PkgName.Base]),  Identifier.from(['seq_along', PkgName.Base]),
			Identifier.from(['seq.int', PkgName.Base]),  Identifier.from(['order', PkgName.Base]),
			/* string (base) */
			Identifier.from(['gsub', PkgName.Base]),   Identifier.from(['paste', PkgName.Base]),
			Identifier.from(['paste0', PkgName.Base]), Identifier.from(['nchar', PkgName.Base]),
			/* numeric math (base) */
			Identifier.from(['sqrt', PkgName.Base]),    Identifier.from(['abs', PkgName.Base]),
			Identifier.from(['round', PkgName.Base]),   Identifier.from(['floor', PkgName.Base]),
			Identifier.from(['ceiling', PkgName.Base]), Identifier.from(['signif', PkgName.Base]),
			Identifier.from(['trunc', PkgName.Base]),   Identifier.from(['log', PkgName.Base]),
			Identifier.from(['log10', PkgName.Base]),   Identifier.from(['log2', PkgName.Base]),
			Identifier.from(['sum', PkgName.Base]),     Identifier.from(['mean', PkgName.Base]),
			Identifier.from(['min', PkgName.Base]),     Identifier.from(['max', PkgName.Base]),
			Identifier.from(['jitter', PkgName.Stats]),
			/* type coercion (base) */
			Identifier.from(['numeric', PkgName.Base]),      Identifier.from(['as.character', PkgName.Base]),
			Identifier.from(['as.integer', PkgName.Base]),   Identifier.from(['as.logical', PkgName.Base]),
			Identifier.from(['as.numeric', PkgName.Base]),   Identifier.from(['as.matrix', PkgName.Base]),
			Identifier.from(['as.data.frame', PkgName.Base]),
			/* collections & data (base) */
			Identifier.from(['unique', PkgName.Base]),     Identifier.from(['intersect', PkgName.Base]),
			Identifier.from(['subset', PkgName.Base]),     Identifier.from(['match', PkgName.Base]),
			Identifier.from(['which', PkgName.Base]),      Identifier.from(['any', PkgName.Base]),
			Identifier.from(['length', PkgName.Base]),     Identifier.from(['expression', PkgName.Base]),
			Identifier.from(['factor', PkgName.Base]),     Identifier.from(['missing', PkgName.Base]),
			Identifier.from(['data.frame', PkgName.Base]),
			/* matrix / data frame (base) */
			Identifier.from(['matrix', PkgName.Base]),   Identifier.from(['cbind', PkgName.Base]),
			Identifier.from(['rbind', PkgName.Base]),    Identifier.from(['dim', PkgName.Base]),
			Identifier.from(['nrow', PkgName.Base]),     Identifier.from(['ncol', PkgName.Base]),
			Identifier.from(['dimnames', PkgName.Base]), Identifier.from(['rownames', PkgName.Base]),
			Identifier.from(['names', PkgName.Base]),
			/* object inspection (base) */
			Identifier.from(['class', PkgName.Base]),   Identifier.from(['is.null', PkgName.Base]),
			/* other packages */
			Identifier.from(['read.csv', PkgName.Utils]), Identifier.from(['na.omit', PkgName.Stats]),
			/* graphic devices (grDevices) */
			Identifier.from(['pdf', PkgName.GrDevices]),        Identifier.from(['jpeg', PkgName.GrDevices]),
			Identifier.from(['png', PkgName.GrDevices]),        Identifier.from(['windows', PkgName.GrDevices]),
			Identifier.from(['postscript', PkgName.GrDevices]), Identifier.from(['xfig', PkgName.GrDevices]),
			Identifier.from(['bitmap', PkgName.GrDevices]),     Identifier.from(['pictex', PkgName.GrDevices]),
			Identifier.from(['cairo_pdf', PkgName.GrDevices]),  Identifier.from(['svg', PkgName.GrDevices]),
			Identifier.from(['bmp', PkgName.GrDevices]),        Identifier.from(['tiff', PkgName.GrDevices]),
			Identifier.from(['X11', PkgName.GrDevices]),        Identifier.from(['quartz', PkgName.GrDevices]),
			Identifier.from(['dev.new', PkgName.GrDevices]),
			/* graphic devices (third-party) */
			Identifier.from(['trellis.device', PkgName.Lattice]),
			Identifier.from(['raster_pdf', PkgName.RasterPdf]), Identifier.from(['agg_pdf', PkgName.Ragg]),
			Identifier.from(['image_graph', PkgName.Magick]),   Identifier.from(['image_draw', PkgName.Magick]),
		],
		processor:       BuiltInProcName.DefaultReadAllArgs,
		config:          {},
		assumePrimitive: true
	},
	{ type:            'function', names:           [Identifier.from(['t', PkgName.Base]), Identifier.from(['aperm', PkgName.Base])], /* transpose/permutation */
		processor:       BuiltInProcName.DefaultReadAllArgs, config:          {}, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['rm', PkgName.Base])],
		processor:       BuiltInProcName.Rm, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['options', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: 'all' }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['mapply', PkgName.Base]), Identifier.from(['Mapply', PkgName.Functools])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, nameOfFunctionArgument: 'FUN' }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['lapply', PkgName.Base]), Identifier.from(['sapply', PkgName.Base]), Identifier.from(['vapply', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['Lapply', PkgName.Functools]), Identifier.from(['Sapply', PkgName.Functools]), Identifier.from(['Vapply', PkgName.Functools])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['apply', PkgName.Base]), Identifier.from(['tapply', PkgName.Base]), Identifier.from(['Tapply', PkgName.Functools])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 2, nameOfFunctionArgument: 'FUN' }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['print', PkgName.Base]), Identifier.from(['message', PkgName.Base]), Identifier.from(['warning', PkgName.Base]), Identifier.from(['warn', PkgName.Rlang]), Identifier.from(['warn', PkgName.Rutils]), Identifier.from(['info', PkgName.Msgr])],
		processor:       BuiltInProcName.Default, config:          { returnsNthArgument: 0, forceArgs: 'all', hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ } }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['invisible', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { returnsNthArgument: 0, forceArgs: 'all' }, assumePrimitive: true },
	// graphics base
	{ type:      'function', names:     PlotCreate,
		processor: BuiltInProcName.Default,
		config:    {
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				ignoreIf: (source: DataflowGraphVertexFunctionCall, graph: DataflowGraph) => {
					/* map with add = true appends to an existing plot */
					return (PlotFunctionsWithAddParam.has(Identifier.getName(source.name)) && getValueOfArgument(graph, source, {
						index: -1,
						name:  'add'
					}, [RType.Logical])?.content === true);
				},
				callName: toRegex(GraphicDeviceOpen)
			}
		}, assumePrimitive: true },
	// graphics addons
	{ type:      'function', names:     PlotAddons,
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
				cascadeIf: (target: DataflowGraphVertexFunctionCall, _: NodeId, graph: DataflowGraph) => {
					/* map with add = true appends to an existing plot */
					return Identifier.getName(target.name) ? (getValueOfArgument(graph, target, {
						index: 11,
						name:  'add'
					}, [RType.Logical])?.content === true ? CascadeAction.Continue : CascadeAction.Stop) : CascadeAction.Stop;
				}
			}
		}, assumePrimitive: true },
	// plot tags
	{
		type:      'function',
		names:     GgPlotAddons,
		processor: BuiltInProcName.Default,
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex((GgPlotCreate as readonly string[]).concat(GgPlotAddons))
			}
		}, assumePrimitive: true },
	{
		type:      'function',
		names:     TinyPlotAddons,
		processor: BuiltInProcName.Default,
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex([...TinyPlotCrate, ...TinyPlotAddons])
			}
		}, assumePrimitive: true },
	{
		type:  'function',
		names: [
			Identifier.from(['image_write', PkgName.Magick]), Identifier.from(['image_capture', PkgName.Magick]),
			Identifier.from(['dev.capture', PkgName.GrDevices]), Identifier.from(['dev.off', PkgName.GrDevices])
		],
		processor: BuiltInProcName.Default,
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex((GraphicDeviceOpen as readonly string[]).concat(PlotCreate, PlotAddons, GgPlotAddons, TinyPlotAddons))
			}
		}, assumePrimitive: true },
	{ type:            'function', names:           ['('],
		processor:       BuiltInProcName.Default, config:          { returnsNthArgument: 0 }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['load_all', PkgName.PkgLoad]), Identifier.from(['load_all', PkgName.Devtools]), Identifier.from(['setwd', PkgName.Base]), Identifier.from(['set.seed', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true] }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['body', PkgName.Base]), Identifier.from(['formals', PkgName.Base]), Identifier.from(['environment', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true, forceArgs: [true] }, assumePrimitive: true },
	{
		type:      'function',
		names:     [Identifier.from(['.Call', PkgName.Base]), Identifier.from(['.External', PkgName.Base]), Identifier.from(['.C', PkgName.Base]), Identifier.from(['.Fortran', PkgName.Base])],
		processor: BuiltInProcName.Default,
		config:    {
			hasUnknownSideEffects: true,
			forceArgs:             [true],
			treatAsFnCall:         {
				'.Call':     ['.NAME'],
				'.External': ['.NAME'],
				'.C':        ['.NAME'],
				'.Fortran':  ['.NAME']
			}
		},
		assumePrimitive: true
	},
	{ type:            'function', names:           [Identifier.from(['eval', PkgName.Base])],
		processor:       BuiltInProcName.Eval, config:          { includeFunctionCall: true, supportFunctionCall: false }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['evalText', PkgName.Soda])],
		processor:       BuiltInProcName.Eval, config:          { includeFunctionCall: true, supportFunctionCall: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['cat', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: 'all', hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ } }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['switch', PkgName.Base])],
		processor:       BuiltInProcName.Default, config:          { forceArgs: [true] }, assumePrimitive: false },
	{ type:            'function', names:           ['return'],
		processor:       BuiltInProcName.Default, config:          { returnsNthArgument: 0, cfg: ExitPointType.Return, useAsProcessor: BuiltInProcName.Return }, assumePrimitive: true },
	{
		type:  'function',
		names: [
			Identifier.from(['stop', PkgName.Base]),
			Identifier.from(['abort', PkgName.Rlang]), Identifier.from(['cli_abort', PkgName.Cli]),
			Identifier.from(['throw', PkgName.RmethodsS3]), Identifier.from(['throw', PkgName.Roo]), /* R.oo re-exports R.methodsS3::throw */
			Identifier.from(['stop_bad_type', PkgName.Purrr]), Identifier.from(['stop_bad_element_type', PkgName.Purrr]), Identifier.from(['stop_bad_element_length', PkgName.Purrr])
		],
		processor:       BuiltInProcName.Default,
		config:          { useAsProcessor: BuiltInProcName.Stop, cfg: ExitPointType.Error, forceArgs: ['all'] },
		assumePrimitive: false
	},
	{ type:            'function', names:           [Identifier.from(['try', PkgName.Base])],
		processor:       BuiltInProcName.Try, config:          { block: 'expr', handlers: {} }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['tryCatch', PkgName.Base]), Identifier.from(['tryCatchLog', PkgName.TryCatchLog])],
		processor:       BuiltInProcName.Try, config:          { block: 'expr', handlers: { error: 'error', finally: 'finally' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['stopifnot', PkgName.Base]), Identifier.from(['assert_that', PkgName.AssertThat])],
		processor:       BuiltInProcName.StopIfNot, config:          {}, assumePrimitive: false },
	{ type:            'function', names:           ['break'],
		processor:       BuiltInProcName.Default, config:          { useAsProcessor: BuiltInProcName.Break, cfg: ExitPointType.Break }, assumePrimitive: false },
	{ type:            'function', names:           ['next'],
		processor:       BuiltInProcName.Default, config:          { cfg: ExitPointType.Next }, assumePrimitive: false },
	{ type:            'function', names:           ['{'],
		processor:       BuiltInProcName.ExpressionList, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['source', PkgName.Base])],
		processor:       BuiltInProcName.Source, config:          { includeFunctionCall: true, forceFollow: false }, assumePrimitive: false },
	{ type:            'function', names:           ['[', '[['],
		processor:       BuiltInProcName.Access, config:          { treatIndicesAsString: false }, assumePrimitive: true },
	{ type:            'function', names:           ['$', '@'],
		processor:       BuiltInProcName.Access, config:          { treatIndicesAsString: true }, assumePrimitive: true },
	{ type:            'function', names:           ['::'],
		processor:       BuiltInProcName.NamespaceAccess, config:          { internal: false }, assumePrimitive: true },
	{ type:            'function', names:           [':::'],
		processor:       BuiltInProcName.NamespaceAccess, config:          { internal: true }, assumePrimitive: true },
	{ type:            'function', names:           ['if'],
		processor:       BuiltInProcName.IfThenElse, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['ifelse', PkgName.Base]), Identifier.from(['fifelse', PkgName.DataTable]), 'IfElse'],
		processor:       BuiltInProcName.IfThenElse, config:          { args: { cond: 'test', yes: 'yes', no: 'no' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['if_else', PkgName.Dplyr])],
		processor:       BuiltInProcName.IfThenElse, config:          { args: { cond: 'condition', yes: 'true', no: 'false' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['get', PkgName.Base])],
		processor:       BuiltInProcName.Get, config:          {}, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['from', PkgName.Import]), Identifier.from(['library', PkgName.Base]), Identifier.from(['require', PkgName.Base])],
		processor:       BuiltInProcName.Library, config:          {}, assumePrimitive: false },
	{ type:            'function', names:           ['<-', '='],
		processor:       BuiltInProcName.Assignment, config:          { canBeReplacement: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from([':=', PkgName.DataTable])],
		processor:       BuiltInProcName.Assignment, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['assign', PkgName.Base]), Identifier.from(['setValidity', PkgName.Methods])],
		processor:       BuiltInProcName.Assignment, config:          { targetVariable: true, mayHaveMoreArgs: true, environmentArg: 'envir' }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['setMethod', PkgName.Methods])],
		processor:       BuiltInProcName.AssignmentLike,
		config:          { targetVariable: true, canBeReplacement: false, target: { idx: 0, name: 'f' }, source: { idx: 2, name: 'definition' }, modesForFn: ['s4'] },
		assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['delayedAssign', PkgName.Base])],
		processor:       BuiltInProcName.Assignment, config:          { quoteSource: true, targetVariable: true }, assumePrimitive: true },
	{ type:            'function', names:           ['<<-'],
		processor:       BuiltInProcName.Assignment, config:          { superAssignment: true, canBeReplacement: true }, assumePrimitive: true },
	{ type:            'function', names:           ['->'],
		processor:       BuiltInProcName.Assignment, config:          { swapSourceAndTarget: true, canBeReplacement: true }, assumePrimitive: true },
	{ type:            'function', names:           ['->>'],
		processor:       BuiltInProcName.Assignment, config:          { superAssignment: true, swapSourceAndTarget: true, canBeReplacement: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['&&', PkgName.Base]), Identifier.from(['&', PkgName.Base])],
		processor:       BuiltInProcName.SpecialBinOp, config:          { lazy: true, evalRhsWhen: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['||', PkgName.Base]), Identifier.from(['|', PkgName.Base])],
		processor:       BuiltInProcName.SpecialBinOp, config:          { lazy: true, evalRhsWhen: false }, assumePrimitive: true },
	{ type:            'function', names:           ['|>'],
		processor:       BuiltInProcName.Pipe, config:          { pipePlaceholderName: '_' }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['%>%', PkgName.Magrittr]), '%!>%'], processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', rhsMightBeSymbol: true }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['%<>%', PkgName.Magrittr])],        processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', assignLhs: true, rhsMightBeSymbol: true }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['%T>%', PkgName.Magrittr])],        processor: BuiltInProcName.Pipe,               config: { pipePlaceholderName: '.', returnLhs: true, rhsMightBeSymbol: true }, assumePrimitive: true  },
	{ type:      'function', names:     [Identifier.from(['map', PkgName.Purrr]), Identifier.from(['map_lgl', PkgName.Purrr]), Identifier.from(['map_int', PkgName.Purrr]), Identifier.from(['map_dbl', PkgName.Purrr]), Identifier.from(['map_chr', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     [Identifier.from(['pmap', PkgName.Purrr]), Identifier.from(['pmap_lgl', PkgName.Purrr]), Identifier.from(['pmap_int', PkgName.Purrr]), Identifier.from(['pmap_dbl', PkgName.Purrr]), Identifier.from(['pmap_chr', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.l': { index: 0, name: '.l' }
		},
		'.f':   { index: 1, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     [Identifier.from(['map2', PkgName.Purrr]), Identifier.from(['map2_lgl', PkgName.Purrr]), Identifier.from(['map2_int', PkgName.Purrr]), Identifier.from(['map2_dbl', PkgName.Purrr]), Identifier.from(['map2_chr', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.x' },
			'.y': { index: 1, name: '.y' },
		},
		'.f':   { index: 2, name: '.f' },
		ignore: ['.progress']
	} },
	{ type:      'function', names:     [Identifier.from(['modify', PkgName.Purrr]), Identifier.from(['imodify', PkgName.Purrr]), Identifier.from(['imap', PkgName.Purrr]), Identifier.from(['imap_lgl', PkgName.Purrr]), Identifier.from(['imap_int', PkgName.Purrr]), Identifier.from(['imap_dbl', PkgName.Purrr]), Identifier.from(['imap_chr', PkgName.Purrr]), Identifier.from(['imap_vec', PkgName.Purrr]), Identifier.from(['lmap', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
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
	{ type:      'function', names:     [Identifier.from(['map_at', PkgName.Purrr]), Identifier.from(['modify_at', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
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
	{ type:      'function', names:     [Identifier.from(['map_if', PkgName.Purrr]), Identifier.from(['modify_if', PkgName.Purrr]), Identifier.from(['lmap_if', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
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
	{ type:      'function', names:     [Identifier.from(['map_depth', PkgName.Purrr]), Identifier.from(['modify_depth', PkgName.Purrr])], processor: BuiltInProcName.PurrrFormula, config:    {
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
	{ type:      'function', names:     [Identifier.from(['filter', PkgName.Dplyr]), Identifier.from(['filter_out', PkgName.Janitor])], processor: BuiltInProcName.PurrrFormula, config:    {
		args: {
			'.x': { index: 0, name: '.data' },
		},
		'.f':   { index: 1, name: '...' },
		ignore: ['.by', '.preserve']
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
	{ type:            'function', names:           [Identifier.from(['quote', PkgName.Base]), Identifier.from(['bquote', PkgName.Base])],
		processor:       BuiltInProcName.Quote, config:          { quoteArgumentsWithIndex: 0 }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['substitute', PkgName.Base])],
		processor:       BuiltInProcName.Quote, config:          { quoteArgumentsWithIndex: 0, envArgIndex: 1 }, assumePrimitive: true },
	{ type: 'function', names: [Identifier.from(['enquo', PkgName.Rlang]), Identifier.from(['enquos', PkgName.Rlang]), Identifier.from(['quo', PkgName.Rlang]), Identifier.from(['quos', PkgName.Rlang]), Identifier.from(['sym', PkgName.Rlang]), Identifier.from(['syms', PkgName.Rlang]), Identifier.from(['ensym', PkgName.Rlang]), Identifier.from(['ensyms', PkgName.Rlang]), Identifier.from(['expr', PkgName.Rlang]), Identifier.from(['exprs', PkgName.Rlang]), Identifier.from(['quo_name', PkgName.Rlang]), Identifier.from(['as_name', PkgName.Rlang]), Identifier.from(['as_label', PkgName.Rlang]), Identifier.from(['as_string', PkgName.Rlang])], processor: BuiltInProcName.Quote, config: { quoteArgumentsWithIndex: 0, libFn: true }, assumePrimitive: true  },
	{ type: 'function', names: [Identifier.from(['call2', PkgName.Rlang]), Identifier.from(['exec', PkgName.Rlang]), Identifier.from(['invoke', PkgName.Purrr]), Identifier.from(['invoke_map', PkgName.Purrr])],                                                             processor: BuiltInProcName.Default,               config: { libFn: true, hasUnknownSideEffects: true, unquoteFunction: true },                      assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['local', PkgName.Base])],
		processor:       BuiltInProcName.Local, config:          { args: { env: 'envir', expr: 'expr' } }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['with', PkgName.Base]), Identifier.from(['within', PkgName.Base])],
		processor:       BuiltInProcName.With, config:          {}, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['new.env', PkgName.Base]), Identifier.from(['new_environment', PkgName.Rlang])],
		processor:       BuiltInProcName.NewEnv, config:          {}, assumePrimitive: true },
	{ type:  'function', names: [
		Identifier.from(['globalenv', PkgName.Base]),     Identifier.from(['baseenv', PkgName.Base]),
		Identifier.from(['emptyenv', PkgName.Base]),      Identifier.from(['parent.env', PkgName.Base]),
		Identifier.from(['parent.frame', PkgName.Base]),  Identifier.from(['environmentName', PkgName.Base]),
		Identifier.from(['as.environment', PkgName.Base]), Identifier.from(['pos.to.env', PkgName.Base]),
		Identifier.from(['sys.frame', PkgName.Base]),     Identifier.from(['sys.frames', PkgName.Base]),
		Identifier.from(['topenv', PkgName.Base]),
	], processor: BuiltInProcName.Default, config: {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['load', PkgName.Base]), 'load_image'],
		processor:       BuiltInProcName.Default, config:          { hasUnknownSideEffects: true }, assumePrimitive: false },
	/* attach injects an environment's contents into the search path; detach reverses it (treated as unknown side effect) */
	{ type:            'function', names:           [Identifier.from(['attach', PkgName.Base])],
		processor:       BuiltInProcName.Attach, config:          {}, assumePrimitive: false },
	{ type: 'function', names: ['for'],    processor: BuiltInProcName.ForLoop,    config: {}, assumePrimitive: true },
	{ type: 'function', names: ['repeat'], processor: BuiltInProcName.RepeatLoop, config: {}, assumePrimitive: true },
	{ type: 'function', names: ['while'],  processor: BuiltInProcName.WhileLoop,  config: {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['do.call', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, unquoteFunction: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['UseMethod', PkgName.Base])],
		processor:       BuiltInProcName.S3Dispatch, config:          { args: { generic: 'generic', object: 'object' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['NextMethod', PkgName.Base])],
		processor:       BuiltInProcName.S3Dispatch, config:          { args: { generic: 'generic', object: 'object' }, inferFromClosure: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['new_generic', PkgName.S7])],
		processor:       BuiltInProcName.S7NewGeneric, config:          { args: { name: 'name', dispatchArg: 'dispatch_args', fun: 'fun' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['setGeneric', PkgName.Methods])],
		processor:       BuiltInProcName.S7NewGeneric, config:          { args: { name: 'name', dispatchArg: undefined, fun: 'fun' } }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['S7_dispatch', PkgName.S7])],
		processor:       BuiltInProcName.S7Dispatch, config:          { libFn: true }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['.Primitive', PkgName.Base]), Identifier.from(['.Internal', PkgName.Base])],
		processor:       BuiltInProcName.Apply, config:          { indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['interference', PkgName.Inferference])],
		processor:       BuiltInProcName.Apply, config:          { unquoteFunction: true, nameOfFunctionArgument: 'propensity_integrand', libFn: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['ddply', PkgName.Plyr])],
		processor:       BuiltInProcName.Apply, config:          { unquoteFunction: true, indexOfFunction: 2, nameOfFunctionArgument: '.fun', libFn: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['list', PkgName.Base])],
		processor:       BuiltInProcName.List, config:          {}, assumePrimitive: true },
	{ type:            'function', names:           [Identifier.from(['Recall', PkgName.Base])],
		processor:       BuiltInProcName.Recall, config:          { libFn: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['sys.function', PkgName.Base])],
		processor:       BuiltInProcName.Recall, config:          { libFn: true, unknownOnNonZeroArg: true }, assumePrimitive: false },
	{ type:            'function', names:           [Identifier.from(['c', PkgName.Base])],
		processor:       BuiltInProcName.Vector, config:          {}, assumePrimitive: true, evalHandler:     'built-in:c' },
	{ type: 'function', names: [Identifier.from(['cmpfun', PkgName.Compiler]), Identifier.from(['compile', PkgName.Compiler])], processor: BuiltInProcName.Default, config: { returnsNthArgument: 0 } },
	{ type: 'function', names: [Identifier.from(['loadcmp', PkgName.Compiler])],                                                processor: BuiltInProcName.Default, config: { hasUnknownSideEffects: true } },
	{
		type:  'function',
		names: [
			Identifier.from(['setnames', PkgName.DataTable]), Identifier.from(['setNames', PkgName.Base]),
			Identifier.from(['setkey', PkgName.DataTable]),   Identifier.from(['setkeyv', PkgName.DataTable]),
			Identifier.from(['setindex', PkgName.DataTable]), Identifier.from(['setindexv', PkgName.DataTable]),
			Identifier.from(['setattr', PkgName.DataTable])
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
			Identifier.from(['sys.on.exit', PkgName.Base]), Identifier.from(['par', PkgName.Graphics]),
			Identifier.from(['tpar', PkgName.TinyPlot]),    Identifier.from(['sink', PkgName.Base]),
			/* library and require is handled above */
			Identifier.from(['requireNamespace', PkgName.Base]), Identifier.from(['loadNamespace', PkgName.Base]),
			Identifier.from(['attachNamespace', PkgName.Base]),  Identifier.from(['asNamespace', PkgName.Base]),
			Identifier.from(['use', PkgName.Base]),
			/* env attachment */
			Identifier.from(['unname', PkgName.Base]), Identifier.from(['data', PkgName.Utils]),
			/* file creation/removal (base) */
			Identifier.from(['dir.create', PkgName.Base]),  Identifier.from(['dir_create', PkgName.Fs]),
			Identifier.from(['Sys.chmod', PkgName.Base]),   Identifier.from(['unlink', PkgName.Base]),
			Identifier.from(['file.remove', PkgName.Base]), Identifier.from(['file.rename', PkgName.Base]),
			Identifier.from(['file.copy', PkgName.Base]),   Identifier.from(['file.link', PkgName.Base]),
			Identifier.from(['file.append', PkgName.Base]), Identifier.from(['Sys.junction', PkgName.Base]),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true },
		assumePrimitive: false
	},
	{
		type:  'function',
		names: [
			Identifier.from(['tinytheme', PkgName.TinyPlot]), Identifier.from(['theme_set', PkgName.GgPlot2]),
			Identifier.from(['context', PkgName.Testthat]),
			/* installers (utils / devtools / remotes; devtools re-exports the entire remotes install API) */
			Identifier.from(['library.dynam', PkgName.Base]),
			Identifier.from(['install.packages', PkgName.Utils]),
			Identifier.from(['install', PkgName.Devtools]),
			Identifier.from(['install_github', PkgName.Remotes]),    Identifier.from(['install_github', PkgName.Devtools]),
			Identifier.from(['install_gitlab', PkgName.Remotes]),    Identifier.from(['install_gitlab', PkgName.Devtools]),
			Identifier.from(['install_bitbucket', PkgName.Remotes]), Identifier.from(['install_bitbucket', PkgName.Devtools]),
			Identifier.from(['install_url', PkgName.Remotes]),       Identifier.from(['install_url', PkgName.Devtools]),
			Identifier.from(['install_git', PkgName.Remotes]),       Identifier.from(['install_git', PkgName.Devtools]),
			Identifier.from(['install_svn', PkgName.Remotes]),       Identifier.from(['install_svn', PkgName.Devtools]),
			Identifier.from(['install_local', PkgName.Remotes]),     Identifier.from(['install_local', PkgName.Devtools]),
			Identifier.from(['install_version', PkgName.Remotes]),   Identifier.from(['install_version', PkgName.Devtools]),
			Identifier.from(['update_packages', PkgName.Remotes]),   Identifier.from(['update_packages', PkgName.Devtools]),
		],
		processor:       BuiltInProcName.Default,
		config:          { hasUnknownSideEffects: true, libFn: true },
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
	/* they are all mapped to `<-` but we separate super assignments */
	{
		type:     'replacement',
		suffixes: ['<-', '<<-'],
		names:    [
			'[', '[[',
			Identifier.from(['names', PkgName.Base]),      Identifier.from(['dimnames', PkgName.Base]),
			Identifier.from(['attributes', PkgName.Base]), Identifier.from(['attr', PkgName.Base]),
			Identifier.from(['class', PkgName.Base]),      Identifier.from(['levels', PkgName.Base]),
			Identifier.from(['rownames', PkgName.Base]),   Identifier.from(['colnames', PkgName.Base]),
			Identifier.from(['body', PkgName.Base]),       Identifier.from(['environment', PkgName.Base]),
			Identifier.from(['formals', PkgName.Base]),
		],
		config: { readIndices: true }
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
		config:   { readIndices: false }
	},
] as const satisfies BuiltInDefinitions;


/**
 * Expensive and naive lookup of the default processor for a built-in function name
 */
export function getDefaultProcessor(name: string): BuiltInProcName | undefined {
	if(name.startsWith(UnnamedFunctionCallPrefix)) {
		return BuiltInProcName.Unnamed;
	}
	const fn = DefaultBuiltinConfig.find(def =>
		((def.names as readonly Identifier[]).some(n => Identifier.getName(n) === name) && def.type !== 'constant')
		|| (def.type === 'replacement' && def.suffixes.flatMap(d => def.names.map(n => `${Identifier.getName(n as Identifier)}${d}`)).includes(name))
	) as BuiltInFunctionDefinition<BuiltInProcName.Default | BuiltInProcName.DefaultReadAllArgs> | BuiltInReplacementDefinition | undefined;
	if(fn?.type === 'replacement') {
		return BuiltInProcName.Replacement;
	}
	return fn?.processor === BuiltInProcName.DefaultReadAllArgs ? BuiltInProcName.Default : fn?.processor as BuiltInProcName;
}
