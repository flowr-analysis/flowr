person <- list(age = 24, name = "John")
person$is_male <- TRUE

if (length(person) >= 3) {
    person$name <- "Jane"
} else {
    person$name <- "Lorane"
}

result <- person$name
result
