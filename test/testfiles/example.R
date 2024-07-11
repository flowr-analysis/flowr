sum <- 0
product <- 1
w <- 7
N <- 10

for (i in 1:(N-1)) {
  sum <- sum + i + w
  product <- product * i
}

if(TRUE) {product <- sum * product} else {sum <- product + sum}

cat("Sum:", sum, "\n")
cat("Product:", product, "\n")
