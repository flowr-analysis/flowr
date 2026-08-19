lst <- list(x = list(y = list(z = 1:5)))
lst$x$y$z[3] <- 42
val <- lst[["x"]][["y"]][["z"]]
print(val)
print(lst$x$y$z)
