import { sig, Forced } from './shared-signatures';
import { fn, pkg } from './define-helpers';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { DataTableSetter } from './shared-configs';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of the data.table package. */
export const DataTableDefinitions = [
	/* data.table's in-place setters hand back their table invisibly */
	fn(pkg(PkgName.DataTable, 'setDT', 'setorder', 'setorderv', 'setcolorder'), BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.Transforms], props: CallProp.Invisible }),
	fn(pkg(PkgName.DataTable, 'fread'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ input: Forced.Resource | ArgProp.Optional, file: Forced.Resource | ArgProp.Optional, text: Forced.Value, cmd: ArgProp.Forced | ArgProp.Injectable, '...': Forced.Value }) }),
	fn(pkg(PkgName.DataTable, 'fwrite'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ x: Forced.Value, file: Forced.Resource | ArgProp.Optional, '...': Forced.Value }) }),
	fn(pkg(PkgName.DataTable, 'setkey', 'setkeyv', 'setindex', 'setindexv', 'setattr', 'set', 'setnafill', 'setalloccol'), BuiltInProcName.Assignment, DataTableSetter),
	fn(pkg(PkgName.DataTable, 'setnames'), BuiltInProcName.Assignment, { ...DataTableSetter, tags: [SemanticCallTag.Transforms] }),
] as const satisfies AnyBuiltInDefinition[];
