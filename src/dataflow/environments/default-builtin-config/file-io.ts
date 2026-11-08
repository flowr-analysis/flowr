import { sig, Forced } from './signatures';
import { fn, pkg, base, readsFile, writesFile, Deprecated } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { BuiltInEvalName } from '../built-in-eval-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { AmbientStateAccessType } from '../../internal/process/functions/call/built-in/built-in-ambient-state';
import { AmbientStateName } from '../ambient-state-name';
import { SetsAnyEnvVar, CopiesFiles, Downloads } from './shared';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of reading and writing files and data formats. */
export const IoDefinitions = [
	/* `here` joins its arguments below the project root, which stays implicit */
	fn(pkg(PkgName.Here, 'here'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn:   true,
			props:   CallProp.Pure,
			ambient: [
				{ type: AmbientStateAccessType.ReadState, state: AmbientStateName.projectRoot },
				{ type: AmbientStateAccessType.ReadState, state: AmbientStateName.workingDirectory }
			],
			sig: sig({ '...': Forced.Value })
		},
		{ evalHandler: BuiltInEvalName.StringFn }
	),
	/* naming the script fixes the root, which must hold that file */
	fn(pkg(PkgName.Here, 'i_am'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn:   true,
			props:   CallProp.Invisible | CallProp.Configures,
			ambient: { type: AmbientStateAccessType.SetState, state: AmbientStateName.projectRoot },
			tags:    [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:     sig({ path: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Dotenv, 'load_dot_env'), BuiltInProcName.Default,
		{
			libFn:                 true,
			readAllArguments:      true,
			hasUnknownSideEffects: true,
			props:                 CallProp.Invisible | CallProp.Configures,
			ambient:               SetsAnyEnvVar,
			tags:                  [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:                   sig({ file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Readr,
		'read_csv', 'read_csv2', 'read_lines', 'read_delim', 'read_fwf', 'read_tsv', 'read_table', 'read_log', 'read_lines_raw', 'read_lines_chunked',
		'read_rds'
	), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Xlsx, 'read.xlsx', 'read.xlsx2'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Haven, 'read_sas', 'read_sav', 'read_por', 'read_dta', 'read_xpt'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Feather, 'read_feather'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Foreign,
		'read.arff', 'read.dbf', 'read.dta', 'read.epiinfo', 'read.mtp', 'read.octave', 'read.spss', 'read.ssd', 'read.systat', 'read.xport'
	), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Readxl, 'read_excel', 'read_xls', 'read_xlsx'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	fn(pkg(PkgName.Readstata13, 'read.dta13'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Arrow,
		'read_parquet', 'read_feather', 'read_ipc_file', 'read_ipc_stream', 'read_csv_arrow', 'read_tsv_arrow', 'read_delim_arrow', 'read_json_arrow'
	), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.XlConnect, 'readWorksheetFromFile', 'readNamedRegionFromFile'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.XlConnect, 'loadWorkbook'), BuiltInProcName.DefaultReadAllArgs, readsFile('filename')),
	fn(pkg(PkgName.Jsonlite, 'read_json'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	/* `txt` is json text, a path, or a url */
	fn(pkg(PkgName.Jsonlite, 'fromJSON'), BuiltInProcName.DefaultReadAllArgs, readsFile('txt')),
	fn(pkg(PkgName.Rio, 'import', 'import_list'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.OpenXlsx, 'read.xlsx'), BuiltInProcName.DefaultReadAllArgs, readsFile('xlsxFile')),
	fn(pkg(PkgName.OpenXlsx, 'loadWorkbook'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.ReadOds, 'read_ods'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	fn(pkg(PkgName.Vroom, 'vroom'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Ncdf4, 'nc_open'), BuiltInProcName.DefaultReadAllArgs, readsFile('filename')),
	fn(pkg(PkgName.Rnetcdf, 'open.nc'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:   sig({ con: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Rmatlab, 'readMat'), BuiltInProcName.DefaultReadAllArgs, readsFile('con')),
	fn(pkg(PkgName.Rhdf5, 'h5read', 'h5ls'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Fst, 'read_fst'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	fn(pkg(PkgName.Qs, 'qread'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Seqinr, 'read.fasta'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Readr,
		'write_csv', 'write_csv2', 'write_delim', 'write_excel_csv', 'write_excel_csv2', 'write_file', 'write_tsv', 'write_lines', 'write_rds'
	), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Haven, 'write_sas', 'write_sav', 'write_dta', 'write_xpt'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'data')),
	fn(pkg(PkgName.Feather, 'write_feather'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Foreign, 'write.arff'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Foreign, 'write.dbf', 'write.dta'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'dataframe')),
	fn(pkg(PkgName.Foreign, 'write.foreign'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'df')),
	fn(pkg(PkgName.Xlsx, 'write.xlsx', 'write.xlsx2'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Arrow, 'write_parquet', 'write_feather', 'write_ipc_file', 'write_ipc_stream', 'write_csv_arrow'), BuiltInProcName.DefaultReadAllArgs,
		writesFile('sink')
	),
	fn(pkg(PkgName.XlConnect, 'writeNamedRegionToFile', 'writeWorksheetToFile'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Jsonlite, 'write_json'), BuiltInProcName.DefaultReadAllArgs, writesFile('path')),
	fn(pkg(PkgName.Writexl, 'write_xlsx'), BuiltInProcName.DefaultReadAllArgs, writesFile('path')),
	fn(pkg(PkgName.OpenXlsx, 'write.xlsx'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Vroom, 'vroom_write', 'vroom_write_lines'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Rio, 'export', 'export_list'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Ncdf4, 'nc_create'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ filename: Forced.Resource, '...': Forced.Value }) }
	),
	fn(pkg(PkgName.Rnetcdf, 'create.nc'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ filename: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Rmatlab, 'writeMat'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ con: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Rhdf5, 'h5write'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'obj')),
	fn(pkg(PkgName.Rhdf5, 'h5createFile'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Fst, 'write_fst'), BuiltInProcName.DefaultReadAllArgs, writesFile('path')),
	fn(pkg(PkgName.Qs, 'qsave'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Yaml, 'read_yaml', 'yaml.load_file'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Yaml, 'write_yaml'), BuiltInProcName.DefaultReadAllArgs, writesFile('file')),
	fn(pkg(PkgName.Seqinr, 'write.fasta'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ sequences: Forced.Value, names: Forced.Value, 'file.out': Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Xml2, 'read_html', 'read_xml'), BuiltInProcName.Default,
		{
			libFn: true,
			tags:  [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Reads],
			sig:   sig({ x: Forced.Resource, encoding: Forced.Value, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Xml2, 'download_html', 'download_xml'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  Downloads,
			sig:   sig({ url: Forced.Resource, file: Forced.Resource | ArgProp.Written, '...': Forced.Value })
		}
	),
	fn([
		...pkg(PkgName.Fs, 'file_exists', 'dir_exists', 'file_info', 'file_size', 'dir_info'),
		...base('file.exists', 'file.size', 'file.info', 'file.mtime', 'Sys.readlink')
	], BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ '...': Forced.Resource }) }),
	fn(pkg(PkgName.Config, 'get'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:   sig({ value: Forced.Value, config: Forced.Value, file: Forced.Resource, use_parent: Forced.Flag })
		}
	),
	fn(pkg(PkgName.Fs, 'file_move'), BuiltInProcName.Default,
		{
			hasUnknownSideEffects: true,
			props:                 CallProp.Invisible,
			libFn:                 true,
			tags:                  CopiesFiles,
			sig:                   sig({ path: Forced.Resource, new_path: Forced.Resource | ArgProp.Written })
		}
	),
	fn(pkg(PkgName.Fs, 'file_copy', 'dir_copy', 'link_create'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  CopiesFiles,
			sig:   sig({ path: Forced.Resource, new_path: Forced.Resource | ArgProp.Written, '...': ArgProp.Flag })
		}
	),
	fn(pkg(PkgName.Zip, 'zip', 'zipr', 'zip_append', 'zipr_append'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  CopiesFiles,
			sig:   sig({
				zipfile:             Forced.Resource | ArgProp.Written,
				files:               Forced.Resource,
				recurse:             ArgProp.Flag,
				compression_level:   ArgProp.Value,
				include_directories: ArgProp.Flag,
				root:                ArgProp.Value,
				mode:                ArgProp.Flag,
				keys:                ArgProp.Value,
				password:            ArgProp.Value,
				encryption:          ArgProp.Flag
			})
		}
	),
	fn(pkg(PkgName.Zip, 'unzip'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  CopiesFiles,
			sig:   sig({
				zipfile:   Forced.Resource,
				files:     ArgProp.Value,
				overwrite: ArgProp.Flag,
				junkpaths: ArgProp.Flag,
				exdir:     Forced.Resource | ArgProp.Written,
				encoding:  ArgProp.Value,
				password:  ArgProp.Value
			})
		}
	),
	fn(pkg(PkgName.Archive, 'archive_extract'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  CopiesFiles,
			sig:   sig({
				archive:          Forced.Resource,
				dir:              Forced.Resource | ArgProp.Written,
				files:            ArgProp.Value,
				options:          ArgProp.Value,
				strip_components: ArgProp.Value,
				password:         ArgProp.Value
			})
		}
	),
	fn(pkg(PkgName.Archive, 'archive_write_files'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  CopiesFiles,
			sig:   sig({
				archive:  Forced.Resource | ArgProp.Written,
				files:    Forced.Resource,
				format:   ArgProp.Flag,
				filter:   ArgProp.Flag,
				options:  ArgProp.Value,
				password: ArgProp.Value
			})
		}
	),
	fn(pkg(PkgName.Archive, 'archive_write_dir'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  CopiesFiles,
			sig:   sig({
				archive:      Forced.Resource | ArgProp.Written,
				dir:          Forced.Resource,
				format:       ArgProp.Flag,
				filter:       ArgProp.Flag,
				options:      ArgProp.Value,
				password:     ArgProp.Value,
				'...':        ArgProp.Value,
				recursive:    ArgProp.Flag,
				'full.names': ArgProp.Flag
			})
		}
	),
	fn([...pkg(PkgName.Fs, 'file_temp', 'path_temp'), ...pkg(PkgName.Withr, 'local_tempfile', 'with_tempfile', 'local_tempdir', 'with_tempdir')], BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.TempFile], sig: sig({ '...': ArgProp.Forced }) }
	),
	fn(pkg(PkgName.Readr, 'read_table2', 'melt_table', 'melt_fwf', 'melt_delim'), BuiltInProcName.DefaultReadAllArgs, Deprecated),
] as const satisfies AnyBuiltInDefinition[];
