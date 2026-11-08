import { sig, Forced } from './signatures';
import { fn, pkg } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of database connections. */
export const DatabaseDefinitions = [
	fn(pkg(PkgName.Dbi, 'dbDisconnect'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.Closes, SemanticCallTag.Database],
			sig:   sig({ conn: Forced.Handle, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Dbi, 'dbQuoteString', 'dbQuoteLiteral', 'dbQuoteIdentifier'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Pure, sig: sig({ conn: Forced.Handle, x: Forced.Value, '...': ArgProp.Value }) }
	),
	/* these escape the values they interpolate, but not the template they are handed */
	fn(pkg(PkgName.Dbi, 'sqlInterpolate'), BuiltInProcName.Default,
		{ libFn: true, sig: sig({ conn: Forced.Handle, sql: Forced.Value | ArgProp.Injectable, '...': ArgProp.Value, '.dots': ArgProp.Value }) }
	),
	fn(pkg(PkgName.Sqldf, 'sqldf'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.NonDet,
			tags:  [SemanticCallTag.Database],
			sig:   sig({
				x:                Forced.Value | ArgProp.Injectable,
				stringsAsFactors: Forced.Flag,
				'row.names':      Forced.Flag,
				envir:            Forced.Value,
				method:           Forced.Flag
			})
		}
	),
] as const satisfies AnyBuiltInDefinition[];
