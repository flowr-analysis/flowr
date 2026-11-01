# Small fixture for the taint-analysis eval test: one user-input source and one randomness source.
x <- read.table()
bla <- someunknown("argOfUnmapped")
y <- source(x, "someOtherArg", namedArg = TRUE)
myLocal <- function(a) a
z <- myLocal(x)
