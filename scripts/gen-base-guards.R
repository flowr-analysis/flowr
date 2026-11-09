# Writes the closures of the base packages as R code for scripts/gen-base-guards.ts:
#   Rscript scripts/gen-base-guards.R <directory>
# Each package gets a file `<pkg>.closures.tsv` of `name<TAB>exported<TAB>deparsed code, newlines escaped`.
out <- commandArgs(TRUE)[1]
writeLines(as.character(getRversion()), file.path(out, "R-version"))
for (pkg in c("base", "stats", "utils", "graphics", "grDevices")) {
  ns <- asNamespace(pkg)
  exported <- if (pkg == "base") ls(ns, all.names = TRUE) else getNamespaceExports(pkg)
  lines <- character()
  for (name in sort(ls(ns, all.names = TRUE))) {
    f <- get(name, envir = ns)
    if (is.function(f) && !is.primitive(f) && grepl("^[A-Za-z][A-Za-z0-9._]*$", name)) {
      code <- paste(deparse(`attr<-`(f, "srcref", NULL), width.cutoff = 200, control = c("keepNA", "keepInteger", "niceNames", "showAttributes")), collapse = "\n")
      lines <- c(lines, paste(name, name %in% exported, gsub("\n", "\\n", gsub("\\", "\\\\", code, fixed = TRUE), fixed = TRUE), sep = "\t"))
    }
  }
  writeLines(lines, file.path(out, paste0(pkg, ".closures.tsv")), useBytes = TRUE)
}
