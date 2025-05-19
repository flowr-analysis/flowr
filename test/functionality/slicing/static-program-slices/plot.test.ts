import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { describe } from 'vitest';

describe.sequential('visualizations', withShell(shell => {
	assertSliced(label('magick for image writes', ['functions-with-global-side-effects']),
		shell, `
library(magick)
img <- image_graph(width=300,height=600)
plot(1:10)
cat("dump:", image_write(img, format="jpg"))
		`, ['5@cat'], `
library(magick)
img <- image_graph(width=300,height=600)
plot(1:10)
cat("dump:", image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('multiple graphs one write', ['functions-with-global-side-effects']),
		shell, `
library(magick)
img2 <- image_graph(width=300,height=600)
img <- image_graph(width=300,height=600)
plot(1:10)
cat("dump:", image_write(img, format="jpg"))
		`, ['6@cat'], `
library(magick)
img <- image_graph(width=300,height=600)
plot(1:10)
cat("dump:", image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('magick for image writes with multiple', ['functions-with-global-side-effects']),
		shell, `
library(magick)
img <- image_graph(width=300,height=600)
plot(1:10)
lines(1:10)
points(1:10)
legend("topright", legend="test")
cat("dump:", image_write(img, format="jpg"))
		`, ['8@cat'], `
library(magick)
img <- image_graph(width=300,height=600)
plot(1:10)
lines(1:10)
points(1:10)
legend("topright", legend="test")
cat("dump:", image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('magick for image writes with ggplot', ['functions-with-global-side-effects']),
		shell, `
library(magick)
img <- image_graph(width=300,height=600)
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width, color=Species)) + 
	geom_point() +
	geom_smooth(method="lm") +
	theme_minimal() +
	labs(title="Sepal Length vs Width", x="Sepal Length", y="Sepal Width") +
	ggtitle("Sepal Length vs Width")
cat("dump:", image_write(img, format="jpg"))
		`, ['10@cat'], `
library(magick)
img <- image_graph(width=300,height=600)
ggplot(iris, aes(x=Sepal.Length, y=Sepal.Width, color=Species)) + geom_point() + geom_smooth(method="lm") + theme_minimal() + labs(title="Sepal Length vs Width", x="Sepal Length", y="Sepal Width") + ggtitle("Sepal Length vs Width")
cat("dump:", image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('magick for image writes do not include previous', ['functions-with-global-side-effects']),
		shell, `
library(magick)
plot(1:10)
img <- image_graph(width=300,height=600)
plot(1:10)
cat("dump:", image_write(img, format="jpg"))
		`, ['6@cat'], `
library(magick)
img <- image_graph(width=300,height=600)
plot(1:10)
cat("dump:", image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('magick for image writes without lib', ['functions-with-global-side-effects']),
		shell, `
img <- magick::image_graph(width=300,height=600)
plot(1:10)
cat("dump:", magick::image_write(img, format="jpg"))
		`, ['4@cat'], `
img <- magick::image_graph(width=300,height=600)
plot(1:10)
cat("dump:", magick::image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('magick for image writes with add', ['functions-with-global-side-effects']),
		shell, `
img <- magick::image_graph(width=300,height=600)
plot(1:10)
curve(dnorm(x, mean=5, sd=2), add=TRUE)
cat("dump:", magick::image_write(img, format="jpg"))
		`, ['5@cat'], `
img <- magick::image_graph(width=300,height=600)
plot(1:10)
curve(dnorm(x, mean=5, sd=2), add=TRUE)
cat("dump:", magick::image_write(img, format="jpg"))
		`.trim());
	assertSliced(label('labeller force', ['functions-with-global-side-effects', 'call-normal']),
		shell, `
data <- 1 : 10
f <- function(a, b) return(data[a])
img <- magick::image_graph(width=300,height=600)
ggplot() + facet_grid(x, labeller = f)
cat("dump:", magick::image_write(img, format="jpg"))
		`, ['6@cat'], `
data <- 1 : 10
f <- function(a, b) return(data[a])
img <- magick::image_graph(width=300,height=600)
ggplot() + facet_grid(x, labeller = f)
cat("dump:", magick::image_write(img, format="jpg"))
		`.trim());
}));
