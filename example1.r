algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
person$name <- "Jane"
result <- person$name

# grades <- list(algebra = 1.3, sports = 1.7)
# grades$algebra <- 1.0
# person <- list(name = "John", grades = grades)
# result <- person$grades$algebra
