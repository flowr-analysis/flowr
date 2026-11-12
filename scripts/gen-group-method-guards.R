# Writes the S3 methods the base packages define for the members of R's group generics, as JSON for scripts/gen-group-method-guards.ts:
#   Rscript scripts/gen-group-method-guards.R <file>
# Each entry names a member, the class vector of a value R makes (like `c("POSIXct", "POSIXt")`), the method dispatch finds for it,
# and the code of that method with `.Generic` replaced by the member, so that what it asks of its arguments can be read off it.
members <- list(Math = c(methods::getGroupMembers("Math"), "round", "signif"), Ops = c(unlist(lapply(methods::getGroupMembers("Ops"), methods::getGroupMembers)), "&", "|", "!"),
  Summary = methods::getGroupMembers("Summary"), Complex = methods::getGroupMembers("Complex"), matrixOps = "%*%")
classes <- unique(lapply(list(factor(1), ordered(1), Sys.Date(), Sys.time(), as.POSIXlt(Sys.time()), as.difftime(1, units = "secs"), data.frame(), ts(1),
  numeric_version("1"), packageVersion("base"), getRversion(), as.hexmode(1), as.octmode(1), utils::as.roman(1), grDevices::as.raster(matrix(0)), table(1), noquote("a")), oldClass))
tables <- lapply(c("base", "stats", "utils", "methods", "graphics", "grDevices"), function(p) get(".__S3MethodsTable__.", envir = asNamespace(p)))
method <- function(name) { for(t in tables) if(exists(name, envir = t, inherits = FALSE)) return(get(name, envir = t)); NULL }
out <- list()
for(group in names(members)) for(member in members[[group]]) for(cls in classes) {
  for(c in cls) {
    own <- method(paste0(member, ".", c)); f <- if(is.null(own)) method(paste0(group, ".", c)) else own
    if(is.null(f)) next
    name <- if(is.null(own)) paste0(group, ".", c) else paste0(member, ".", c)
    b <- eval(call("substitute", body(f), list(.Generic = member)))
    code <- paste(deparse(`body<-`(`attr<-`(f, "srcref", NULL), value = b), width.cutoff = 200, control = c("keepNA", "keepInteger", "niceNames", "showAttributes")), collapse = "\n")
    out[[length(out) + 1]] <- list(group = group, member = member, classes = I(cls), method = name, formals = I(names(formals(f))), code = code)
    break
  }
}
writeLines(jsonlite::toJSON(out, auto_unbox = TRUE), commandArgs(TRUE)[1])
