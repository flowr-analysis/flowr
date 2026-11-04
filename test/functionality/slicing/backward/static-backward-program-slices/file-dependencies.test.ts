import { assertSliceKeeps, assertSliceMatchesR, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import type { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';

describe('File Dependencies', withTreeSitter(parser => {
	const keeps = (name: string, code: string, expected: { kept?: readonly string[], dropped?: readonly string[] }, criterion?: SlicingCriterion) =>
		assertSliceKeeps(label(name, ['file-dependencies', 'i-o'], ['slice']), parser, code, criterion ?? `${code.split('\n').length}@print`, expected);

	describe('a download writes the file it is saved to, and reads only its source', () => {
		const read = 'd <- read.csv("b.csv")\nprint(d)';
		for(const download of [
			'download.file("https://x.org/b.csv", "b.csv")',
			'curl::curl_download("https://x.org/b.csv", "b.csv")',
			'curl::curl_fetch_disk("https://x.org/b.csv", "b.csv")',
			'curl::multi_download("https://x.org/b.csv", "b.csv")',
			'httr2::req_perform(httr2::request("https://x.org/b.csv"), path = "b.csv")',
			'xfun::download_file("https://x.org/b.csv", "b.csv")',
			'downloader::download("https://x.org/b.csv", destfile = "b.csv")',
			'xml2::download_html("https://x.org/b.csv", "b.csv")',
			'googledrive::drive_download("b-id", path = "b.csv")',
			'aws.s3::save_object("b.csv", bucket = "bk", file = "b.csv")'
		]) {
			const name = download.slice(0, download.indexOf('('));
			keeps(`${name} is kept`, `${download}\n${read}`, { kept: [name] });
			/* the url is no file the program writes, so a download to elsewhere is not needed */
			keeps(`${name} to another file is not kept`, `${download.replace(/"b\.csv"\)*$/, m => m.replace('b.csv', 'c.csv')).replace(/(destfile|path|file) = "b\.csv"/, '$1 = "c.csv"')}\n${read}`, { dropped: [name] });
		}
		keeps('reading the url does not need a download from it', 'download.file("https://x.org/b.csv", "c.csv")\nd <- read.csv("https://x.org/b.csv")\nprint(d)', { dropped: ['download.file'] });
	});

	describe('unpacking an archive writes the files read afterwards', () => {
		const read = 'd <- read.csv("data/b.csv")\nprint(d)';
		for(const [name, unpack] of [
			['utils::unzip with exdir', 'unzip("a.zip", exdir = "data")'],
			['utils::unzip into the working directory', 'unzip("a.zip")'],
			['utils::unzip with exdir by position', 'unzip("a.zip", NULL, FALSE, TRUE, FALSE, "data")'],
			['utils::unzip of some files', 'unzip("a.zip", files = "b.csv", exdir = "data")'],
			['utils::untar', 'untar("a.tar.gz", exdir = "data")'],
			['utils::untar into the working directory', 'untar("a.tar.gz")'],
			['zip::unzip', 'zip::unzip("a.zip", exdir = "data")'],
			['archive::archive_extract', 'archive::archive_extract("a.zip", "data")'],
			['archive::archive_extract into the working directory', 'archive::archive_extract("a.zip")'],
			['R.utils::gunzip with destname', 'R.utils::gunzip("data/b.csv.gz", "data/b.csv")'],
			['R.utils::gunzip without destname', 'R.utils::gunzip("data/b.csv.gz")'],
			['R.utils::bunzip2', 'R.utils::bunzip2("data/b.csv.bz2")'],
			['a computed exdir', 'dir <- file.path("da", "ta")\nunzip("a.zip", exdir = dir)'],
			['an unknown exdir', 'unzip("a.zip", exdir = commandArgs()[1])']
		] as const) {
			keeps(`${name} is kept`, `${unpack}\n${read}`, { kept: [unpack.split('\n').at(-1) as string] });
		}
		keeps('the archive is what an earlier call wrote', `download.file("https://example.org/a.zip", "a.zip")\nunzip("a.zip", exdir = "data")\n${read}`,
			{ kept: ['download.file', 'unzip'] });
		keeps('another archive written before is not needed', `download.file("https://example.org/a.zip", "a.zip")\ndownload.file("https://example.org/c.zip", "c.zip")\nunzip("a.zip", exdir = "data")\n${read}`,
			{ kept: ['"a.zip")', 'unzip'], dropped: ['c.zip'] });
		keeps('an archive unpacked after the read is not', `${read.split('\n')[0]}\nunzip("a.zip", exdir = "data")\nprint(d)`, { dropped: ['unzip'] });
		keeps('the archive packed before', 'write.csv(iris, "b.csv")\nwrite.csv(cars, "c.csv")\nzip("a.zip", "b.csv")\nunzip("a.zip", exdir = "o")\nd <- read.csv("o/b.csv")\nprint(d)',
			{ kept: ['write.csv(iris', 'zip("a.zip"', 'unzip'], dropped: ['cars'] });
		keeps('a package archiver packs what was written', 'write.csv(iris, "b.csv")\nzip::zip("a.zip", "b.csv")\narchive::archive_extract("a.zip", "o")\nd <- read.csv("o/b.csv")\nprint(d)',
			{ kept: ['write.csv(iris', 'zip::zip', 'archive_extract'] });
		keeps('unpacking within a function is kept at its call', 'get <- function(z) unzip(z, exdir = "data")\nget("a.zip")\nx <- 1\n' + read,
			{ kept: ['get("a.zip")', 'unzip(z'], dropped: ['x <- 1'] });
		keeps('a conditional unpack is kept', 'if(!dir.exists("data")) unzip("a.zip", exdir = "data")\n' + read, { kept: ['unzip'] });
		for(const [name, unpack] of [
			['a qualified call', 'utils::unzip("a.zip", exdir = "data")'],
			['a pipe', '"a.zip" |> unzip(exdir = "data")'],
			['a magrittr pipe', 'library(magrittr)\n"a.zip" %>% unzip(exdir = "data")'],
			['lapply', 'lapply(c("a.zip", "c.zip"), unzip, exdir = "data")'],
			['do.call', 'do.call(unzip, list("a.zip", exdir = "data"))'],
			['a loop', 'for(z in c("a.zip", "c.zip")) unzip(z, exdir = "data")'],
			['an assignment as the argument', 'unzip(z <- "a.zip", exdir = "data")'],
			['a tempdir', 'td <- tempdir()\nunzip("a.zip", exdir = td)']
		] as const) {
			keeps(`unpacking through ${name} is kept`, `${unpack}\n${read}`, { kept: ['unzip'] });
		}
		keeps('the call unpacking into the read directory is kept, the other is not', 'ex <- function(d) unzip("a.zip", exdir = d)\nex("x")\nex("y")\nd <- read.csv("y/b.csv")\nprint(d)',
			{ kept: ['ex("y")'], dropped: ['ex("x")'] });
		keeps('a read in the temporary directory', 'td <- tempdir()\nunzip("a.zip", exdir = td)\nd <- read.csv(file.path(td, "b.csv"))\nprint(d)', { kept: ['unzip'] });
		keeps('the archive downloaded to a temporary file', 'tf <- tempfile(fileext = ".zip")\ndownload.file("https://example.org/a.zip", tf)\nunzip(tf, exdir = "data")\n' + read,
			{ kept: ['download.file', 'unzip', 'tf <- tempfile'] });
		keeps('a read in a loop sees the unpacking of the iteration before', 'for(i in 1:2) {\n  d <- read.csv("data/b.csv")\n  unzip("a.zip", exdir = "data")\n}\nprint(d)', { kept: ['unzip'] });
		for(const reader of ['readr::read_csv("data/b.csv")', 'data.table::fread("data/b.csv")', 'readRDS("data/b.rds")', 'readLines("data/b.txt")', 'jsonlite::read_json("data/b.json")', 'readxl::read_excel("data/b.xlsx")', 'sf::st_read("data/b.shp")']) {
			keeps(`${reader} reads what was unpacked`, `unzip("a.zip", exdir = "data")\nd <- ${reader}\nprint(d)`, { kept: ['unzip'] });
		}
		keeps('load reads what was unpacked', 'unzip("a.zip", exdir = "data")\nload("data/b.RData")\nprint(b)', { kept: ['unzip'] });
		keeps('source runs what was unpacked', 'unzip("a.zip", exdir = "data")\nsource("data/b.R")\nprint(1)', { kept: ['unzip', 'source'] });
		keeps('listing the files reads what was unpacked', 'unzip("a.zip", exdir = "data")\nfs <- list.files("data")\nprint(fs)', { kept: ['unzip'] });
	});

	describe('copying reads the source and writes the target', () => {
		const written = 'write.csv(iris, "x.csv")\nwrite.csv(cars, "y.csv")';
		for(const [name, copy] of [
			['file.copy', 'file.copy("x.csv", "b.csv")'],
			['file.copy by name', 'file.copy(to = "b.csv", from = "x.csv")'],
			['file.copy into a directory', 'file.copy("x.csv", "out")'],
			['file.link', 'file.link("x.csv", "b.csv")'],
			['file.symlink', 'file.symlink("x.csv", "b.csv")'],
			['file.rename', 'file.rename("x.csv", "b.csv")'],
			['fs::file_copy', 'fs::file_copy("x.csv", "b.csv")'],
			['fs::file_move', 'fs::file_move("x.csv", "b.csv")'],
			['fs::link_create', 'fs::link_create("x.csv", "b.csv")']
		] as const) {
			const target = copy.includes('"out"') ? 'out/b.csv' : 'b.csv';
			keeps(`${name} keeps the source`, `${written}\n${copy}\nd <- read.csv("${target}")\nprint(d)`, { kept: [copy, 'write.csv(iris'], dropped: ['cars'] });
		}
		keeps('an unrelated copy is not needed', 'file.copy("x.csv", "b.csv")\nd <- read.csv("a.csv")\nprint(d)', { dropped: ['file.copy'] });
		keeps('an unrelated rename stays, as the file it moves is gone', 'file.rename("x.csv", "b.csv")\nd <- read.csv("a.csv")\nprint(d)', { kept: ['file.rename'] });
		keeps('appending keeps both files', 'write.csv(iris, "x.csv")\nwrite.csv(cars, "b.csv")\nfile.append("b.csv", "x.csv")\nd <- readLines("b.csv")\nprint(d)',
			{ kept: ['write.csv(iris', 'write.csv(cars', 'file.append'] });
		keeps('a copy of a copy', 'write.csv(iris, "x.csv")\nfile.copy("x.csv", "y.csv")\nfile.copy("y.csv", "b.csv")\nd <- read.csv("b.csv")\nprint(d)',
			{ kept: ['write.csv(iris', '"x.csv", "y.csv"', '"y.csv", "b.csv"'] });
	});

	describe('the slice computes what the program does', () => {
		for(const [name, code, dropped] of [
			['a database read sees the writes through the connection', 'library(DBI)\ncon <- dbConnect(RSQLite::SQLite(), "d.sqlite")\ndbWriteTable(con, "t", data.frame(a = 1:3))\ndbExecute(con, "INSERT INTO t VALUES (9)")\nprint(nrow(dbReadTable(con, "t")))', undefined],
			['a database read needs the table appended to', 'library(DBI)\ncon <- dbConnect(RSQLite::SQLite(), "d.sqlite")\ndbWriteTable(con, "t", data.frame(a = 1))\ndbWriteTable(con, "u", data.frame(a = 1:5))\ndbAppendTable(con, "t", data.frame(a = 2))\nprint(dbReadTable(con, "t"))', undefined],
			['a stubbed function is the one called', 'library(mockery)\nf <- function() 1\ng <- function() f()\nstub(g, "f", function() 2)\nprint(g())', undefined],
			['tar and untar', 'write.csv(iris[1:3, ], "b.csv", row.names = FALSE)\nwrite.csv(cars, "c.csv")\ntar("a.tar", "b.csv")\nunlink("b.csv")\nuntar("a.tar", exdir = "o")\nd <- read.csv("o/b.csv")\nprint(d)', 'cars'],
			['copy, then read the copy', 'writeLines("one", "x.txt")\nwriteLines("two", "y.txt")\nfile.copy("x.txt", "b.txt")\nprint(readLines("b.txt"))', '"two"'],
			['copy into a directory', 'writeLines("one", "x.txt")\ndir.create("out")\nfile.copy("x.txt", "out")\nprint(readLines("out/x.txt"))', undefined],
			['append', 'writeLines("one", "x.txt")\nwriteLines("two", "b.txt")\nfile.append("b.txt", "x.txt")\nprint(readLines("b.txt"))', undefined],
			['rename', 'writeLines("one", "x.txt")\nfile.rename("x.txt", "b.txt")\nprint(file.exists("x.txt"))', undefined],
			['copy in a function', 'cp <- function(to) file.copy("x.txt", to)\nwriteLines("one", "x.txt")\ncp("b.txt")\ncp("c.txt")\nprint(readLines("b.txt"))', undefined],
			['zip and unzip', 'writeLines("one", "b.txt")\nwriteLines("two", "c.txt")\nzip("a.zip", "b.txt", flags = "-q")\nunlink("b.txt")\nunzip("a.zip", exdir = "o")\nprint(readLines("o/b.txt"))', '"two"'],
			['unzip into the working directory', 'dir.create("src")\nwriteLines("one", "src/b.txt")\nzip("a.zip", "src/b.txt", flags = "-q")\nunlink("src", recursive = TRUE)\nunzip("a.zip")\nprint(readLines("src/b.txt"))', undefined],
			['unzip after setwd', 'writeLines("one", "b.txt")\nzip("a.zip", "b.txt", flags = "-q")\ndir.create("w")\nsetwd("w")\nunzip("../a.zip")\nprint(readLines("b.txt"))', undefined],
			['a conditional copy', 'writeLines("one", "x.txt")\nwriteLines("old", "b.txt")\nif(file.exists("x.txt")) file.copy("x.txt", "b.txt", overwrite = TRUE)\nprint(readLines("b.txt"))', undefined],
			['a copy in a loop', 'for(f in c("x", "y")) writeLines(f, paste0(f, ".txt"))\nfor(f in c("x", "y")) file.copy(paste0(f, ".txt"), paste0(f, "2.txt"))\nprint(readLines("y2.txt"))', undefined],
			['a copy whose result is printed', 'writeLines("one", "x.txt")\nok <- file.copy("x.txt", "b.txt")\nprint(ok)', undefined],
			['file.create makes the file read', 'file.create("x.txt")\nfile.create("y.txt")\nprint(file.size("x.txt"))', 'y.txt'],
			['file.create empties the file written before', 'writeLines("one", "x.txt")\nfile.create("x.txt")\nprint(readLines("x.txt"))', undefined],
			['load of a file saved within a function', 'x <- 1\nf <- function() save(x, file = "s.RData")\nf()\nx <- 2\nload("s.RData")\nprint(x)', undefined],
			['load within a function', 'x <- 1\nsave(x, file = "s.RData")\nf <- function() {\n  load("s.RData")\n  x\n}\nrm(x)\nprint(f())', undefined],
			['load of the file saved last', 'x <- 1\ny <- 2\nsave(x, file = "s.RData")\nsave(y, file = "t.RData")\nrm(x, y)\nload("t.RData")\nprint(y)', 's.RData'],
			['save.image saves every variable', 'x <- 1\nz <- 3\nsave.image("s.RData")\nx <- 2\nrm(x)\nload("s.RData")\nprint(x)', undefined],
			['dump writes the variable named', 'a <- 1\nb <- 2\ndump("a", "x.txt")\nrm(a)\nsource("x.txt")\nprint(a)', 'b <- 2'],
			['save of the variables ls lists', 'x <- 1\nsave(list = ls(), file = "s.RData")\nrm(x)\nload("s.RData")\nprint(x)', undefined],
			['ls lists what is defined', 'x <- 1\ny <- 2\nprint(ls())', undefined],
			['save names a variable as a string', 'x <- 1\ny <- 2\nsave("x", file = "s.RData")\nrm(x)\nload("s.RData")\nprint(x)', 'y <- 2'],
			['save names variables in list', 'x <- 1\ny <- 2\nz <- 3\nsave(list = c("x", "y"), file = "s.RData")\nrm(x, y)\nload("s.RData")\nprint(x + y)', 'z <- 3'],
			['source into an environment', 'writeLines("y <- 6", "s.R")\ne <- new.env()\nsource("s.R", local = e)\nr <- e$y\nprint(r)', undefined],
			['a read in a function called after the caller changed the directory', 'dir.create("sub")\nwriteLines("S", "sub/f.txt")\nrd <- function() readLines("f.txt")\ng <- function() { setwd("sub"); rd() }\nprint(g())', undefined],
			['a write in one function read relatively from another directory', 'dir.create("sub")\nwr <- function() writeLines("w", "f.txt")\ncdr <- function() { setwd("sub"); readLines("../f.txt") }\nwr()\nprint(cdr())', undefined],
			['a function reading the working directory its caller set', 'dir.create("sub")\nwd <- function() basename(getwd())\ng <- function() { setwd("sub"); wd() }\nprint(g())', undefined],
			['a rendered document is read back', 'library(rmarkdown)\nwriteLines("x", "r.Rmd")\nrender("r.Rmd", output_file = "out.html", quiet = TRUE)\nprint(file.size("out.html") > 0)', undefined],
			['purl writes the code of a document', 'library(knitr)\nwriteLines("x", "r.Rmd")\npurl("r.Rmd", output = "r.R")\nprint(readLines("r.R"))', undefined],
			['an environment file sets variables', 'writeLines("FOO=bar", "e.env")\nx <- 1\nreadRenviron("e.env")\nprint(Sys.getenv("FOO"))', 'x <- 1'],
			['opening a connection to append', 'writeLines("x", "f.txt")\ncon <- file("f.txt")\nopen(con, "a")\nwriteLines("b", con)\nclose(con)\nprint(readLines("f.txt"))', undefined],
			['a read moves the position of an open connection', 'con <- file("in.txt")\nwriteLines(c("l1", "l2"), con)\nopen(con, "r")\nx <- readLines(con, n = 1)\nprint(readLines(con, n = 1))', undefined],
			['load restores into an environment', 'x <- 5\nsave(x, file = "a.RData")\ne <- new.env()\nload("a.RData", envir = e)\nr <- e$x\nprint(r)', undefined],
			['load restores what the program saved', 'x <- 5\ny <- 2\nsave(x, file = "x.RData")\nrm(x)\nload("x.RData")\nprint(x)', 'y <- 2'],
			['sys.source into an environment', 'writeLines("y <- 6", "s.R")\ne <- new.env()\nsys.source("s.R", envir = e)\nr <- e$y\nprint(r)', undefined],
			['source with further arguments', 'writeLines("y <- 6", "s.R")\ny <- 1\nsource("s.R", echo = FALSE)\nprint(y)', undefined],
			['save names variables held by a variable', 'x <- 1\nv <- "x"\nsave(list = v, file = "s.RData")\nrm(x)\nload("s.RData")\nprint(x)', undefined]
		] as const) {
			assertSliceMatchesR(parser, label(name, ['file-dependencies'], ['slice']), code, { dropped });
		}
	});
}));
