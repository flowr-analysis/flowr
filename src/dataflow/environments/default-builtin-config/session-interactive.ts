import { sig, Forced } from './signatures';
import { fn, pkg } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of shiny and other interactive interfaces. */
export const InteractiveDefinitions = [
	/* cohortBuilder has a `filter` too, and built-ins go by name, so dplyr's entry below wins in the environment
	   while this one still states what cohortBuilder's does */
	fn(pkg(PkgName.CohortBuilder, 'filter'), BuiltInProcName.Default, { libFn: true, props: CallProp.Pure, sig: sig({ '...': ArgProp.Forced }) }),
	fn(pkg(PkgName.Shiny, 'runGist', 'runUrl', 'httpResponse'), BuiltInProcName.Default,
		{
			libFn:                 true,
			hasUnknownSideEffects: true,
			tags:                  [SemanticCallTag.Network, SemanticCallTag.Reads],
			sig:                   sig({ url: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.HtmlTools, 'htmlEscape'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Pure, sig: sig({ text: Forced.Value, attribute: ArgProp.Flag }) }
	),
	fn([...pkg(PkgName.Shiny, 'HTML'), ...pkg(PkgName.HtmlTools, 'HTML')], BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Html], sig: sig({ text: Forced.Value | ArgProp.Injectable, '...': Forced.Value }) }
	),
	fn(pkg(PkgName.Shiny, 'markdown'), BuiltInProcName.Default,
		{
			libFn: true,
			tags:  [SemanticCallTag.Html],
			sig:   sig({ mds: Forced.Value | ArgProp.Injectable, extensions: Forced.Flag, '.noWS': ArgProp.Flag, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Shiny, 'insertUI'), BuiltInProcName.Default,
		{
			libFn: true,
			tags:  [SemanticCallTag.Html],
			sig:   sig({
				selector:  Forced.Value,
				where:     Forced.Flag,
				ui:        Forced.Value | ArgProp.Injectable,
				immediate: Forced.Flag,
				session:   Forced.Value
			})
		}
	),
	fn(pkg(PkgName.ShinyJs, 'runjs'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.JavaScript], sig: sig({ code: Forced.Value | ArgProp.Injectable }) }
	),
	fn(pkg(PkgName.ShinyJs, 'html'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.Html],
			sig:   sig({ id: Forced.Value, html: Forced.Value | ArgProp.Injectable, add: Forced.Flag, selector: Forced.Value, asis: Forced.Flag })
		}
	),
	fn(pkg(PkgName.ShinyJs, 'extendShinyjs'), BuiltInProcName.Default,
		{
			libFn: true,
			tags:  [SemanticCallTag.JavaScript, SemanticCallTag.File, SemanticCallTag.Reads],
			sig:   sig({ script: Forced.Resource, text: Forced.Value | ArgProp.Injectable, functions: Forced.Value })
		}
	),
	/* the servers registering what the user picks hand back their observer invisibly */
	fn([...pkg(PkgName.ShinyFiles, 'shinyFileChoose', 'shinyDirChoose', 'shinyFileSave'), ...pkg(PkgName.ShinyCohortBuilder, 'cb_chat_server')], BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, tags: [SemanticCallTag.User], sig: sig({ '...': ArgProp.Forced }) }
	),
	/* wrappers that run the expression they are handed; `observe`/`render*` are left out, they yield a handle instead */
	fn(pkg(PkgName.Shiny, 'reactive', 'eventReactive', 'bindEvent', 'bindCache', 'isolate', 'req', 'debounce', 'throttle', 'reactiveValuesToList'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.MayPure, sig: sig({ '...': ArgProp.Forced }) }
	),
	fn(pkg(PkgName.Shiny, 'freezeReactiveVal'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.MayPure | CallProp.Invisible, sig: sig({ '...': ArgProp.Forced }) }
	),
	/* their content is whatever the app sets later on, `v(input$x)` included */
	fn(pkg(PkgName.Shiny, 'reactiveVal', 'reactiveValues'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.NonDet, sig: sig({ '...': ArgProp.Forced }) }
	),
	/* assembling a cohort keeps the data of its source; `filter` is registered above, dplyr holds that name */
	fn(pkg(PkgName.CohortBuilder,
		'cohort', 'set_source', 'add_filter', 'update_filter', 'rm_filter', 'bind_key', 'bind_keys', 'as.tblist', 'tblist', 'step', 'add_step',
		'rm_step'
	), BuiltInProcName.Default, { libFn: true, props: CallProp.Pure, sig: sig({ '...': ArgProp.Forced }) }),
	fn(pkg(PkgName.CohortBuilder, 'add_source', 'update_source', 'run', 'restore'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Pure | CallProp.Invisible, sig: sig({ '...': ArgProp.Forced }) }
	),
] as const satisfies AnyBuiltInDefinition[];
