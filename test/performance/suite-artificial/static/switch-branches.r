classify <- function(n) {
  switch(as.character(n %% 3),
    "0" = "zero",
    "1" = "one",
    "2" = "two",
    "other"
  )
}
for (i in 1:9) {
  print(classify(i))
}
