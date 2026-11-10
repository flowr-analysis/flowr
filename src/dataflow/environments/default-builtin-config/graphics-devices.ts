import { sig, Forced } from './shared-signatures';
import { fn, pkg, base, Primitive, Overrides, readsFile, writesFile, Deprecated } from './define-helpers';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { NseArguments } from '../../internal/process/functions/call/nse-kind';
import { ArgProp, CallProp, SemanticCallTag, type SemanticCallTags } from '../built-in-props';
import { ClassSystem, AmbientStateAccessType } from '../built-in-kinds';
import { DeprecationState } from '../deprecation-info';
import { LinkToLastGgPlot, LinkToLastPlot, PlotAddonConfig, OpenDevice, ReadDevices, PlotCreateConfig } from './shared-configs';
import type { AnyBuiltInDefinition } from '../built-in-config';
import { FunctionDispatch } from '../../graph/vertex';

/** The built-in definitions of base graphics, grDevices, ggplot2, and other plotting packages. */
export const GraphicsDefinitions = [
	/* data-masking without a data argument, e.g. `aes(x, y)` */
	fn([...pkg(PkgName.GgPlot2, 'aes', 'vars'), ...pkg(PkgName.Dplyr, 'join_by'), ...Identifier.fromAllIn([PkgName.Tibble, PkgName.Dplyr, PkgName.TidyR], ['tibble', 'tribble'])],
		BuiltInProcName.DefaultReadAllArgs, { markArgsAsMasked: NseArguments.All }),

	/* they open a device that writes the plot to the file they are given, under the name each of them uses */
	fn([...pkg(PkgName.GrDevices, 'png', 'jpeg', 'bmp', 'tiff', 'svg', 'cairo_pdf'), ...pkg(PkgName.RasterPdf, 'raster_pdf'), ...pkg(PkgName.Ragg, 'agg_png', 'agg_jpeg', 'agg_tiff',
		'agg_ppm', 'agg_webp')], BuiltInProcName.DefaultReadAllArgs,
	{ ambient: OpenDevice, props: CallProp.Invisible | CallProp.Configures, tags: [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ filename: Forced.Resource, width: Forced.Value, height: Forced.Value, '...': Forced.Value }) },
	Primitive),
	fn(pkg(PkgName.GrDevices, 'pdf', 'postscript', 'xfig', 'bitmap', 'pictex'), BuiltInProcName.DefaultReadAllArgs,
		{ ambient: OpenDevice, props: CallProp.Invisible | CallProp.Configures, tags: [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ file: Forced.Resource, type: Forced.Value, height: Forced.Value, width: Forced.Value, '...': Forced.Value }) },
		Primitive),
	/* devices that draw on the screen or into memory instead */
	fn([...pkg(PkgName.GrDevices, 'dev.new'), ...pkg(PkgName.Lattice, 'trellis.device')], BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Configures | CallProp.Invisible, ambient: OpenDevice, tags: [SemanticCallTag.Graphics] }, Primitive),
	/* platform-specific devices, `dev.new()` opens the right one */
	fn(pkg(PkgName.GrDevices, 'X11', 'x11', 'windows', 'quartz', 'win.graph', 'win.metafile', 'win.print'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Configures | CallProp.Invisible, ambient: OpenDevice, tags: [SemanticCallTag.Graphics, SemanticCallTag.Deprecated] }, Primitive),
	fn(pkg(PkgName.Car, 'Import'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.DiagrammeR, 'import_graph'), BuiltInProcName.DefaultReadAllArgs, readsFile('graph_file')),
	fn(pkg(PkgName.DiagrammeR, 'open_graph'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Car, 'Export'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.VisNetwork, 'visSave'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'graph')),
	fn(pkg(PkgName.DiagrammeR, 'save_graph'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'graph')),
	fn(pkg(PkgName.GgPlot2, 'ggsave'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, readAllArguments: true, hasUnknownSideEffects: LinkToLastGgPlot, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ filename: Forced.Resource, plot: Forced.Value, device: ArgProp.Flag, path: ArgProp.Resource | ArgProp.Optional, scale: ArgProp.Flag, width: ArgProp.Flag, height: ArgProp.Flag, units: ArgProp.Flag, dpi: ArgProp.Flag, limitsize: ArgProp.Flag, bg: ArgProp.Flag, 'create.dir': ArgProp.Flag, '...': ArgProp.Flag }) }),
	fn(pkg(PkgName.Cowplot, 'ggsave2'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, readAllArguments: true, hasUnknownSideEffects: LinkToLastGgPlot, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ filename: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Svglite, 'svglite'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	/* `qplot` creates a plot like the ones above and is deprecated on top of it; registered after them so this definition is the one that sticks */
	fn(pkg(PkgName.GgPlot2, 'qplot'), BuiltInProcName.Default, { ...PlotCreateConfig, tags: [SemanticCallTag.Graphics, SemanticCallTag.Deprecated] as SemanticCallTags },
		{ overrides: true, assumePrimitive: true }),
	fn(pkg(PkgName.GrDevices, 'dev.off'), BuiltInProcName.Default,
		{ props: CallProp.Configures, libFn: true, ambient: { type: AmbientStateAccessType.CloseDevice }, hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticCallTag.Graphics, SemanticCallTag.Closes, SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ '...': ArgProp.Forced }) },
		Primitive),
	fn(pkg(PkgName.GrDevices, 'graphics.off'), BuiltInProcName.Default,
		{ props: CallProp.Configures | CallProp.Invisible, libFn: true, ambient: { type: AmbientStateAccessType.CloseDevice, all: true }, hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticCallTag.Graphics, SemanticCallTag.Closes, SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ '...': ArgProp.Forced }) },
		Primitive),
	fn(pkg(PkgName.GrDevices, 'dev.cur', 'dev.list', 'dev.size', 'dev.capabilities'), BuiltInProcName.Default,
		{ props: CallProp.Ambient, libFn: true, ambient: ReadDevices, tags: [SemanticCallTag.Graphics], sig: sig({ '...': ArgProp.Forced }) }),
	/* switching the active device makes its graphics state the one in effect */
	fn(pkg(PkgName.GrDevices, 'dev.set', 'dev.next', 'dev.prev'), BuiltInProcName.Default,
		{ props: CallProp.Configures, libFn: true, ambient: { type: AmbientStateAccessType.SwitchDevice }, tags: [SemanticCallTag.Graphics], sig: sig({ which: ArgProp.Forced }) }),
	fn([...pkg(PkgName.GgPlot2, 'make_constructor'), ...pkg(PkgName.S7, 'new_class')], BuiltInProcName.S7MakeConstructor,
		{ mode: [FunctionDispatch.S7], classDecl: { system: ClassSystem.S7, nameArg: { idx: 0, name: 'name' }, containsArg: { idx: 1, name: 'parent' }, memberArgs: [{ name: 'properties', typed: true }], virtualArg: { name: 'abstract' } } },
		Primitive),
	fn([...pkg(PkgName.Graphics, 'par'), ...pkg(PkgName.TinyPlot, 'tpar')], BuiltInProcName.Default,
		{ props: CallProp.Configures | CallProp.Invisible, ambient: { type: AmbientStateAccessType.SetGraphics, queryOnUnnamedStrings: true, queryLinksTo: LinkToLastPlot, keys: { from: 'argument-names', ignore: ['no.readonly'] } }, tags: [SemanticCallTag.Graphics], sig: sig({ '...': 0, 'no.readonly': 0 }) }),
	/* they arrange the device or change its colors, which every later plot on it picks up */
	fn(pkg(PkgName.Graphics, 'layout', 'screen', 'close.screen'), BuiltInProcName.Default,
		{ props: CallProp.Configures | CallProp.Invisible, ambient: { type: AmbientStateAccessType.SetGraphics }, tags: [SemanticCallTag.Graphics], sig: sig({ '...': ArgProp.Forced }) }),
	fn(pkg(PkgName.Graphics, 'split.screen'), BuiltInProcName.Default,
		{ props: CallProp.Configures, ambient: { type: AmbientStateAccessType.SetGraphics }, tags: [SemanticCallTag.Graphics], sig: sig({ '...': ArgProp.Forced }) }),
	/* the palette, other than the parameters above, is shared by all devices */
	fn(pkg(PkgName.GrDevices, 'palette'), BuiltInProcName.Default,
		{ props: CallProp.Configures | CallProp.Invisible, ambient: { type: AmbientStateAccessType.SetPalette }, tags: [SemanticCallTag.Graphics], sig: sig({ value: ArgProp.Forced }) }),
	fn([...pkg(PkgName.GgPlot2, 'theme_set'), ...pkg(PkgName.Testthat, 'context'), ...base('library.dynam'), ...pkg(PkgName.Remotes, 'install_local'), ...pkg(PkgName.Devtools,
		'install_local')], BuiltInProcName.Default,
	{ hasUnknownSideEffects: true, libFn: true, props: CallProp.Invisible, sig: sig({ chname: ArgProp.NoDefault, package: ArgProp.NoDefault, 'lib.loc': ArgProp.NoDefault, verbose: 0, 'file.ext': 0, '...': 0 }) }),
	fn(pkg(PkgName.TinyPlot, 'tinytheme'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, hasUnknownSideEffects: true, libFn: true, sig: sig({ chname: ArgProp.NoDefault, package: ArgProp.NoDefault, 'lib.loc': ArgProp.NoDefault, verbose: 0, 'file.ext': 0, '...': 0 }) }),
	fn(Identifier.fromAllIn([PkgName.HtmlWidgets, 'DT'], ['JS']), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.JavaScript], sig: sig({ '...': Forced.Value | ArgProp.Injectable }) }),
	fn(pkg(PkgName.GgPlot2, 'is.ggplot', 'guide_train', 'aes_auto', 'aes_'), BuiltInProcName.DefaultReadAllArgs, Deprecated),
	fn(pkg(PkgName.GgPlot2, 'gg_dep'), BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.Deprecated], props: CallProp.Invisible }),
	/* deprecated, but only when when a certain condition is met (e.g. specific argument value) https://tidyverse.org/blog/2025/09/ggplot2-4-0-0/#violin--quantiles the quantiles moved to the stat, and the geom only kept arguments styling them, so neither is a rename of `draw_quantiles = 0.5`: the value is a quantile, not a linetype, and `quantiles` is no formal of the geom */
	fn([Identifier.make('geom_violin', PkgName.GgPlot2)], BuiltInProcName.Default,
		{ ...PlotAddonConfig, deprInfo: { whenArgs: [{ argName: 'draw_quantiles', state: DeprecationState.Deprecated, replacedBy: 'stat_ydensity(quantiles)', sinceVersion: '>= 4.0.0' }] } },
		Overrides),
	/* `size` names the stroke width of every line-based geom until ggplot2 4.0.0 renamed it: it gained `linewidth` beside it in 3.4.0, and 4.0.0 drops `size`. */
	fn(pkg(PkgName.GgPlot2, 'element_line', 'element_rect'), BuiltInProcName.DefaultReadAllArgs,
		{ deprInfo: { whenArgs: [{ argName: 'size', state: DeprecationState.Deprecated, replacedBy: 'linewidth', sinceVersion: '>= 3.4.0' }] } }),
] as const satisfies AnyBuiltInDefinition[];
