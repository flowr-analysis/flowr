result <- c(1, 2, 3, 4, 5) |>
  rev() |>
  cumsum() |>
  sqrt() |>
  round(2) |>
  sum()
print(result)
