import type { AnalyzerSetupFunction } from '../../lazy-evaluation/lazy-function-eval.test';

export const RealScriptWithError: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: `
        ### Replication material for
### Nash Optimal Party Positions: The nopp  R Package

###################################################
## An application: The 2006 Italian general election
###################################################

## First step: The empirical choice model
library("nopp")
data("italy2006", package = "nopp")
head(italy2006)
colnames(italy2006)
election <- set.data(italy2006, shape = "wide", choice = "vote", 
  varying = 5:14, sep = "_")
head(election)

m <- mlogit(vote ~ prox + partyID | gov_perf + sex + age + education, 
  election, reflevel = "FI")
summary(m)

m2 <- mlogit(vote ~ partyID | gov_perf + sex + age + education | prox,
  election, reflevel = "FI")
summary(m2)

m3 <- mlogit(vote ~ prox + partyID  | gov_perf + sex +
  age + education, italy2006, shape = "wide", choice = "vote",
  varying = 5:14, sep = "_", reflevel = "FI")

## Second step: Estimating party optimal positions
nash.eq <- equilibrium(model = m, data = election)
nash.eq

external.pos <- list(FI = 7.76, UL = 3.54, RC = 1.91,
  AN = 8.27, UDC = 5.99)
external.votes <- list(FI = 0.25, UL = 0.38, RC = 0.10,
  AN = 0.18, UDC = 0.07)
nash.eq <- equilibrium(model = m, data = election, 
  pos = external.pos, votes = external.votes)
nash.eq


coal1 <- list(FI = 1, UL = 2, RC = 2, AN = 1, UDC = 1)
alpha1 <- list(FI = 0.7, UL = 0.8, RC = 0.1, AN = 0.5, UDC = 0.5)
nash.eq <- equilibrium(model = m, data = election, 
  coal = coal1, alpha = alpha1)
nash.eq

nash.eq <- equilibrium(model = m, data = election,
  pos = c(FI = 7.76, UL = 3.54, RC = 1.91, AN = 8.27, UDC = 5.99),
  votes = c(FI = 0.25, UL = 0.38, RC = 0.10, AN = 0.18, UDC = 0.07),
  coal = coal1, alpha = alpha1)
nash.eq

nash.eq <- equilibrium(model = m, data = election, 
  margin = list(UL = "FI"))
nash.eq

nash.eq <- equilibrium(model = m, data = election, 
  margin = list(FI = "UL", UL = "FI"))
nash.eq

nash.eq <- equilibrium(model = m, data = election,
  fixed = list(RC = 1.95), gamma = 0.5)
nash.eq

nash.eq <- equilibrium(model = m, data = election, 
  margin = list(FI = "UL", UL = "FI"),
  fixed = list(RC = 1), gamma = 0.2)

coal1 <- list(FI = 1, UL = 2, RC = 2, AN = 1, UDC = 1)
alpha1 <- list(FI = 0.7, UL = 0.8, RC = 0.5, AN = 0.5, UDC = 0.5)
nash.eq <- equilibrium(model = m, data = election, coal = coal1, 
  alpha = alpha1, fixed = list(RC = 1), gamma = 0.6)

## Linear utility function
data("italy2006.lin", package = "nopp")
election3 <- set.data(italy2006.lin, shape = "wide", 
  choice = "vote", varying = c(5:14), sep = "_")
m3 <- mlogit(vote ~ proxlin + partyID | gov_perf + sex +
  age + education, election3, reflevel = "FI")
nash.eq3 <- equilibrium(model = m3, data = election3,
  quadratic = FALSE)
nash.eq3

## Estimating uncertainty
set.seed(123)
nash.eq.boot <- equilibrium(model = m, data = election, boot = 100)  
nash.eq.boot


set.seed(123)
nash.eq.mc <- equilibrium(model = m, data = election, MC = 100) 
nash.eq.mc

###################################################
## Graphical display of the results
###################################################
nash.eq <- equilibrium(model = m, data = election)
plot(nash.eq)

external.pos <- list(FI = 7.76, UL = 3.54, RC = 1.91, 
  AN = 8.27, UDC = 5.99)
external.votes <- list(FI = 0.25, UL = 0.38, RC = 0.10, 
  AN = 0.18, UDC = 0.07)

nash.eq <- equilibrium(model = m, data = election, 
  pos = external.pos, votes = external.votes)
plot(nash.eq)
plot(nash.eq.boot)

###################################################
### Appendix: Preparing the data
###################################################
data("italy2006.wide", package = "nopp")
head(italy2006.wide)

varlist <- c("FI", "DS", "AN", "DL", "UDC", "RC")
for (var in varlist) {
  assign(sprintf("mean_%s", var),
         mean(italy2006.wide[, var], na.rm = TRUE))
}

mean_UL <- (mean_DS + mean_DL) / 2
mean_UL

varlist <- c("FI", "UL", "AN", "UDC", "RC")
for (var in varlist) {
  italy2006.wide[[sprintf("prox_%s", var)]] <-
    -(get(sprintf("mean_%s", var)) - italy2006.wide$self)^2
}

for (var in varlist) {
  italy2006.wide[[sprintf("proxlin_%s", var)]] <-
    -abs(get(sprintf("mean_%s", var)) - italy2006.wide$self)
}
head(italy2006.wide)

italy2006.wide$UL <- (italy2006.wide$DS + italy2006.wide$DL) / 2
varlist <- c("FI", "UL", "AN", "UDC", "RC")
for (var in varlist) {
  italy2006.wide[[sprintf("proxego_%s", var)]] <- 
    -(italy2006.wide[[var]] - italy2006.wide$self)^2
}

italy2006.wide$partyID_FI <- as.numeric(italy2006.wide$pID == 1)
italy2006.wide$partyID_UL <- as.numeric(italy2006.wide$pID == 23)
italy2006.wide$partyID_AN <- as.numeric(italy2006.wide$pID == 3)
italy2006.wide$partyID_UDC <- as.numeric(italy2006.wide$pID == 4)
italy2006.wide$partyID_RC <- as.numeric(italy2006.wide$pID == 6)

colnames(italy2006.wide)
election <- set.data(italy2006.wide, shape = "wide", 
  choice = "vote", varying = c(16:25, 27:36), sep = "_")
head(election)

m <- mlogit(vote ~ prox + partyID  | gov_perf + sex, 
  election, reflevel = "UL")
election2 <- election
idx <- which( is.na(election2$gov_perf) | 
  is.na(election2$prox) | is.na(election2$partyID) )
election2 <- election2[-idx, ]
nash.eq <- equilibrium(model = m, data = election2)
nash.eq

        ` });
	return analyzer;
};