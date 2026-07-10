make_counter <- function(start) {
  count <- start
  function() {
    count <<- count + 1
    count
  }
}
c1 <- make_counter(0)
c2 <- make_counter(100)
print(c1())
print(c1())
print(c2())
