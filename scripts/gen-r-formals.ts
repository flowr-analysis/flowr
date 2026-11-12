/**
 * Records the formals R declares for every function flowR defines a built-in for, as `package -> name -> formals`,
 * for every package installed with the `Rscript`.
 * A name is looked up as `pkg::name` does, primitives are read through `args`, names that are no function (or a special without formals) are left out.
 * Writes `src/data/r-formals.generated.ts` with the versions of R and of every other package read (a base package has the version of R).
 */
import path from 'path';
import { execFileSync } from 'child_process';
import { WrittenBuiltinDefinitions } from '../src/dataflow/environments/default-builtin-config';
import { functionsOfR } from '../src/dataflow/environments/default-builtin-config/r-formals';
import { Identifier, PkgName } from '../src/dataflow/environments/identifier';
import { writePacked } from './pack-generated';

const Reader = `
versions <- list()
for (l in readLines("stdin")) {
  p <- strsplit(l, "\\t")[[1]]
  if (is.null(versions[[p[1]]])) {
    ok <- suppressMessages(suppressWarnings(requireNamespace(p[1], quietly = TRUE)))
    versions[[p[1]]] <- if (ok) as.character(packageVersion(p[1])) else ""
    if (ok && !identical(packageDescription(p[1])$Priority, "base")) cat("@", p[1], versions[[p[1]]], "\\n", sep = "\\t")
  }
  if (!nzchar(versions[[p[1]]])) next
  f <- tryCatch(getExportedValue(p[1], p[2]), error = function(e) NULL)
  if (!is.function(f)) next
  a <- if (is.primitive(f)) args(f) else f
  if (is.null(a)) next
  cat(p[1], p[2], paste(names(formals(a)), collapse = ","), "\\n", sep = "\\t")
}`;

const wanted = new Set<string>();
for(const def of WrittenBuiltinDefinitions) {
	for(const id of functionsOfR(def)) {
		wanted.add(`${String(Identifier.getNamespace(id) ?? PkgName.Base)}\t${String(Identifier.getName(id))}`);
	}
}
const output = execFileSync('Rscript', ['-e', Reader], { input: [...wanted].sort().join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 26 });
const table: Record<string, Record<string, string>> = {};
const versions: Record<string, string> = { R: execFileSync('Rscript', ['-e', 'cat(as.character(getRversion()))'], { encoding: 'utf8' }) };
for(const line of output.split('\n').filter(Boolean)) {
	const [pkg, name, formals] = line.split('\t');
	if(pkg === '@') {
		versions[name] = formals;
	} else {
		(table[pkg] ??= {})[name] = formals;
	}
}
const byKey = <T>(o: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writePacked(path.join(__dirname, '..', 'src', 'data', 'r-formals.generated.ts'), 'scripts/gen-r-formals.ts', [], [
	{ name: 'RFormalsVersions', doc: 'The versions of R and of the packages {@link RFormals} is read from.', type: 'Readonly<Record<string, string>>', value: byKey(versions) },
	{ name: 'RFormals', doc: 'The formals R declares for the functions flowR defines, as `package -> name -> comma separated formals` (empty for none), for the packages of {@link RFormalsVersions}.', type: 'Readonly<Record<string, Readonly<Record<string, string>>>>', value: Object.fromEntries(Object.entries(byKey(table)).map(([pkg, names]) => [pkg, byKey(names)])) }
]);
