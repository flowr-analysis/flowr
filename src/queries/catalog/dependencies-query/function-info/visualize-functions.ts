import type { FunctionInfo } from './function-info';
import {
	GgPlotCreate,
	MiscPlotCreate,
	TinyPlotCrate
} from '../../../../dataflow/environments/default-builtin-config';

export const VisualizeFunctions: FunctionInfo[] = [
	...GgPlotCreate.map(f => ({ package: 'ggplot', name: f })),
	...TinyPlotCrate.map(f => ({ package: 'tinyplot', name: f })),
	...MiscPlotCreate.map(f => ({ name: f }))
];
