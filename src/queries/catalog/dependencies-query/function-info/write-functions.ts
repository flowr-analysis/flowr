import { DependencyInfoLinkConstraint, type DependencyInfoLink, type FunctionInfo } from './function-info';

const OutputRedirects = [
	{ type: 'link-to-last-call', callName: 'sink', attachLinkInfo: { argIdx: 0, argName: 'file', when: DependencyInfoLinkConstraint.IfUnknown, resolveValue: true } }
] as const satisfies DependencyInfoLink[];


export const WriteFunctions: FunctionInfo[] = [
	{ package: 'base', name: 'save',        argName: 'file', resolveValue: true },
	{ package: 'base', name: 'save.image',  argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'write',       argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'dput',        argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'dump',        argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'write.table', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'write.csv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'saveRDS',     argIdx: 1, argName: 'file', resolveValue: true },
	// write functions that don't have argIndex are assumed to write to stdout
	{ package: 'base', name: 'print',   linkTo: OutputRedirects,                  resolveValue: true },
	{ package: 'base', name: 'cat',     linkTo: OutputRedirects, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'message', linkTo: OutputRedirects,                  resolveValue: true },
	{ package: 'base', name: 'warning', linkTo: OutputRedirects,                  resolveValue: true },
	// readr
	{ package: 'readr', name: 'write_csv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_csv2',  argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_delim', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_dsv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_fwf',   argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_tsv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_table', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_log',   argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_lines', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'write_rds',   argIdx: 1, argName: 'file', resolveValue: true },
	// heaven
	{ package: 'heaven', name: 'write_sas', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'heaven', name: 'write_sav', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'heaven', name: 'write_por', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'heaven', name: 'write_dta', argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'heaven', name: 'write_xpt', argIdx: 1, argName: 'file', resolveValue: true },
	// feather
	{ package: 'feather', name: 'write_feather', argIdx: 1, argName: 'file', resolveValue: true },
	// foreign
	{ package: 'foreign', name: 'write.arff',    argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'write.dbf',     argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'write.dta',     argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'write.foreign', argIdx: 1, argName: 'file', resolveValue: true },
	// xlsx
	{ package: 'xlsx', name: 'write.xlsx',  argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'xlsx', name: 'write.xlsx2', argIdx: 1, argName: 'file', resolveValue: true },
	// graphics
	{ package: 'graphics', name: 'pdf',        argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'jpeg',       argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'png',        argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'windows',    argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'postscript', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'xfix',       argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'bitmap',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'pictex',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'cairo_pdf',  argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'svg',        argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'bmp',        argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'tiff',       argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'X11',        argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'quartz',     argIdx: 0, argName: 'file', resolveValue: true },
	// car
	{ package: 'car', name: 'Export', argIdx: 0, argName: 'file', resolveValue: true },
	// LIM
	{ package: 'LIM', name: 'PrintMat', linkTo: OutputRedirects, resolveValue: true },
	// sjmisc
	{ package: 'sjmisc', name: 'write_spss',  argIdx: 1, argName: 'path', resolveValue: true },
	{ package: 'sjmisc', name: 'write_stata', argIdx: 1, argName: 'path', resolveValue: true },
	{ package: 'sjmisc', name: 'write_sas',   argIdx: 1, argName: 'path', resolveValue: true },
	// ape
	{ package: 'ape', name: 'write.tree',     argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'ape', name: 'write.nexus',    argIdx: 1, argName: 'file', resolveValue: true },
	{ package: 'ape', name: 'write.phyloXML', argIdx: 1, argName: 'file', resolveValue: true },
	// Claddis
	{ package: 'Claddis', name: 'write_nexus_matrix', argIdx: 1, argName: 'file_name', resolveValue: true },
	{ package: 'Claddis', name: 'write_tnt_matrix',   argIdx: 1, argName: 'file_name', resolveValue: true },
	// rgdal
	{ package: 'rgdal', name: 'writeOGR',  argIdx: 1, argName: 'dsn',   resolveValue: true },
	{ package: 'rgdal', name: 'writeGDAL', argIdx: 1, argName: 'fname', resolveValue: true },
	// arrow
	{ package: 'arrow', name: 'write_parquet', argIdx: 1, argName: 'sink', resolveValue: true },
	// sf
	{ package: 'sf', name: 'st_write', argIdx: 1, argName: 'dsn', resolveValue: true },
	{ package: 'sf', name: 'write_sf', argIdx: 1, argName: 'dsn', resolveValue: true, ignoreIf: 'arg-missing' },
	// maptools
	{ package: 'maptools', name: 'writePolyShape', argIdx: 1, argName: 'fn', resolveValue: true },
	// XLConnect
	{ package: 'XLConnect', name: 'writeNamedRegionToFile', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'XLConnect', name: 'writeWorksheetToFile',   argIdx: 0, argName: 'file', resolveValue: true },
	// visNetwork
	{ package: 'visNetwork', name: 'visSave', argIdx: 1, argName: 'file', resolveValue: true },
	// DiagrammeR
	{ package: 'DiagrammeR', name: 'save_graph',   argIdx: 1, argName: 'file',      resolveValue: true },
	{ package: 'DiagrammeR', name: 'export_graph',            argName: 'file_name', resolveValue: true },
	// ggplot
	{ package: 'ggplot', name: 'ggsave', argIdx: 0, argName: 'filename', resolveValue: true },
	// rasterpdf
	{ package: 'rasterpdf', name: 'raster_pdf', argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'rasterpdf', name: 'agg_pdf',    argIdx: 0, argName: 'filename', resolveValue: true },

] as const;