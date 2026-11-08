import type { FunctionInfo, DependencyInfoLink } from './function-info';
import { GgPlotAddons,
	GgPlotCreate, GgPlotImplicitAddons, GraphicsPlotAddons,
	GraphicsPlotCreate, PlotCreate, plotFunctionOwners, TinyPlotAddons,
	TinyPlotCrate
} from '../../../../dataflow/environments/default-builtin-config';

const LinkToPlotCreation = [
	{ type: 'link-to-last-call', callName: PlotCreate }
] as const satisfies DependencyInfoLink[];

/** the {@link FunctionInfo} for a ggplot-style call, qualified with the package that really exports it */
function ggStyle(name: string, linkTo?: typeof LinkToPlotCreation): FunctionInfo {
	/* the configuration is what knows who exports these; more than one owner means pinning it would drop the
	   calls to the others (`theme_map` is cowplot's as well as ggthemes'), and none means it is ggplot2's own */
	const owners = plotFunctionOwners(name);
	const owner = owners.length === 1 ? owners[0] : owners.length === 0 ? 'ggplot2' : undefined;
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
