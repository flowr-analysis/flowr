s <- "hello world"
s <- paste(s, "again", sep = " ")
s <- toupper(s)
s <- gsub("O", "0", s)
parts <- strsplit(s, " ")[[1]]
print(nchar(s))
print(parts)
