to_fahrenheit <- function(celsius) celsius * 9 / 5 + 32

report <- function(values) {
  values <- values[!is.na(values)]
  cat("mean:", round(mean(values), 1), "F over", length(values), "days\n")
}
