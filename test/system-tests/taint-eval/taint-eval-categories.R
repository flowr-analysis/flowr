# Fixture for the taint-analysis eval test: exercises TaintFnCategory-derived mappings.
# `read.table` is a manual security source and `source` a manual sink, while `abs`/`sqrt`
# are propagated through the pureComputer function category.
data <- read.table("f.csv")
x <- abs(data)
y <- sqrt(x)
source(y)
