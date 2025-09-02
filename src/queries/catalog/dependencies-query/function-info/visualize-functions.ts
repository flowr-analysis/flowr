import type { FunctionInfo , DependencyInfoLink } from './function-info';
import { GgPlotAddons,
	GgPlotCreate, GgPlotImplicitAddons, MiscPlotAddons,
	MiscPlotCreate, PlotCreate, TinyPlotAddons,
	TinyPlotCrate
} from '../../../../dataflow/environments/default-builtin-config';

const LinkToPlotCreation = [
	{ type: 'link-to-last-call', callName: PlotCreate }
] as const satisfies DependencyInfoLink[];

export const VisualizeFunctions: FunctionInfo[] = [
	// plot creation
	...GgPlotCreate.map(f => ({ package: 'ggplot2', name: f })),
	...TinyPlotCrate.map(f => ({ package: 'tinyplot', name: f })),
	...MiscPlotCreate.map(f => ({ name: f })),

	// plot modification
	...[...GgPlotImplicitAddons, ...GgPlotAddons].map(f => ({ package: 'ggplot2', name: f, linkTo: LinkToPlotCreation })),
	...TinyPlotAddons.map(f => ({ package: 'tinyplot', name: f, linkTo: LinkToPlotCreation })),
	...MiscPlotAddons.map(f => ({ name: f, linkTo: LinkToPlotCreation }))
];
