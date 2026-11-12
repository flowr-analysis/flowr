# Writes the closures of the base packages as R code for scripts/gen-base-guards.ts:
#   Rscript scripts/gen-base-guards.R <directory>
# Each package gets a file `<pkg>.closures.tsv` of `name<TAB>exported<TAB>deparsed code, newlines escaped<TAB>generic<TAB>class<TAB>dispatched`,
# the generic and class naming what it is the S3 method of, and `dispatched` the formal a generic dispatches on, each empty if there is none.
out <- commandArgs(TRUE)[1]
writeLines(as.character(getRversion()), file.path(out, "R-version"))
for (pkg in c("base", "stats", "utils", "graphics", "grDevices")) {
  ns <- asNamespace(pkg)
  exported <- if (pkg == "base") ls(ns, all.names = TRUE) else getNamespaceExports(pkg)
  lines <- character()
  s3 <- function(name) {
    if (!isTRUE(tryCatch(utils::isS3method(name, envir = ns), error = function(e) FALSE))) return(c("", ""))
    parts <- strsplit(name, ".", fixed = TRUE)[[1]]
    for (i in rev(seq_len(length(parts) - 1))) {
      generic <- paste(parts[1:i], collapse = ".")
      cls <- paste(parts[-(1:i)], collapse = ".")
      if (isTRUE(tryCatch(utils::isS3method(f = generic, class = cls, envir = ns), error = function(e) FALSE))) return(c(generic, cls))
    }
    c("", "")
  }
  for (name in sort(ls(ns, all.names = TRUE))) {
    f <- get(name, envir = ns)
    if (is.function(f) && !is.primitive(f) && grepl("^[A-Za-z][A-Za-z0-9._]*$", name)) {
      code <- paste(deparse(`attr<-`(f, "srcref", NULL), width.cutoff = 200, control = c("keepNA", "keepInteger", "niceNames", "showAttributes")), collapse = "\n")
      method <- s3(name)
      dispatched <- if ("UseMethod" %in% all.names(body(f)) && length(formals(f)) > 0) names(formals(f))[1] else ""
      lines <- c(lines, paste(name, name %in% exported, gsub("\n", "\\n", gsub("\\", "\\\\", code, fixed = TRUE), fixed = TRUE), method[1], method[2], dispatched, sep = "\t"))
    }
  }
  writeLines(lines, file.path(out, paste0(pkg, ".closures.tsv")), useBytes = TRUE)
}
