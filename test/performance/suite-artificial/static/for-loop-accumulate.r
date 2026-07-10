acc <- vector()
total <- 0
for (i in 1:50) {
  total <- total + i
  acc[i] <- total
}
print(acc)
print(total)
