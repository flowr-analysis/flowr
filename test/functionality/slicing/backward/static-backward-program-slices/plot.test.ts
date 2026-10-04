import { assertSliced, assumeLoadedPackages, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import type { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';

assumeLoadedPackages('ggplot2', 'magick');

describe('visualizations', { concurrent: false }, withShell(shell => {
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
	describe('graphics state', () => {
		function graphicsCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
			assertSliced(label(name, ['functions-with-global-side-effects', 'call-normal', 'named-arguments', 'newlines']), shell, code, [criterion], expected);
		}
		graphicsCase('par affects later plots', 'par(mfrow=c(1,2))\ny <- 3\nplot(y)', '3@plot', 'par(mfrow=c(1,2))\ny <- 3\nplot(y)');
		graphicsCase('par does not affect values', 'x <- 1\npar(mar=c(1,1,1,1))\ny <- x', '3@y', 'x <- 1\ny <- x');
		graphicsCase('par does not affect printing', 'par(mfrow=c(1,2))\ny <- 3\nprint(y)', '3@print', 'y <- 3\nprint(y)');
		graphicsCase('par settings accumulate', 'par(mfrow=c(1,2))\npar(mar=c(1,1,1,1))\nplot(1)', '3@plot', 'par(mfrow=c(1,2))\npar(mar=c(1,1,1,1))\nplot(1)');
		graphicsCase('par after the plot does not matter', 'plot(1)\npar(mfrow=c(1,2))', '1@plot', 'plot(1)');
		graphicsCase('plot addons read the state', 'plot(1)\npar(xpd=TRUE)\nlegend("top", "a")', '3@legend', 'plot(1)\npar(xpd=TRUE)\nlegend("top", "a")');
		graphicsCase('layout and palette', 'layout(matrix(1:2, 1))\npalette("Set 1")\nx <- 2\nhist(x)', '4@hist', 'layout(matrix(1:2, 1))\npalette("Set 1")\nx <- 2\nhist(x)');
		graphicsCase('querying par is no write', 'par(mfrow=c(1,2))\nm <- par("mar")\nplot(1)', '3@plot', 'par(mfrow=c(1,2))\nplot(1)');
		graphicsCase('querying par reads the state', 'par(mar=c(1,1,1,1))\nx <- 2\nm <- par("mar")', '3@m', 'par(mar=c(1,1,1,1))\nm <- par("mar")');
		graphicsCase('querying par reads the last plot', 'plot(1:10)\nx <- 2\nu <- par("usr")', '3@u', 'plot(1:10)\nu <- par("usr")');
		graphicsCase('restoring par', 'op <- par(mfrow=c(1,2))\nplot(1)\npar(op)\nplot(2)', '4@plot', 'op <- par(mfrow=c(1,2))\npar(op)\nplot(2)');
		graphicsCase('par within a function', 'f <- function() par(mfrow=c(1,2))\nf()\nplot(1)', '3@plot', 'f <- function() par(mfrow=c(1,2))\nf()\nplot(1)');
		graphicsCase('plot within a function', 'g <- function() plot(1)\npar(mfrow=c(1,2))\nx <- 2\ng()', '4@g', 'g <- function() plot(1)\npar(mfrow=c(1,2))\ng()');
		graphicsCase('par within an uncalled function', 'f <- function() par(mfrow=c(1,2))\nplot(1)', '2@plot', 'plot(1)');
		graphicsCase('conditional par', 'if(u) par(mfrow=c(1,2))\nplot(1)', '2@plot', 'if(u) par(mfrow=c(1,2))\nplot(1)');
		graphicsCase('par in a loop', 'for(i in 1:2) {\n\tplot(i)\n\tpar(mfrow=c(i,2))\n}', '2@plot', 'for(i in 1:2) {\n    plot(i)\n    par(mfrow=c(i,2))\n}');
		graphicsCase('par between definition and call of a function setting par', 'par(mar=c(1,1,1,1))\nf <- function() par(mfrow=c(1,2))\npar(cex=2)\nf()\nplot(1)', '5@plot', 'par(mar=c(1,1,1,1))\nf <- function() par(mfrow=c(1,2))\npar(cex=2)\nf()\nplot(1)');
		graphicsCase('par within local', 'local({ par(mfrow=c(1,2)) })\nplot(1)', '2@plot', 'par(mfrow=c(1,2))\nplot(1)');
		graphicsCase('par through do.call', 'do.call(par, list(mfrow=c(1,2)))\nplot(1)', '2@plot', 'do.call(par, list(mfrow=c(1,2)))\nplot(1)');
		graphicsCase('par through do.call does not affect values', 'do.call(par, list(mfrow=c(1,2)))\ny <- 2\nz <- y', '3@z', 'y <- 2\nz <- y');
		graphicsCase('restoring par on exit', 'f <- function() {\n\top <- par(mfrow=c(1,2))\n\ton.exit(par(op))\n\tplot(1)\n}\nf()\nplot(2)', '7@plot', 'f <- function() {\n        op <- par(mfrow=c(1,2))\n        on.exit(par(op))\n    }\nf()\nplot(2)');
		graphicsCase('functions we do not model read the graphics state', 'par(mar=c(1,1,1,1))\nheatmap(m)', '2@heatmap', 'par(mar=c(1,1,1,1))\nheatmap(m)');
		graphicsCase('palette query is no write', 'palette("Set 1")\npalette()\nplot(1)', '3@plot', 'palette("Set 1")\nplot(1)');
		/* the parameters belong to the device (checked against R): a new one starts afresh, closing it returns to another */
		graphicsCase('a new device starts afresh', 'par(mfrow=c(1,2))\npng("a.png")\nplot(1)', '3@plot', 'png("a.png")\nplot(1)');
		graphicsCase('closing returns to the previous device', 'par(mfrow=c(1,2))\npng("a.png")\npar(mar=c(1,1,1,1))\ndev.off()\nplot(1)', '5@plot', 'par(mfrow=c(1,2))\nplot(1)');
		graphicsCase('closing the only device', 'png("a.png")\npar(mar=c(1,1,1,1))\ndev.off()\nplot(1)', '4@plot', 'plot(1)');
		graphicsCase('closing all devices', 'par(mfrow=c(1,2))\npng("a.png")\ngraphics.off()\nplot(1)', '4@plot', 'plot(1)');
		graphicsCase('closing another device keeps the active one', 'png("a.png")\npar(mar=c(1,1,1,1))\ndev.off(3)\nplot(1)', '4@plot', 'png("a.png")\npar(mar=c(1,1,1,1))\ndev.off(3)\nplot(1)');
		graphicsCase('switching devices', 'par(mfrow=c(1,2))\npng("a.png")\ndev.set(2)\nplot(1)', '4@plot', 'par(mfrow=c(1,2))\npng("a.png")\ndev.set(2)\nplot(1)');
		graphicsCase('a device opened in a function', 'f <- function() png("a.png")\npar(mfrow=c(1,2))\nf()\nplot(1)', '4@plot', 'f <- function() png("a.png")\npar(mfrow=c(1,2))\nf()\nplot(1)');
		graphicsCase('a conditional close', 'par(mfrow=c(1,2))\npng("a.png")\nif(u) dev.off()\nplot(1)', '4@plot', 'par(mfrow=c(1,2))\npng("a.png")\nif(u) dev.off()\nplot(1)');
		graphicsCase('a conditional device', 'par(mfrow=c(1,2))\nif(u) png("a.png")\nplot(1)', '3@plot', 'par(mfrow=c(1,2))\nif(u) png("a.png")\nplot(1)');
		graphicsCase('the palette survives a new device', 'palette("R3")\npng("a.png")\nplot(1)', '3@plot', 'palette("R3")\npng("a.png")\nplot(1)');
		graphicsCase('evaluating a quoted par', 'eval(quote(par(mfrow=c(1,2))))\nplot(1)', '2@plot', 'eval(quote(par(mfrow=c(1,2))))\nplot(1)');
		graphicsCase('with_par sets the parameters for its code', 'library(withr)\nwith_par(list(mfrow=c(3,1)), plot(1))', '2@with_par', 'library(withr)\nwith_par(list(mfrow=c(3,1)), plot(1))');
		graphicsCase('with_png draws on a fresh device', 'par(mfrow=c(1,2))\nlibrary(withr)\nwith_png("a.png", plot(1))', '3@with_png', 'library(withr)\nwith_png("a.png", plot(1))');
		graphicsCase('with_png closes its device', 'par(mfrow=c(1,2))\nlibrary(withr)\nwith_png("a.png", plot(1))\nplot(2)', '4@plot', 'par(mfrow=c(1,2))\nplot(2)');
		graphicsCase('par through an alias', 'p <- par\np(mfrow=c(1,2))\nplot(1)', '3@plot', 'p <- par\np(mfrow=c(1,2))\nplot(1)');
		graphicsCase('a device through an alias', 'd <- png\nd("a.png")\nplot(1)', '3@plot', 'd <- png\nd("a.png")\nplot(1)');
		/* a plot after the close opens a fresh device, R draws nothing of it on the closed one */
		graphicsCase('a plot after closing the last device', 'png("a.png")\ndev.off()\nplot(1)', '3@plot', 'plot(1)');
		/* a device kept in the slice keeps its close, or it would catch what is drawn afterward */
		graphicsCase('a device needs its close', 'png("a.png")\nplot(1)\ndev.off()\nplot(2)', '2@plot', 'png("a.png")\nplot(1)\ndev.off()');
		graphicsCase('rm(list = ls()) keeps the graphics state', 'par(mfrow=c(1,2))\nrm(list=ls())\nplot(1)', '3@plot', 'par(mfrow=c(1,2))\nplot(1)');
		graphicsCase('with_par restores what it set', 'par(mar=c(1,1,1,1))\nlibrary(withr)\nwith_par(list(mfrow=c(2,1)), plot(1))\nplot(2)', '4@plot', 'par(mar=c(1,1,1,1))\nplot(2)');
		graphicsCase('with_par keeps what its code set', 'library(withr)\nwith_par(list(mfrow=c(2,1)), par(mar=c(1,1,1,1)))\nplot(2)', '3@plot', 'library(withr)\nwith_par(list(mfrow=c(2,1)), par(mar=c(1,1,1,1)))\nplot(2)');
		graphicsCase('ggplot ignores par', 'library(ggplot2)\npar(mfrow=c(1,2))\np <- ggplot(d)', '3@p', 'library(ggplot2)\np <- ggplot(d)');
	});
}));
