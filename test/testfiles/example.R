sum <- 0
product <- 1
w <- 7
N <- 10

print(N, w)

f <- function(w) {
    return (w + sum)
}
print(f(product))

sum <- 6

print(f(product))

