import type { BuiltInDefinitions, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from './built-in-config';
import { ExitPointType } from '../info';
import { getValueOfArgument } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { DataflowGraph } from '../graph/graph';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataflowGraphVertexFunctionCall } from '../graph/vertex';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import type { BuiltInMappingName } from './built-in';
import { UnnamedFunctionCallPrefix } from '../internal/process/functions/call/unnamed-call-handling';
import { KnownHooks } from '../hooks';

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
	'geom_count','geom_bin_2d','geom_spoke','geom_tile','geom_rect',
	'geom_function','geom_crossbar','geom_density2d','geom_abline','geom_errorbar','geom_errorbarh',
	'geom_jitter','geom_line','geom_density','geom_quantile','geom_qq','geom_qq_line','geom_segment','geom_label','geom_density_2d',
	'geom_violin','geom_contour','geom_boxplot','geom_col','geom_blank','geom_histogram','geom_hline','geom_area','geom_sf_text','geom_smooth','geom_text',
	'geom_density2d_filled','geom_ribbon','geom_sf','geom_dotplot','geom_freqpoly','geom_step','geom_map','geom_bin2d','geom_rug','geom_raster','geom_pointrange','geom_point',
	'geom_hex','geom_contour_filled','geom_bar','geom_vline','geom_linerange','geom_curve','geom_path','geom_polygon','geom_sf_label','geom_density_2d_filled', 'geom_dumbbell',
	'geom_encircle', 'stat_count','stat_density','stat_bin_hex','stat_bin_2d','stat_summary_bin','stat_identity','stat_qq','stat_binhex','stat_boxplot','stat_function',
	'stat_align','stat_contour_filled','stat_summary_2d','stat_qq_line','stat_contour','stat_ydensity','stat_summary_hex','stat_summary2d','stat_sf_coordinates',
	'stat_density_2d_filled','stat_smooth','stat_density2d','stat_ecdf','stat_sf','stat_quantile','stat_unique','stat_density_2d','stat_ellipse','stat_summary',
	'stat_density2d_filled','stat_bin','stat_sum','stat_spoke','stat_bin2d',
	'labs', 'theme_void','theme_test','theme_minimal','theme_light','theme','theme_get','theme_gray','theme_dark','theme_classic','theme_linedraw','theme_update',
	'theme_replace','theme_grey','theme_bw','theme_tufte','theme_survminer','facet_null', 'facet_grid', 'facet_wrap', 'xlab', 'xlim', 'ylab', 'ylim',
	'scale_linewidth_ordinal','scale_fill_steps','scale_color_gradient2','scale_size_manual','scale_colour_discrete','scale_color_identity',
	'scale_fill_fermenter','scale_alpha_manual','scale_fill_gradient','scale_size_date','scale_fill_viridis_b','scale_x_time','scale_linetype_manual',
	'scale_alpha_binned','scale_color_grey','scale_colour_gradient','scale_linewidth_date','scale_color_steps2','scale_color_viridis_b','scale_size_binned',
	'scale_colour_gradientn','scale_linewidth_manual','scale_fill_viridis_c','scale_fill_manual','scale_color_viridis_c','scale_fill_discrete','scale_size_discrete',
	'scale_fill_binned','scale_fill_viridis_d','scale_colour_fermenter','scale_color_viridis_d','scale_x_datetime','scale_size_identity','scale_linewidth_identity',
	'scale_shape_ordinal','scale_linewidth_discrete','scale_fill_ordinal','scale_y_time','scale_color_ordinal','scale_size_ordinal','scale_colour_distiller',
	'scale_linewidth_datetime','scale_alpha_identity','scale_color_steps','scale_alpha_discrete','scale_fill_date','scale_x_reverse','scale_fill_gradientn','scale_size_datetime',
	'scale_y_continuous','scale_colour_steps','scale_color_distiller','scale_colour_ordinal','scale_y_datetime','scale_linetype_discrete','scale_colour_viridis_b',
	'scale_alpha_datetime','scale_continuous_identity','scale_fill_brewer','scale_shape_identity','scale_color_discrete','scale_colour_viridis_c','scale_linetype_identity',
	'scale_colour_hue','scale_linewidth_binned','scale_color_hue','scale_shape_continuous','scale_colour_viridis_d','scale_size_continuous','scale_color_manual','scale_alpha_date',
	'scale_y_sqrt','scale_shape_binned','scale_size','scale_color_fermenter','scale_color_stepsn','scale_size_area','scale_y_binned','scale_y_discrete','scale_alpha_continuous',
	'scale_fill_continuous','scale_linetype_continuous','scale_colour_steps2','scale_colour_datetime','scale_colour_grey','scale_x_log10','scale_x_discrete','scale_color_continuous',
	'scale_type','scale_y_reverse','scale_colour_gradient2','scale_color_datetime','scale_color_date','scale_x_continuous','scale_colour_manual','scale_fill_gradient2',
	'scale_fill_grey','scale_colour_stepsn','scale_colour_binned','scale_color_binned','scale_color_gradientn','scale_colour_date','scale_fill_distiller','scale_color_gradient',
	'scale_linewidth_continuous','scale_shape','scale_fill_hue','scale_linetype','scale_colour_identity','scale_discrete_manual','scale_fill_identity','scale_y_log10',
	'scale_linetype_binned','scale_size_binned_area','scale_y_date','scale_x_binned','scale_shape_discrete','scale_colour_brewer','scale_x_date','scale_discrete_identity',
	'scale_alpha','scale_fill_steps2','scale_color_brewer','scale_fill_datetime','scale_shape_manual','scale_colour_continuous','scale_alpha_ordinal','scale_linewidth','scale_x_sqrt',
	'scale_fill_stepsn','scale_radius', 'rotateTextX', 'removeGridX', 'removeGridY', 'removeGrid',
	'coord_trans','coord_sf','coord_cartesian','coord_fixed','coord_flip','coord_quickmap','coord_equal','coord_map','coord_polar','coord_munch','coord_radial',
	'annotate', 'annotation_custom','annotation_raster','annotation_map','annotation_logticks', 'borders', 'ggtitle', 'expansion', 'expand_limits', 'expand_scale', 'guides',
	'wrap_by',
	'theme_solid','theme_hc','theme_excel_new','theme_few','theme_clean','theme_wsj','theme_calc','theme_par','theme_tufte','theme_igray','theme_solarized_2','theme_excel',
	'theme_economist','theme_stata','theme_map','theme_fivethirtyeight','theme_economist_white','theme_base','theme_foundation','theme_gdocs','theme_pander','theme_solarized',
	'scale_shape_tableau','scale_fill_pander','scale_shape_few','scale_colour_excel_new','scale_colour_hc','scale_fill_ptol','scale_fill_gradient2_tableau','scale_shape_calc','scale_fill_stata',
	'scale_colour_tableau','scale_colour_colorblind','scale_color_stata','scale_colour_economist','scale_fill_calc','scale_fill_gradient_tableau','scale_shape_cleveland','scale_color_pander',
	'scale_colour_pander','scale_color_fivethirtyeight','scale_color_wsj','scale_shape_stata','scale_colour_gdocs','scale_color_continuous_tableau','scale_fill_excel','scale_color_few','scale_linetype_stata',
	'scale_shape_tremmel','scale_color_tableau','scale_color_colorblind','scale_fill_colorblind','scale_colour_stata','scale_fill_wsj','scale_colour_calc','scale_colour_fivethirtyeight','scale_fill_hc',
	'scale_shape_circlefill','scale_fill_excel_new','scale_color_solarized','scale_color_excel','scale_colour_excel','scale_fill_tableau','scale_colour_ptol','scale_colour_canva','scale_color_gradient2_tableau',
	'scale_colour_solarized','scale_colour_gradient2_tableau','scale_fill_canva','scale_color_ptol','scale_color_excel_new','scale_color_economist','scale_fill_economist','scale_fill_fivethirtyeight',
	'scale_colour_gradient_tableau','scale_colour_few','scale_color_calc','scale_fill_few','scale_fill_gdocs','scale_color_hc','scale_color_gdocs','scale_color_canva','scale_color_gradient_tableau',
	'scale_fill_solarized','scale_fill_continuous_tableau','scale_colour_wsj', 'gradient_color', 'ggsurvplot_add_all'
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
function toRegex(n: readonly string[]): RegExp {
	return new RegExp(`^(${
		Array.from(new Set(n)).map(s => s.replace(RegexConvIn, '\\$&')).filter(s => s.length > 0).join('|')
	})$`);
}

/**
 * Contains the built-in definitions recognized by flowR
 */
export const DefaultBuiltinConfig = [
	{ type: 'constant', names: ['NULL', 'NA', 'NaN', 'NA_integer_', 'NA_real_', 'NA_complex_', 'NA_character_'],  value: null,  assumePrimitive: true },
	{ type: 'constant', names: ['TRUE', 'T'],   value: true,  assumePrimitive: true },
	{ type: 'constant', names: ['FALSE', 'F'],  value: false, assumePrimitive: true },
	{
		type:  'function',
		names: [
			'~', '+', '-', '*', '/', '^', '!', '?', '**', '==', '!=', '>', '<', '>=', '<=', '%%', '%/%', '%*%', '%in%', ':',
			'rep', 'seq', 'seq_len', 'seq_along', 'seq.int', 'gsub', 'which', 'class', 'dimnames', 'min', 'max',
			'intersect', 'subset', 'match', 'sqrt', 'abs', 'round', 'floor', 'ceiling', 'signif', 'trunc', 'log', 'log10', 'log2', 'sum', 'mean',
			'unique', 'paste', 'paste0', 'read.csv', 'is.null', 'numeric', 'as.character', 'as.integer', 'as.logical', 'as.numeric', 'as.matrix',
			'rbind', 'nrow', 'ncol', 'tryCatch', 'expression', 'factor',
			'missing', 'as.data.frame', 'data.frame', 'na.omit', 'rownames', 'names', 'order', 'length', 'any', 'dim', 'matrix', 'cbind', 'nchar',
			'pdf', 'jpeg', 'png', 'windows', 'postscript', 'xfig', 'bitmap', 'pictex', 'cairo_pdf', 'svg', 'bmp', 'tiff', 'X11', 'quartz',
			'jitter'
		],
		processor:       'builtin:default',
		config:          { readAllArguments: true },
		assumePrimitive: true
	},
	{
		type:  'function',
		names: [
			't', 'aperm' /* transpose function, permutation generation */
		],
		processor:       'builtin:default',
		config:          { readAllArguments: true },
		assumePrimitive: false
	},
	{ type: 'function', names: ['rm'],                                         processor: 'builtin:rm',                  config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['options'],                                    processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: 'all' },                            assumePrimitive: false },
	{ type: 'function', names: ['mapply', 'Mapply'],                           processor: 'builtin:apply',               config: { indexOfFunction: 0, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false },
	{ type: 'function', names: ['lapply', 'sapply', 'vapply'],                 processor: 'builtin:apply',               config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false },
	{ type: 'function', names: ['Lapply', 'Sapply', 'Vapply'],                 processor: 'builtin:apply',               config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false }, /* functool wrappers */
	{ type: 'function', names: ['apply', 'tapply', 'Tapply'],                  processor: 'builtin:apply',               config: { indexOfFunction: 2, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false },
	{ type: 'function', names: ['print', 'message', 'warning'],                processor: 'builtin:default',             config: { returnsNthArgument: 0, forceArgs: 'all', hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ } },                                  assumePrimitive: false },
	// graphics base
	{ type:      'function', names:     PlotCreate,
		processor: 'builtin:default',
		config:    {
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				ignoreIf: (source: DataflowGraphVertexFunctionCall, graph: DataflowGraph) => {
					/* map with add = true appends to an existing plot */
					return (PlotFunctionsWithAddParam.has(source.name) && getValueOfArgument(graph, source, {
						index: -1,
						name:  'add'
					}, [RType.Logical])?.content === true);
				},
				callName: toRegex(GraphicDeviceOpen)
			}
		}, assumePrimitive: true },
	// graphics addons
	{ type:      'function', names:     PlotAddons,
		processor: 'builtin:default',             config:    {
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
					return (PlotFunctionsWithAddParam.has(sourceVertex.name ?? '') && getValueOfArgument(graph, sourceVertex, {
						index: -1,
						name:  'add'
					}, [RType.Logical])?.content !== true);
				},
				cascadeIf: (target: DataflowGraphVertexFunctionCall, _: NodeId, graph: DataflowGraph) => {
					/* map with add = true appends to an existing plot */
					return target.name === 'map' ? (getValueOfArgument(graph, target, {
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
		processor: 'builtin:default',
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
		processor: 'builtin:default',
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex([...TinyPlotCrate, ...TinyPlotAddons])
			}
		}, assumePrimitive: true },
	{
		type:      'function',
		names:     ['image_write', 'image_capture', 'dev.capture', 'dev.off'],
		processor: 'builtin:default',
		config:    {
			libFn:                 true,
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex((GraphicDeviceOpen as readonly string[]).concat(PlotCreate, PlotAddons, GgPlotAddons, TinyPlotAddons))
			}
		}, assumePrimitive: true },
	{ type: 'function', names: ['('],                                          processor: 'builtin:default',             config: { returnsNthArgument: 0 },                                                     assumePrimitive: true  },
	{ type: 'function', names: ['load', 'load_all', 'setwd', 'set.seed'],      processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: [true] },                            assumePrimitive: false },
	{ type: 'function', names: ['body', 'formals', 'environment'],             processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: [true] },                            assumePrimitive: true },
	{ type:      'function',
		names:     ['.Call', '.External', '.C', '.Fortran'],
		processor: 'builtin:default',
		config:    { hasUnknownSideEffects: true, forceArgs:             [true],
			treatAsFnCall:         {
				'.Call':     ['.NAME'],
				'.External': ['.NAME'],
				'.C':        ['.NAME'],
				'.Fortran':  ['.NAME']
			}
		},                            assumePrimitive: true },
	{ type: 'function', names: ['eval'],                                       processor: 'builtin:eval',                config: { includeFunctionCall: true },                                                 assumePrimitive: true },
	{ type: 'function', names: ['cat'],                                        processor: 'builtin:default',             config: { forceArgs: 'all', hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ } },                                                         assumePrimitive: false },
	{ type: 'function', names: ['switch'],                                     processor: 'builtin:default',             config: { forceArgs: [true] },                                                         assumePrimitive: false },
	{ type: 'function', names: ['return'],                                     processor: 'builtin:default',             config: { returnsNthArgument: 0, cfg: ExitPointType.Return, useAsProcessor: 'builtin:return' }, assumePrimitive: true },
	{ type: 'function', names: ['stop', 'abort'],                              processor: 'builtin:default',             config: { useAsProcessor: 'builtin:stop', cfg: ExitPointType.Error, forceArgs: ['all'] }, assumePrimitive: false },
	{ type: 'function', names: ['try'],                                        processor: 'builtin:try',                 config: { block: 'expr', handlers: {} }, assumePrimitive: true },
	{ type: 'function', names: ['tryCatch', 'tryCatchLog'],                    processor: 'builtin:try',                 config: { block: 'expr', handlers: { error: 'error', finally: 'finally' } }, assumePrimitive: true },
	{ type: 'function', names: ['stopifnot'],                                  processor: 'builtin:stopifnot',           config: { },                                                                           assumePrimitive: false },
	{ type: 'function', names: ['break'],                                      processor: 'builtin:default',             config: { useAsProcessor: 'builtin:break', cfg: ExitPointType.Break },                 assumePrimitive: false },
	{ type: 'function', names: ['next'],                                       processor: 'builtin:default',             config: { cfg: ExitPointType.Next },                                                   assumePrimitive: false },
	{ type: 'function', names: ['{'],                                          processor: 'builtin:expression-list',     config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['source'],                                     processor: 'builtin:source',              config: { includeFunctionCall: true, forceFollow: false },                             assumePrimitive: false },
	{ type: 'function', names: ['[', '[['],                                    processor: 'builtin:access',              config: { treatIndicesAsString: false },                                               assumePrimitive: true  },
	{ type: 'function', names: ['$', '@'],                                     processor: 'builtin:access',              config: { treatIndicesAsString: true },                                                assumePrimitive: true  },
	{ type: 'function', names: ['if', 'ifelse'],                               processor: 'builtin:if-then-else',        config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['get'],                                        processor: 'builtin:get',                 config: {},                                                                            assumePrimitive: false },
	{ type: 'function', names: ['library', 'require'],                         processor: 'builtin:library',             config: {},                                                                            assumePrimitive: false },
	{ type: 'function', names: ['<-', '='],                                    processor: 'builtin:assignment',          config: { canBeReplacement: true },                                                    assumePrimitive: true  },
	{ type: 'function', names: [':='],                                         processor: 'builtin:assignment',          config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['assign', 'setGeneric', 'setValidity'],        processor: 'builtin:assignment',          config: { targetVariable: true },                                                      assumePrimitive: true  },
	{ type: 'function', names: ['setMethod'],                                  processor: 'builtin:assignment-like',     config: { targetVariable: true, canBeReplacement: false, target: { idx: 0, name: 'f' }, source: { idx: 2, name: 'definition' } }, assumePrimitive: true  },
	{ type: 'function', names: ['delayedAssign'],                              processor: 'builtin:assignment',          config: { quoteSource: true, targetVariable: true },                                   assumePrimitive: true  },
	{ type: 'function', names: ['<<-'],                                        processor: 'builtin:assignment',          config: { superAssignment: true, canBeReplacement: true },                             assumePrimitive: true  },
	{ type: 'function', names: ['->'],                                         processor: 'builtin:assignment',          config: { swapSourceAndTarget: true, canBeReplacement: true },                         assumePrimitive: true  },
	{ type: 'function', names: ['->>'],                                        processor: 'builtin:assignment',          config: { superAssignment: true, swapSourceAndTarget: true, canBeReplacement: true },  assumePrimitive: true  },
	{ type: 'function', names: ['&&', '&'],                                    processor: 'builtin:special-bin-op',      config: { lazy: true, evalRhsWhen: true },                                             assumePrimitive: true  },
	{ type: 'function', names: ['||', '|'],                                    processor: 'builtin:special-bin-op',      config: { lazy: true, evalRhsWhen: false },                                            assumePrimitive: true  },
	{ type: 'function', names: ['|>', '%>%'],                                  processor: 'builtin:pipe',                config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['function', '\\'],                             processor: 'builtin:function-definition', config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['quote', 'substitute', 'bquote'],              processor: 'builtin:quote',               config: { quoteArgumentsWithIndex: 0 },                                                assumePrimitive: true  },
	{ type: 'function', names: ['for'],                                        processor: 'builtin:for-loop',            config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['repeat'],                                     processor: 'builtin:repeat-loop',         config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['while'],                                      processor: 'builtin:while-loop',          config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['do.call'],                                    processor: 'builtin:apply',               config: { indexOfFunction: 0, unquoteFunction: true },                                 assumePrimitive: true  },
	{ type: 'function', names: ['UseMethod', 'NextMethod'],                    processor: 'builtin:apply',               config: { indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, assumePrimitive: true  },
	{ type: 'function', names: ['.Primitive', '.Internal'],                    processor: 'builtin:apply',               config: { indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, assumePrimitive: true  },
	{ type: 'function', names: ['interference'],                               processor: 'builtin:apply',               config: { unquoteFunction: true, nameOfFunctionArgument: 'propensity_integrand', libFn: true },     assumePrimitive: false },
	{ type: 'function', names: ['ddply'],                                      processor: 'builtin:apply',               config: { unquoteFunction: true, indexOfFunction: 2, nameOfFunctionArgument: '.fun', libFn: true }, assumePrimitive: false },
	{ type: 'function', names: ['list'],                                       processor: 'builtin:list',                config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['c'],                                          processor: 'builtin:vector',              config: {},                                                                            assumePrimitive: true, evalHandler: 'builtin:c'  },
	{
		type:      'function',
		names:     ['setnames', 'setNames', 'setkey', 'setkeyv', 'setindex', 'setindexv', 'setattr'],
		processor: 'builtin:assignment',
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
			'sys.on.exit', 'par', 'tpar', 'sink',
			/* library and require is handled above */
			'requireNamespace', 'loadNamespace', 'attachNamespace', 'asNamespace',
			/* weird env attachments */
			'attach', 'unname', 'data',
			/* file creation/removal */
			'dir.create', 'dir_create', 'Sys.chmod', 'unlink', 'file.remove', 'file.rename', 'file.copy', 'file.link', 'file.append', 'Sys.junction'
		],
		processor:       'builtin:default',
		config:          { hasUnknownSideEffects: true },
		assumePrimitive: false
	},
	{
		type:  'function',
		names: [
			'tinytheme', 'theme_set',
			/* downloader and installer functions (R, devtools, BiocManager) */
			'library.dynam', 'install.packages','install', 'install_github', 'install_gitlab', 'install_bitbucket', 'install_url', 'install_git', 'install_svn', 'install_local', 'install_version', 'update_packages',
		],
		processor:       'builtin:default',
		config:          { hasUnknownSideEffects: true, libFn: true },
		assumePrimitive: false
	},
	{
		type:      'function',
		names:     ['on.exit'],
		processor: 'builtin:register-hook',
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
		names:    ['[', '[[', 'names', 'dimnames', 'attributes', 'attr', 'class', 'levels', 'rownames', 'colnames', 'body', 'environment', 'formals'],
		config:   {
			readIndices: true
		}
	},
	{
		type:     'replacement',
		suffixes: ['<-', '<<-'],
		names:    ['$', '@'],
		config:   {
			readIndices: false
		}
	}
] as const satisfies BuiltInDefinitions;


/**
 * Expensive and naive lookup of the default processor for a built-in function name
 */
export function getDefaultProcessor(name: string): BuiltInMappingName | 'unnamed' | undefined {
	if(name.startsWith(UnnamedFunctionCallPrefix)) {
		return 'unnamed';
	}
	const fn = DefaultBuiltinConfig.find(def => ((def.names as string[]).includes(name) && def.type !== 'constant')
	|| (def.type === 'replacement' && def.suffixes.flatMap(d => def.names.map(n => `${n}${d}`)).includes(name))
	) as BuiltInFunctionDefinition<'builtin:default'> | BuiltInReplacementDefinition | undefined;
	return fn?.type === 'replacement' ? 'builtin:replacement' : fn?.processor as BuiltInMappingName;
}
