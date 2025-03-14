import type { FunctionInfo } from './function-info';

export const ReadFunctions: FunctionInfo[] = [
	{ package: 'base', name: 'parse',                          argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'base', name: 'read.table',          argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'read.csv',            argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'read.csv2',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'read.delim',          argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'read.dcf',            argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'scan',                argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'read.fwf',            argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'file',                argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'url',                 argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'load',                argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'gzfile',              argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'bzfile',              argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'download.file',       argIdx: 0, argName: 'url',  resolveValue: true },
	{ package: 'base', name: 'pipe',                argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'fifo',                argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'unz',                 argIdx: 1, argName: 'open', resolveValue: true },
	{ package: 'base', name: 'matrix',              argIdx: 0, argName: 'data', resolveValue: true },
	{ package: 'base', name: 'readRDS',             argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base', name: 'readLines',           argIdx: 0, argName: 'con',  resolveValue: true },
	{ package: 'base', name: 'readRenviron',        argIdx: 0, argName: 'path', resolveValue: true },
	// readr
	{ package: 'readr', name: 'read_csv',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_csv2',          argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_lines',         argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_delim',         argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_dsv',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_fwf',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_tsv',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_table',         argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_log',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_lines_raw',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_lines_chunked', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'read_rds',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'readr', name: 'clipboard'                                                          },
	// xlsx
	{ package: 'xlsx', name: 'read.xlsx',           argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'xlsx', name: 'read.xlsx2',          argIdx: 0, argName: 'file', resolveValue: true },
	// data.table
	{ package: 'data.table', name: 'fread', argIdx: 0, argName: 'file', resolveValue: true },
	// haven
	{ package: 'haven', name: 'read_sas', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'haven', name: 'read_sav', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'haven', name: 'read_por', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'haven', name: 'read_dta', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'haven', name: 'read_xpt', argIdx: 0, argName: 'file', resolveValue: true },
	// feather
	{ package: 'feather', name: 'read_feather', argIdx: 0, argName: 'file', resolveValue: true },
	// foreign
	{ package: 'foreign', name: 'read.arff',    argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.dbf',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.dta',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.epiinfo', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.mtp',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.octave',  argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.spss',    argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.ssd',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.systat',  argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'foreign', name: 'read.xport',   argIdx: 0, argName: 'file', resolveValue: true },
	// car
	{ package: 'car', name: 'Import', argIdx: 0, argName: 'file', resolveValue: true },
	// magick
	{ package: 'magick', name: 'image_read',       argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'magick', name: 'image_read_svg',   argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'magick', name: 'image_read_pdf',   argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'magick', name: 'image_read_video', argIdx: 0, argName: 'path', resolveValue: true },
	// LIM
	{ package: 'LIM', name: 'Read', argIdx: 0, argName: 'file', resolveValue: true },
	// sourcetools,
	{ package: 'sourcetools', name: 'read',             argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'sourcetools', name: 'read_lines',       argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'sourcetools', name: 'read_bytes',       argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'sourcetools', name: 'read_lines_bytes', argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'sourcetools', name: 'tokenize',                    argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'sourcetools', name: 'tokenize_file',    argIdx: 0, argName: 'path', resolveValue: true },
	// expss
	{ package: 'expss', name: 'read_spss',         argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'expss', name: 'read_spss_to_list', argIdx: 0, argName: 'file', resolveValue: true },
	// SimPhe
	{ package: 'SimPhe', name: 'read.geno', argIdx: 0, argName: 'fname', resolveValue: true },
	// ape
	{ package: 'ape', name: 'read.tree', argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	// geomorph
	{ package: 'geomorph', name: 'readland.tps', argIdx: 0, argName: 'file', resolveValue: true },
	// readxl
	{ package: 'readxl', name: 'read_excel', argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'readxl', name: 'read_xls',   argIdx: 0, argName: 'path', resolveValue: true },
	{ package: 'readxl', name: 'read_xlsx',  argIdx: 0, argName: 'path', resolveValue: true },
	// sf
	{ package: 'sf', name: 'read.sf', argIdx: 0, argName: 'dsn', resolveValue: true },
	{ package: 'sf', name: 'st_read', argIdx: 0, argName: 'dsn', resolveValue: true },
	// rgdal
	{ package: 'rgdal', name: 'readOGR',       argIdx: 0, argName: 'dsn',   resolveValue: true },
	{ package: 'rgdal', name: 'ogrInfo',       argIdx: 0, argName: 'dsn',   resolveValue: true },
	{ package: 'rgdal', name: 'ogrFIDs',       argIdx: 0, argName: 'dsn',   resolveValue: true },
	{ package: 'rgdal', name: 'OGRSpatialRef', argIdx: 0, argName: 'dsn',   resolveValue: true },
	{ package: 'rgdal', name: 'ogrListLayers', argIdx: 0, argName: 'dsn',   resolveValue: true },
	{ package: 'rgdal', name: 'readGDAL',      argIdx: 0, argName: 'fname', resolveValue: true },
	// readstata13
	{ package: 'readstata13', name: 'read.dta13', argIdx: 0, argName: 'file', resolveValue: true },
	// arrow
	{ package: 'arrow', name: 'read_parquet', argIdx: 0, argName: 'file', resolveValue: true },
	// maptools
	{ package: 'maptools', name: 'readShapePoly', argIdx: 0, argName: 'fn', resolveValue: true },
	// XLConnect
	{ package: 'XLConnect', name: 'readWorksheetFromFile',   argIdx: 0, argName: 'file',     resolveValue: true },
	{ package: 'XLConnect', name: 'readNamedRegionFromFile', argIdx: 0, argName: 'file',     resolveValue: true },
	{ package: 'XLConnect', name: 'loadWorkbook',            argIdx: 0, argName: 'filename', resolveValue: true },
	// DiagrammeR
	{ package: 'DiagrammeR', name: 'import_graph', argIdx: 0, argName: 'graph_file', resolveValue: true },
	{ package: 'DiagrammeR', name: 'open_graph',   argIdx: 0, argName: 'file',       resolveValue: true },
	//  highcharter
	{ package: 'highcharter', name: 'download_map_data', argIdx: 0, argName: 'url', resolveValue: true },
	// rvest
	{ package: 'rvest', name: 'read_html',      argIdx: 0, argName: 'x',   resolveValue: true },
	{ package: 'rvest', name: 'read_html_live', argIdx: 0, argName: 'url', resolveValue: true },
	// stats
	{ package: 'stats', name: 'read.ftable',    argIdx: 0, argName: 'file', resolveValue: true },
	// DBI
	{ package: 'DBI', name: 'dbReadTable',      argIdx: 1, argName: 'name', resolveValue: true },
	{ package: 'DBI', name: 'dbReadTableArrow', argIdx: 1, argName: 'name', resolveValue: true },

] as const;