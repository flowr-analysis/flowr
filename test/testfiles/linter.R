# Example R script for demonstrating the flowR linter
# Try it out in the REPL:
# R> :query @linter rules:absolute-file-paths,dead-code file://test/testfiles/linter.R

my_data <- read.csv("C:/Users/Researcher/R/Reproducible.csv")
if (FALSE) {
    dplyr::sample_n(my_data, 5)
}