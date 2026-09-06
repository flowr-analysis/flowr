library(dplyr)

scale_to_max <- function(x) x / max(x)

raw     <- data.frame(id = 1:6, value = c(3, 8, 7, 2, 9, 4))
clean   <- filter(raw, value > 2)
clean$scaled <- scale_to_max(clean$value)

summary_stats <- summarise(clean, mean = mean(scaled))
unused_total  <- sum(raw$value)

write.csv(summary_stats, "summary.csv")
plot(clean$scaled)
points(clean$id)
