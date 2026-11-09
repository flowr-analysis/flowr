import { sig, Forced } from './shared-signatures';
import { fn, replacement, pkg, Primitive, Deprecated } from './define-helpers';
import { ExitPointType, NamedAccessOperators } from '../built-in-kinds';
import { Identifier } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { BuiltInEvalName } from '../built-in-eval-name';
import { NseArguments } from '../../internal/process/functions/call/nse-kind';
import { DataMaskingFunctionIdentifiers } from '../data-masking-functions';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { namespacePlotFunctions, GgPlotCreate, TinyPlotCrate, GraphicsPlotCreate, VisiblePlotCreate, TinyPlotAddons, InvisibleGgPlotAddons, GgPlotImplicitAddons, PlotFunctionsWithAddParam, GraphicsPlotAddons, GgPlotAddons, MagrittrPipePackages, DbConnectSig, DbConnSig, DbReads, DbReadsWrites, DbPackages, OtherTransforms, ModelFits, toRegex, PlotAddonConfig, PlotCreateConfig, NewPlot, AddsToPlot, MayAddToPlot, BuildsPlot } from './shared-configs';
import type { AnyBuiltInDefinition } from '../built-in-config';
import { Ambient } from '../ambient-effect';

/** What `$` and `@` share: they access a field by its name. */
const NamedAccess = { treatIndicesAsString: true, resolveField: true, props: CallProp.Pure, sig: sig({ x: Forced.Value, name: ArgProp.Nse }) } as const;

/** The built-in definitions of the language itself: control flow, functions, environments, quoting, and evaluation. */
export const LanguageDefinitions = [
	/* data-masking: the non-data arguments name columns of the (first) data object, not variables */
	fn(DataMaskingFunctionIdentifiers, BuiltInProcName.Default, { markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Transforms] }),
	fn(OtherTransforms, BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.Transforms] }),
	fn(ModelFits, BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, tags: [SemanticCallTag.Statistics] }),
	fn(Identifier.fromAllIn(DbPackages, ['dbConnect']), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, ambient: DbReadsWrites(DbConnectSig), tags: [SemanticCallTag.Opens, SemanticCallTag.Database, SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Writes], sig: DbConnectSig }),
	// graphics base
	fn(namespacePlotFunctions(GraphicsPlotCreate.concat(TinyPlotCrate).filter(f => !VisiblePlotCreate.has(f))), BuiltInProcName.Default,
		{ ...PlotCreateConfig, props: CallProp.Invisible, ambient: NewPlot }, Primitive),
	/* they return a plot object instead of drawing at once */
	fn(namespacePlotFunctions([...VisiblePlotCreate]), BuiltInProcName.Default, { ...PlotCreateConfig, ambient: BuildsPlot }, Primitive),
	fn(namespacePlotFunctions(GgPlotCreate), BuiltInProcName.Default, PlotCreateConfig, Primitive),
	fn(namespacePlotFunctions(['grid.arrange']), BuiltInProcName.Default, { ...PlotCreateConfig, props: CallProp.Invisible, ambient: Ambient.plot.resets }, { overrides: true, assumePrimitive: true }),
	// graphics addons
	fn(namespacePlotFunctions(GraphicsPlotAddons), BuiltInProcName.Default, { ...PlotAddonConfig, props: CallProp.Invisible, ambient: AddsToPlot }, Primitive),
	fn(namespacePlotFunctions([...PlotFunctionsWithAddParam]), BuiltInProcName.Default, { ...PlotAddonConfig, props: CallProp.Invisible, ambient: MayAddToPlot }, { overrides: true, assumePrimitive: true }),
	fn(namespacePlotFunctions(GgPlotImplicitAddons.filter(f => !InvisibleGgPlotAddons.includes(f))), BuiltInProcName.Default, PlotAddonConfig, Primitive),
	/* they change the theme every later ggplot is drawn with, like `theme_set` */
	fn(namespacePlotFunctions(InvisibleGgPlotAddons), BuiltInProcName.Default, { ...PlotAddonConfig, props: CallProp.Invisible, ambient: [], hasUnknownSideEffects: true }, Primitive),
	// plot tags
	fn(namespacePlotFunctions(GgPlotAddons), BuiltInProcName.Default,
		{ libFn: true, ambient: [BuildsPlot, Ambient.lastPlot.reads], tags: [SemanticCallTag.Graphics], sig: sig({ '...': ArgProp.Forced }) },
		Primitive),
	fn(namespacePlotFunctions(TinyPlotAddons), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, hasUnknownSideEffects: { type: 'link-to-last-call', callName: toRegex([...TinyPlotCrate, ...TinyPlotAddons]) }, tags: [SemanticCallTag.Graphics], sig: sig({ '...': ArgProp.Forced }) },
		Primitive),
	fn(['('], BuiltInProcName.Default, { keepArgumentOut: true, props: CallProp.Pure, sig: sig({ x: ArgProp.Forced | ArgProp.Alias }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.Group }),
	fn(['return'], BuiltInProcName.Default,
		{ cfg: ExitPointType.Return, keepArgumentOut: true, useAsProcessor: BuiltInProcName.Return, props: CallProp.Pure, sig: sig({ value: ArgProp.Forced | ArgProp.Alias }) }, Primitive),
	fn(['break'], BuiltInProcName.Default, { useAsProcessor: BuiltInProcName.Break, cfg: ExitPointType.Break }),
	fn(['next'], BuiltInProcName.Default, { cfg: ExitPointType.Next }),
	fn(['{'], BuiltInProcName.ExpressionList, { props: CallProp.Pure, sig: sig({ '...': ArgProp.Alias }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Group }),
	fn(['['], BuiltInProcName.Access, { treatIndicesAsString: false, props: CallProp.Pure, sig: sig({ x: Forced.Value, '...': ArgProp.Value }) }, Primitive),
	fn(['[['], BuiltInProcName.Access, { treatIndicesAsString: false, resolveField: true, props: CallProp.Pure, sig: sig({ x: Forced.Value, '...': ArgProp.Value }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.Element }),
	/* the field is a name rather than a value, so it is never evaluated; a field of an environment folds to what it holds */
	fn(['$'], BuiltInProcName.Access, NamedAccess, { assumePrimitive: true, evalHandler: BuiltInEvalName.Element }),
	fn(['@'], BuiltInProcName.Access, NamedAccess, Primitive),
	fn(['::'], BuiltInProcName.NamespaceAccess, { internal: false, sig: sig({ pkg: ArgProp.NoDefault, name: ArgProp.NoDefault }) }, Primitive),
	fn([':::'], BuiltInProcName.NamespaceAccess, { internal: true, sig: sig({ pkg: ArgProp.NoDefault, name: ArgProp.NoDefault }) }, Primitive),
	fn(['if'], BuiltInProcName.IfThenElse, { sig: sig({ cond: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Atomic, 'cons.expr': ArgProp.NoDefault, 'alt.expr': 0 }) }, Primitive),
	/* a pipe hands back what the side it feeds hands back, which `Alias` is what states */
	fn(['|>'], BuiltInProcName.Pipe, { pipePlaceholderName: '_', assignLhs: false, returnLhs: false, sig: sig({ lhs: ArgProp.Value, rhs: ArgProp.Alias }) }, Primitive),
	fn([...Identifier.fromAllIn(MagrittrPipePackages, ['%>%']), '%!>%'], BuiltInProcName.Pipe,
		{ pipePlaceholderName: '.', assignLhs: false, returnLhs: false, rhsMightBeSymbol: true, sig: sig({ lhs: ArgProp.Value, rhs: ArgProp.Alias }) }, Primitive),
	fn(['function', '\\'], BuiltInProcName.FunctionDefinition, { sig: sig({ arglist: ArgProp.Nse, expr: ArgProp.NoDefault | ArgProp.Nse }) }, Primitive),
	fn(['for'], BuiltInProcName.ForLoop,
		{ props: CallProp.Invisible, sig: sig({ var: ArgProp.NoDefault | ArgProp.Nse, seq: ArgProp.NoDefault | ArgProp.Forced, expr: ArgProp.NoDefault }) }, Primitive),
	fn(['repeat'], BuiltInProcName.RepeatLoop, { props: CallProp.Invisible, sig: sig({ expr: ArgProp.NoDefault | ArgProp.Forced }) }, Primitive),
	fn(['while'], BuiltInProcName.WhileLoop, { props: CallProp.Invisible, sig: sig({ cond: ArgProp.NoDefault | ArgProp.Forced | ArgProp.Atomic, expr: ArgProp.NoDefault }) }, Primitive),
	fn(Identifier.fromAllIn(DbPackages, ['dbGetQuery', 'dbSendQuery', 'dbSendStatement', 'dbExecute']), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.NonDet, ambient: DbReadsWrites(DbConnSig), tags: [SemanticCallTag.Database], sig: sig({ conn: Forced.Handle, statement: Forced.Value | ArgProp.Injectable, '...': ArgProp.Value }) }),
	fn(Identifier.fromAllIn(DbPackages, ['dbReadTable', 'dbReadTableArrow', 'dbListTables', 'dbExistsTable', 'dbListFields', 'dbListObjects']), BuiltInProcName.Default,
		{ libFn: true, ambient: DbReads, tags: [SemanticCallTag.Database], sig: sig({ conn: Forced.Handle, name: Forced.Value, '...': ArgProp.Value }) }),
	fn(Identifier.fromAllIn(DbPackages, ['dbWriteTable', 'dbWriteTableArrow', 'dbAppendTable', 'dbAppendTableArrow', 'dbCreateTable', 'dbRemoveTable']), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, ambient: DbReadsWrites(DbConnSig), tags: [SemanticCallTag.Database], sig: sig({ conn: Forced.Handle, name: Forced.Value, value: Forced.Value, '...': ArgProp.Value }) }),
	/* a transaction decides whether earlier changes stay, a rollback undoes them */
	fn(Identifier.fromAllIn(DbPackages, ['dbBegin', 'dbCommit', 'dbRollback', 'dbWithTransaction']), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, ambient: DbReadsWrites(DbConnSig), tags: [SemanticCallTag.Database], sig: sig({ conn: Forced.Handle, '...': Forced.Value }) }),
	fn(pkg('RODBC', 'sqlQuery', 'odbcQuery'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.NonDet, tags: [SemanticCallTag.Database], sig: sig({ channel: Forced.Handle, query: Forced.Value | ArgProp.Injectable, '...': ArgProp.Value }) }),
	/* R dispatches `$<-` (and `@<-` since R 4.3) on the class of the target, to the methods the code writes */
	replacement([...NamedAccessOperators], ['<-', '<<-'], { readIndices: false, props: CallProp.Scope | CallProp.Generic }),
	fn(['`%@%`'], BuiltInProcName.DefaultReadAllArgs, Deprecated),
] as const satisfies AnyBuiltInDefinition[];
