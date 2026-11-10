# Calls a function with all kinds of values, and checks every normal return against what flowR claims about the function.
succeeds <- function(e) {
  s <- substitute(e)
  if(is.call(s) && identical(s[[1]], as.name("UseMethod"))) return(TRUE)
  !inherits(try(e, silent = TRUE), "try-error")
}
.guards_values <- list(NULL, TRUE, FALSE, NA, NA_integer_, NA_character_, NA_real_, NaN, 1L, 0L, -1L, 2L, 1.5, 0, -1, 7, 1i, "a", "b", "al", "alpha", "beta", "z", "", "TRUE", "fn_a", "sum2", raw(1),
  list(1), list(), list(a = 1), list(a = 2), function(...) 1, sum, new.env(), quote(a), quote(a + b), data.frame(a = 1), data.frame(), factor("a"), factor("b", levels = c("z", "b")),
  structure(1, class = "foo"), structure(function(...) 1, class = "foo"), expression(a), pairlist(a = 1), c(1, 2), c(-1, 1), character(0), integer(0), logical(0), c("a", "b"), c("b", "a"),
  c(TRUE, FALSE), c(TRUE, TRUE), matrix(1:4, 2), Sys.Date(), globalenv(), as.POSIXct("2020-01-01"), as.difftime(1, units = "secs"), numeric_version("1.2"), table(1), ts(1:3), array(1, c(1, 1, 1)), matrix("a"))
.guards_values <- c(.guards_values, local({
  methods::setClass(".GuardsN", contains = "numeric")
  list(methods::setRefClass(".GuardsRef", fields = list(n = "numeric"))$new(n = 1), methods::new(".GuardsN", 1), methods::setClass(".GuardsP", representation(x = "numeric")))
}))
.guards_type <- function(v) {
  t <- typeof(v)
  if(t %in% c("closure", "builtin", "special")) "function" else if(t %in% c("S4", "externalptr")) "other" else t
}
.guards_unquoted <- function(v) if(is.call(v) && identical(v[[1]], as.name("quote"))) eval(v) else v
.guards_holds <- function(f, condition, args) {
  g <- f
  body(g) <- parse(text = condition)[[1]]
  sink(nullfile())
  on.exit(sink())
  tryCatch(isTRUE(all(suppressWarnings(do.call(g, args)))), error = function(e) FALSE)
}
.guards_claims <- function(args, formals, report, f) {
  for(n in intersect(names(formals), names(args))) .guards_claim(.guards_unquoted(args[[n]]), formals[[n]], n, report)
  for(n in names(formals)) for(k in formals[[n]]$cases) if(.guards_holds(f, k$when, args)) {
    if(n %in% names(args)) .guards_claim(.guards_unquoted(args[[n]]), k$claim, paste(n, "if", k$when), report)
    for(r in k$relations) if(!.guards_holds(f, r$holds, args) && (is.null(r$unless) || !.guards_holds(f, r$unless, args))) report(paste("relation", r$holds, "if", k$when), n, args)
  }
}
.guards_claim <- function(v, claim, n, report) {
  if(!is.null(claim$types) && !(.guards_type(v) %in% claim$types)) report("types", n, v)
  if(!is.null(claim$plainTypes) && !is.object(v) && !(.guards_type(v) %in% claim$plainTypes)) report("plainTypes", n, v)
  if(!is.null(claim$classes) && !any(class(v) %in% claim$classes) && !(isS4(v) && any(vapply(claim$classes, function(c) methods::is(v, c), logical(1))))) report("classes", n, v)
  if(!is.null(claim$values) && is.character(v)) {
    values <- as.character(claim$values)
    fits <- if(isTRUE(claim$partial)) all(!is.na(pmatch(v, values, duplicates.ok = TRUE))) || identical(v, values) else all(v %in% values)
    if(!fits) report("values", n, v)
  }
  if(isTRUE(claim$notNA) && isTRUE(tryCatch(anyNA(v), error = function(e) FALSE))) report("notNA", n, v)
  for(m in names(claim$bounds)) {
    if(m == "value" && (!is.numeric(v) || length(v) == 0)) next
    got <- if(m == "value") v else get(m)(v)
    if(is.null(got)) got <- NA
    b <- claim$bounds[[m]]
    if(!is.na(b[1]) && any(got < b[1]) %in% c(TRUE, NA)) report(paste("lower", m), n, v)
    if(!is.na(b[2]) && any(got > b[2]) %in% c(TRUE, NA)) report(paste("upper", m), n, v)
  }
  if(isTRUE(claim$whole) && is.numeric(v) && !isTRUE(all(trunc(v) == v, na.rm = TRUE))) report("whole", n, v)
}
.guards_check <- function(code, clauses, formals, required, returns = NULL, passes = NULL) {
  found <- character(0)
  report <- function(what, n, v) found <<- c(found, paste0(what, " of ", n, " with ", paste(deparse(v), collapse = "")))
  env <- new.env(parent = globalenv())
  suppressWarnings(eval(parse(text = code), env))
  f <- env$f
  names_of <- setdiff(names(base::formals(f)), "...")
  conditions <- lapply(clauses, function(c) { g <- f; body(g) <- parse(text = c)[[1]]; g })
  q <- function(v) if(is.language(v) && !is.expression(v)) call("quote", v) else v
  single <- function(n) lapply(.guards_values, function(v) setNames(list(q(v)), n))
  sets <- c(list(list()), unlist(lapply(names_of, single), recursive = FALSE))
  if(length(names_of) >= 2) {
    some <- .guards_values[c(1, 2, 3, 9, 14, 18, 19, 29, 33, 46, 48)]
    for(v in .guards_values) for(w in some) sets[[length(sets) + 1]] <- setNames(list(q(v), q(w)), names_of[1:2])
  }
  for(args in sets) {
    sink(nullfile())
    returned <- tryCatch({ value <- suppressWarnings(suppressMessages(do.call(f, args))); TRUE }, error = function(e) FALSE)
    sink()
    if(!returned) next
    if(!is.null(returns)) .guards_claim(value, returns, "result", report)
    if(!is.null(passes) && passes %in% names(args) && !identical(value, .guards_unquoted(args[[passes]]))) report("passes", "result", value)
    for(i in seq_along(conditions)) {
      sink(nullfile())
      holds <- tryCatch(isTRUE(all(suppressWarnings(do.call(conditions[[i]], args)))), error = function(e) FALSE)
      sink()
      if(!holds) found <- c(found, paste0(clauses[[i]], " with ", paste(deparse(args), collapse = "")))
    }
    .guards_claims(args, formals, report, f)
    for(r in setdiff(required, names(args))) found <- c(found, paste("required", r))
  }
  cat(unique(found), sep = "\n")
}
