x <- 0
if (x == 0) {
  if (x < 1) {
    if (x >= 0) {
      while (x < 5) {
        x <- x + 1
        if (x %% 2 == 0) {
          x <- x + 1
        } else {
          x <- x + 2
        }
      }
    }
  }
}
print(x)
