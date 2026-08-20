import type { FunctionInfo, DependencyInfoLink } from './function-info';
import { GgPlotAddons,
	GgPlotCreate, GgPlotImplicitAddons, GraphicsPlotAddons,
	GraphicsPlotCreate, PlotCreate, TinyPlotAddons,
	TinyPlotCrate
} from '../../../../dataflow/environments/default-builtin-config';

const LinkToPlotCreation = [
	{ type: 'link-to-last-call', callName: PlotCreate }
] as const satisfies DependencyInfoLink[];

/**
 * The package that actually exports a plotting call that flowR groups with ggplot2's: a namespaced call is only
 * counted when it names the package the function belongs to, so `ggthemes::theme_wsj()` would otherwise be dropped.
 * A name several packages define (`theme_map` in both cowplot and ggthemes) is left out and matches either way.
 */
const PlotFunctionsByPackage: Readonly<Record<string, readonly string[]>> = {
	factoextra: ['fviz_cluster', 'fviz_dend', 'fviz_mca', 'fviz_mca_biplot', 'fviz_mca_ind', 'fviz_mca_var', 'fviz_pca',
		'fviz_pca_biplot', 'fviz_pca_ind', 'fviz_pca_var', 'fviz_screeplot'],
	ggExtra:    ['ggMarginal', 'removeGrid', 'removeGridX', 'removeGridY', 'rotateTextX'],
	survminer:  ['ggsurvplot', 'ggsurvplot_add_all', 'theme_survminer'],
	cowplot:    ['ggdraw'],
	forecast:   ['ggseasonplot'],
	ggcorrplot: ['ggcorrplot'],
	ggdendro:   ['ggdendrogram'],
	plotly:     ['ggplotly'],
	gridExtra:  ['grid.arrange'],
	ggmap:      ['qmap'],
	ggpubr:     ['gradient_color'],
	ggalt:      ['geom_dumbbell', 'geom_encircle'],
	ggthemes:   [
		'scale_color_calc', 'scale_color_canva', 'scale_color_colorblind', 'scale_color_continuous_tableau',
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
		'theme_igray', 'theme_pander', 'theme_par', 'theme_solarized', 'theme_solarized_2', 'theme_solid',
		'theme_stata', 'theme_tufte', 'theme_wsj'
	]
};

/** {@link PlotFunctionsByPackage} inverted: the owning package of a name, `ggplot2` unless another package claims it */
const PlotFunctionOwner: ReadonlyMap<string, string> = new Map(
	Object.entries(PlotFunctionsByPackage).flatMap(([pkg, names]) => names.map(name => [name, pkg] as const))
);

/** Names that several packages define, so pinning any of them would drop the calls to the others. */
const AmbiguousPlotFunctions: ReadonlySet<string> = new Set(['theme_map', 'wrap_by']);

/** the {@link FunctionInfo} for a ggplot-style call, qualified with the package that really exports it */
function ggStyle(name: string, linkTo?: typeof LinkToPlotCreation): FunctionInfo {
	const owner = AmbiguousPlotFunctions.has(name) ? undefined : PlotFunctionOwner.get(name) ?? 'ggplot2';
	return { ...(owner ? { package: owner } : {}), name, ...(linkTo ? { linkTo } : {}) };
}

export const VisualizeFunctions: FunctionInfo[] =
// plot creation
	(GgPlotCreate.map(f => ggStyle(f))).concat(
		TinyPlotCrate.map(f => ({ package: 'tinyplot', name: f })),
		// `map` is the maps-package plot; qualify it so it does not swallow purrr::map/dplyr::map etc.
		GraphicsPlotCreate.map(f => f === 'map' ? { name: f, package: 'maps' } : { name: f }),

		// plot modification
		(GgPlotImplicitAddons as readonly string[]).concat(GgPlotAddons).map(f => ggStyle(f, LinkToPlotCreation)),
		TinyPlotAddons.map(f => ({ package: 'tinyplot', name: f, linkTo: LinkToPlotCreation })),
		GraphicsPlotAddons.map(f => ({ name: f, linkTo: LinkToPlotCreation }))
	).map(f => {
		if(f.name !== 'hist') {
			return f;
		} else {
			// ignore if plot is false.
			return { ...f, ignoreIf: 'arg-false', additionalArgs: { val: { argIdx: 17, argName: 'plot', resolveValue: true } } };
		}
	});
