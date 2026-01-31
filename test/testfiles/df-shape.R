# Example R script for demonstrating the flowR dataframe shape inference
# Try it out in the REPL:
#R> :query @df-shape file://test/testfiles/df-shape.R

library(dplyr)

df1 <- data.frame(
	id = 1:4,
	age = c(25, 32, 35, 40),
	score = c(90, 85, 88, 92)
)
df2 <- data.frame(
	id = c(1, 2, 4),
	category = c("A", "B", "A")
)
df3 <- df1 %>%
	filter(age > 30) %>%
	mutate(level = score^2) %>%
	left_join(df2, by = "id") %>%
	select(-age)

print(df3$level)