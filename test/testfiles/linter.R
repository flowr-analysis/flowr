# Example R script for demonstrating the flowR linter
# Try it out in the REPL:
# R> :query @linter rules:file-path-validity,absolute-file-paths,dead-code,seeded-randomness,deprecated-functions file://test/testfiles/linter.R

my_data <- read.csv("C:/Users/Researcher/R/Reproducible.csv")
if (FALSE) {
    dplyr::sample_n(my_data, 5)
}