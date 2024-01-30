# it seems like R wants this path to be relative to the source file,
# but we might want it relative to the cwd of the shell executor?
source("test/testfiles/example.R")

cat("-----\n")
cat("Sourced N:", N, "\n")
