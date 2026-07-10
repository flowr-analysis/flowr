df <- data.frame(a = 1:10, b = letters[1:10])
df$c <- df$a * 2
df <- df[df$a > 3, ]
sub <- df[, c("a", "c")]
print(colnames(sub))
print(nrow(df))
