# Fixture for control-dependency logging in the taint-analysis eval test.
x <- read.table()
if (isTRUE(x)) {
  a <- guardedThen(x)
} else {
  b <- guardedElse(x)
}
for (i in 1:3) {
  c <- inFor(i)
}
while (running(x)) {
  d <- inWhile(x)
}
repeat {
  e <- inRepeat(x)
  if (done(x)) break
}
stopifnot(is.numeric(x))
f <- afterStopifnot(x)
g <- TRUE && lazyRhs(x)
