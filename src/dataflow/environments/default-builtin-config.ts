import type { BuiltInDefinitions } from './built-in-config';
import { ExitPointType } from '../info';
import { getValueOfArgument } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import type { DataflowGraph } from '../graph/graph';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { DataflowGraphVertexFunctionCall } from '../graph/vertex';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';

const GgPlotCreate = [
	'ggplot', 'ggplotly', 'ggMarginal', 'ggcorrplot', 'ggseasonplot', 'ggdendrogram', 'qmap', 'qplot', 'quickplot', 'autoplot'
] as const;
const TinyPlotCrate = [
	'tinyplot', 'plt'
] as const;
const PlotCreate = [
	'plot', 'plot.new', 'xspline', 'map', 'curve', 'image', 'boxplot', 'dotchart', 'sunflowerplot', 'barplot', 'matplot', 'hist', 'stem',
	'density', 'smoothScatter', 'contour', 'persp', 'XYPlot', 'xyplot', 'stripplot', 'bwplot', 'dotPlot', 'dotplot', 'histPlot', 'densityPlot', 'qPlot', 'qqPlot', 'boxPlot',
	'bxp', 'assocplot', 'mosaicplot', 'stripchart', 'fourfoldplot', 'mosaicplot', 'plot.xy', 'plot.formula', 'plot.default', 'plot.design', 'stars',
	'spineplot', 'Plotranges', 'regressogram', 'bootcurve', 'meanplot', 'vioplot', 'pairs', 'copolot', 'histogram', 'splom', 'leaflet', 'tm_shape', 'plot_ly',
	...TinyPlotCrate,
	...GgPlotCreate
] as const;
const GraphicDeviceOpen = [
	'pdf', 'jpeg', 'png', 'windows', 'postscript', 'xfig', 'bitmap', 'pictex', 'cairo_pdf', 'svg', 'bmp', 'tiff', 'X11', 'quartz', 'image_graph',
	'image_draw', 'dev.new', 'trellis.device', 'raster_pdf', 'agg_pdf'
] as const;
const TinyPlotAddons = [
	'tinyplot_add', 'plt_add'
] as const;
const GgPlotImplicitAddons = [
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
	'labs', 'theme_void','theme_set','theme_test','theme_minimal','theme_light','theme','theme_get','theme_gray','theme_dark','theme_classic','theme_linedraw','theme_update',
	'theme_replace','theme_grey','theme_bw','theme_tufte','facet_null', 'facet_grid', 'facet_wrap', 'xlab', 'xlim', 'ylab', 'ylim',
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
	'wrap_by'
] as const;
const PlotAddons = [
	'points', 'abline', 'map', 'mtext', 'lines', 'text', 'legend', 'title', 'axis', 'polygon', 'polypath', 'pie', 'rect', 'segments', 'arrows', 'symbols',
	'tiplabels', 'rug', 'grid', 'box', 'clip', ...GgPlotImplicitAddons
] as const;
const GgPlotAddons = [
	'ggdraw', 'last_plot'
] as const;

function toRegex(n: readonly string[]): RegExp {
	return new RegExp(`^(${
		[...new Set(n)].map(s => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).filter(s => s.length > 0).join('|')
	})$`);
}

/**
 * Contains the built-in definitions recognized by flowR
 */
export const DefaultBuiltinConfig: BuiltInDefinitions = [
	{ type: 'constant', names: ['NULL', 'NA'],  value: null,  assumePrimitive: true },
	{ type: 'constant', names: ['TRUE', 'T'],   value: true,  assumePrimitive: true },
	{ type: 'constant', names: ['FALSE', 'F'],  value: false, assumePrimitive: true },
	{
		type:  'function',
		names: [
			'~', '+', '-', '*', '/', '^', '!', '?', '**', '==', '!=', '>', '<', '>=', '<=', '%%', '%/%', '%*%', '%in%', ':',
			'rep', 'seq', 'seq_len', 'seq_along', 'seq.int', 'gsub', 'which', 'class', 'dimnames', 'min', 'max',
			'intersect', 'subset', 'match', 'sqrt', 'abs', 'round', 'floor', 'ceiling', 'signif', 'trunc', 'log', 'log10', 'log2', 'sum', 'mean',
			'unique', 'paste', 'paste0', 'read.csv', 'stop', 'is.null', 'numeric', 'as.character', 'as.integer', 'as.logical', 'as.numeric', 'as.matrix',
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
					return (source.name === 'map' && getValueOfArgument(graph, source, {
						index: 11,
						name:  'add'
					}, [RType.Logical])?.content === true);
				},
				callName: toRegex(GraphicDeviceOpen)
			}
		}, assumePrimitive: true },
	// graphics addons
	{ type:      'function', names:     PlotAddons,
		processor: 'builtin:default',             config:    {
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex([...PlotCreate, ...PlotAddons]),
				ignoreIf: (source: NodeId, graph: DataflowGraph) => {
					const sourceVertex = graph.getVertex(source) as DataflowGraphVertexFunctionCall;

					/* map with add = true appends to an existing plot */
					return (sourceVertex?.name === 'map' && getValueOfArgument(graph, sourceVertex, {
						index: 11,
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
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex([...GgPlotCreate, ...GgPlotAddons])
			}
		}, assumePrimitive: true },
	{
		type:      'function',
		names:     TinyPlotAddons,
		processor: 'builtin:default',
		config:    {
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
			forceArgs:             'all',
			hasUnknownSideEffects: {
				type:     'link-to-last-call',
				callName: toRegex([...GraphicDeviceOpen, ...PlotCreate, ...PlotAddons, ...GgPlotAddons, ...TinyPlotAddons])
			}
		}, assumePrimitive: true },
	{ type: 'function', names: ['('],                                          processor: 'builtin:default',             config: { returnsNthArgument: 0 },                                                     assumePrimitive: true  },
	{ type: 'function', names: ['load', 'load_all', 'setwd', 'set.seed'],      processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: [true] },                            assumePrimitive: false },
	{ type: 'function', names: ['body', 'formals', 'environment'],             processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: [true] },                            assumePrimitive: true },
	{ type: 'function', names: ['eval'],                                       processor: 'builtin:eval',                config: { includeFunctionCall: true },                                                 assumePrimitive: true },
	{ type: 'function', names: ['cat'],                                        processor: 'builtin:default',             config: { forceArgs: 'all', hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ } },                                                         assumePrimitive: false },
	{ type: 'function', names: ['switch'],                                     processor: 'builtin:default',             config: { forceArgs: [true] },                                                         assumePrimitive: false },
	{ type: 'function', names: ['return'],                                     processor: 'builtin:default',             config: { returnsNthArgument: 0, cfg: ExitPointType.Return },                          assumePrimitive: false },
	{ type: 'function', names: ['break'],                                      processor: 'builtin:default',             config: { cfg: ExitPointType.Break },                                                  assumePrimitive: false },
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
	{ type: 'function', names: ['assign'],                                     processor: 'builtin:assignment',          config: { targetVariable: true },                                                      assumePrimitive: true  },
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
	{ type: 'function', names: ['.Primitive', '.Internal'],                    processor: 'builtin:apply',               config: { indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, assumePrimitive: true  },
	{ type: 'function', names: ['list'],                                       processor: 'builtin:list',                config: {},                                                                            assumePrimitive: true  },
	{ type: 'function', names: ['c'],                                          processor: 'builtin:vector',              config: {},                                                                            assumePrimitive: true  },
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
			'on.exit', 'sys.on.exit', 'par', 'tpar', 'sink', 'tinytheme',
			/* library and require is handled above */
			'requireNamespace', 'loadNamespace', 'attachNamespace', 'asNamespace',
			/* downloader and installer functions (R, devtools, BiocManager) */
			'library.dynam', 'install.packages','install', 'install_github', 'install_gitlab', 'install_bitbucket', 'install_url', 'install_git', 'install_svn', 'install_local', 'install_version', 'update_packages',
			/* weird env attachments */
			'attach', 'unname', 'data',
			/* file creation/removal */
			'dir.create', 'dir_create', 'Sys.chmod', 'unlink', 'file.remove', 'file.rename', 'file.copy', 'file.link', 'file.append', 'Sys.junction'
		],
		processor:       'builtin:default',
		config:          { hasUnknownSideEffects: true },
		assumePrimitive: false
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
];
