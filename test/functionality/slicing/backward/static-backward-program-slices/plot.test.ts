import { assertSliced, assertSliceKeeps, assumeLoadedPackages, withShell } from '../../../_helper/shell';
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
			assertSliced(label(name, ['functions-with-global-side-effects', 'graphics-state', 'call-normal', 'named-arguments', 'newlines']), shell, code, [criterion], expected);
		}
		// @signature graphics-state
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
		graphicsCase('par within local', 'local({ par(mfrow=c(1,2)) })\nplot(1)', '2@plot', 'local({ par(mfrow=c(1,2)) })\nplot(1)');
		graphicsCase('par through do.call', 'do.call(par, list(mfrow=c(1,2)))\nplot(1)', '2@plot', 'do.call(par, list(mfrow=c(1,2)))\nplot(1)');
		graphicsCase('par through do.call does not affect values', 'do.call(par, list(mfrow=c(1,2)))\ny <- 2\nz <- y', '3@z', 'y <- 2\nz <- y');
		graphicsCase('restoring par on exit', 'f <- function() {\n\top <- par(mfrow=c(1,2))\n\ton.exit(par(op))\n\tplot(1)\n}\nf()\nplot(2)', '7@plot', 'f <- function() {\n        op <- par(mfrow=c(1,2))\n        on.exit(par(op))\n    }\nf()\nplot(2)');
		graphicsCase('functions we do not model read the graphics state', 'par(mar=c(1,1,1,1))\nheatmap(m)', '2@heatmap', 'par(mar=c(1,1,1,1))\nheatmap(m)');
		graphicsCase('palette query is no write', 'palette("Set 1")\npalette()\nplot(1)', '3@plot', 'palette("Set 1")\nplot(1)');
		/* the parameters belong to the device (checked against R): a new one starts afresh, closing it returns to another */
		graphicsCase('a new device starts afresh', 'par(mfrow=c(1,2))\npng("a.png")\nplot(1)', '3@plot', 'png("a.png")\nplot(1)');
		// @signature graphics-state
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
		/* a device holds what is drawn on it between its opening and its close, checked against R */
		graphicsCase('an addon reads the last plot only', 'plot(1)\nplot(2)\npoints(3)', '3@points', 'plot(2)\npoints(3)');
		graphicsCase('a plot does not depend on the one before', 'plot(1)\nplot(2)', '2@plot', 'plot(2)');
		graphicsCase('addons chain', 'plot(1)\nlines(2)\npoints(3)', '3@points', 'plot(1)\nlines(2)\npoints(3)');
		graphicsCase('add = TRUE adds to the plot', 'plot(1)\ncurve(sin, add=TRUE)', '2@curve', 'plot(1)\ncurve(sin, add=TRUE)');
		graphicsCase('curve starts a new plot otherwise', 'plot(1)\ncurve(sin)', '2@curve', 'curve(sin)');
		graphicsCase('a close keeps every page of its device', 'png("p%d.png")\nplot(1)\nplot(2)\ndev.off()', '4@dev.off', 'png("p%d.png")\nplot(1)\nplot(2)\ndev.off()');
		graphicsCase('a printed close names the device active afterward', 'plot(0)\npng("a.png")\nplot(1)\ndev.off()', '4@dev.off', 'plot(0)\npng("a.png")\nplot(1)\ndev.off()');
		graphicsCase('a close of a device a plot opened', 'x <- 1\nhist(x)\ndev.off()', '3@dev.off', 'x <- 1\nhist(x)\ndev.off()');
		graphicsCase('an addon after closing a nested device', 'png("a.png")\nplot(1)\npdf("b.pdf")\nplot(2)\ndev.off()\npoints(3)', '6@points', 'png("a.png")\nplot(1)\npoints(3)');
		graphicsCase('an addon after switching devices', 'png("a.png")\nplot(1)\npng("b.png")\nplot(2)\ndev.set(2)\npoints(3)', '6@points', 'png("a.png")\nplot(1)\npng("b.png")\nplot(2)\ndev.set(2)\npoints(3)');
		graphicsCase('dev.next switches nothing', 'png("a.png")\nplot(1)\nd <- dev.next()\npoints(2)', '4@points', 'png("a.png")\nplot(1)\npoints(2)');
		graphicsCase('an addon after a plot in a function', 'f <- function() plot(1)\nf()\npoints(2)', '3@points', 'f <- function() plot(1)\nf()\npoints(2)');
		graphicsCase('a function plotting is no dependency of a later plot', 'f <- function() {\n\tpar(mfrow=c(1,2))\n\tplot(1)\n}\nf()\nplot(2)', '6@plot', 'f <- function() par(mfrow=c(1,2))\nf()\nplot(2)');
		graphicsCase('an addon after plots in a loop', 'for(i in 1:3) plot(i)\npoints(0)', '2@points', 'for(i in 1:3) plot(i)\npoints(0)');
		graphicsCase('an addon after a conditional close', 'png("a.png")\nplot(1)\nif(u) dev.off()\npoints(2)', '4@points', 'png("a.png")\nplot(1)\nif(u) dev.off()\npoints(2)');
		graphicsCase('an addon after a conditional device', 'plot(0)\nif(u) png("a.png")\npoints(1)', '3@points', 'plot(0)\nif(u) png("a.png")\npoints(1)');
		graphicsCase('exporting a device keeps what is drawn on it', 'img <- magick::image_graph()\nplot(1)\nlines(2)\nr <- magick::image_write(img, "a.png")', '4@r', 'img <- magick::image_graph()\nplot(1)\nlines(2)\nr <- magick::image_write(img, "a.png")');
		graphicsCase('ggplot draws on the device', 'library(ggplot2)\npng("a.png")\nggplot(d) + geom_point()\ndev.off()', '4@dev.off', 'library(ggplot2)\npng("a.png")\nggplot(d) + geom_point()\ndev.off()');
		/* a ggplot is a value, R draws it where it is printed (checked against R) */
		graphicsCase('a ggplot printed later', 'library(ggplot2)\np <- ggplot(d) + geom_point()\nx <- 1\npng("a.png")\nprint(p)\ndev.off()', '6@dev.off', 'library(ggplot2)\np <- ggplot(d) + geom_point()\npng("a.png")\nprint(p)\ndev.off()');
		graphicsCase('a ggplot auto-printed later', 'library(ggplot2)\np <- ggplot(d)\npng("a.png")\np\ndev.off()', '5@dev.off', 'library(ggplot2)\np <- ggplot(d)\npng("a.png")\np\ndev.off()');
		graphicsCase('a ggplot built before draws nothing on the device', 'library(ggplot2)\npng("a.png")\np <- ggplot(d)\nplot(1)\ndev.off()', '5@dev.off', 'png("a.png")\nplot(1)\ndev.off()');
		graphicsCase('par opens the device its close writes', 'par(mfrow=c(1,2))\ndev.off()', '2@dev.off', 'par(mfrow=c(1,2))\ndev.off()');
		graphicsCase('ggplot ignores par', 'library(ggplot2)\npar(mfrow=c(1,2))\np <- ggplot(d)', '3@p', 'library(ggplot2)\np <- ggplot(d)');
	});
	/* programs where an earlier slice ran differently in R than the whole program, each slice checked against R */
	describe('counterexamples', () => {
		function counterexample(name: string, code: string, criterion: SlicingCriterion, expected: string) {
			assertSliced(label(name, ['functions-with-global-side-effects', 'graphics-state', 'call-normal', 'newlines']), shell, code, [criterion], expected);
		}
		counterexample('B6-plot-window', 'png("a.png", type="cairo")\nplot.new()\nplot.window(c(0,10), c(0,10))\nlines(c(1,5), c(1,5))\ndev.off()', '5@dev.off', 'png("a.png", type="cairo")\nplot.new()\nplot.window(c(0,10), c(0,10))\nlines(c(1,5), c(1,5))\ndev.off()');
		counterexample('B7b-dev-off-value', 'png("a.png", type="cairo")\npng("b.png", type="cairo")\nx <- dev.off()', '3@x', 'png("a.png", type="cairo")\npng("b.png", type="cairo")\nx <- dev.off()');
		counterexample('B7d-dev-off-which', 'png("a.png", type="cairo")\nplot(1:3)\npng("b.png", type="cairo")\ndev.off(2)', '4@dev.off', 'png("a.png", type="cairo")\nplot(1:3)\npng("b.png", type="cairo")\ndev.off(2)');
		counterexample('B7c-dev-copy', 'pdf(NULL)\nplot(1:3)\ndev.copy(png, "b.png", type="cairo")\ndev.off()\ndev.off()', '5@dev.off', 'pdf(NULL)\nplot(1:3)\ndev.off()');
		counterexample('B8-sink-stack', 'sink("o.txt")\nsink("p.txt")\nsink()\nprint(3)\nsink()\nx <- readLines("o.txt")', '6@x', 'sink("o.txt")\nsink("p.txt")\nsink()\nprint(3)\nsink()\nx <- readLines("o.txt")');
		counterexample('B9-capture-output', 'sink("a.txt")\ny <- capture.output(print(1))\nsink()\nx <- readLines("a.txt")', '4@x', 'sink("a.txt")\nsink()\nx <- readLines("a.txt")');
		counterexample('B10-textconn-sink', 'tc <- textConnection("out", "w", local=TRUE)\nsink(tc)\nprint(1)\nsink()\nx <- textConnectionValue(tc)', '5@x', 'tc <- textConnection("out", "w", local=TRUE)\nsink(tc)\nprint(1)\nsink()\nx <- textConnectionValue(tc)');
		counterexample('B10b-pushback', 'tc <- textConnection("a\\nb")\npushBack("z", tc)\nx <- readLines(tc, 1)', '3@x', 'tc <- textConnection("a\\nb")\npushBack("z", tc)\nx <- readLines(tc, 1)');
		counterexample('B11-sink-number', 'sink(tempfile())\nx <- sink.number()', '2@x', 'sink(tempfile())\nx <- sink.number()');
		counterexample('B12-strwidth', 'pdf(NULL)\nplot(1:10)\nw <- strwidth("abc")', '3@w', 'pdf(NULL)\nplot(1:10)\nw <- strwidth("abc")');
		counterexample('B12b-grid', 'library(grid)\npng("a.png", type="cairo")\ngrid.rect()\ndev.off()', '4@dev.off', 'library(grid)\npng("a.png", type="cairo")\ngrid.rect()\ndev.off()');
		counterexample('B12c-ggplot-last-plot', 'library(ggplot2)\np <- ggplot(data.frame(x=1:3,y=1:3), aes(x,y)) + geom_point()\nq <- p + geom_line()\nggsave("a.png", width=3, height=3, device="png", type="cairo")', '4@ggsave', 'library(ggplot2)\np <- ggplot(data.frame(x=1:3,y=1:3), aes(x,y)) + geom_point()\nq <- p + geom_line()\nggsave("a.png", width=3, height=3, device="png", type="cairo")');
		counterexample('B12d-file-mode', 'writeLines("a", "f.txt")\nx <- file.mode("f.txt")', '2@x', 'writeLines("a", "f.txt")\nx <- file.mode("f.txt")');
		counterexample('R2-B1-s3-print-method', 'print.foo <- function(x, ...) { cat("<foo>\\n"); 1 }\nsink("o.txt")\nprint(structure(1, class="foo"))\nsink()', '4@sink', 'print.foo <- function(x, ...) {\n        cat("<foo>\\n")\n        1\n    }\nsink("o.txt")\nprint(structure(1, class="foo"))\nsink()');
		counterexample('R2-B1b-s3-plot-method', 'plot.foo <- function(x, ...) { plot(1:3); NULL }\npng("a.png", type="cairo")\nplot(structure(1, class="foo"))\ndev.off()', '4@dev.off', 'plot.foo <- function(x, ...) {\n        plot(1:3)\n        NULL\n    }\npng("a.png", type="cairo")\nplot(structure(1, class="foo"))\ndev.off()');
		counterexample('R2-B1c-s3-print-result-used', 'print.foo <- function(x, ...) { if(TRUE) cat("<foo>\\n"); invisible(x) }\nsink("o.txt")\nr <- print(structure(1, class="foo"))\nsink()', '4@sink', 'print.foo <- function(x, ...) {\n        cat("<foo>\\n")\n        invisible(x)\n    }\nsink("o.txt")\nr <- print(structure(1, class="foo"))\nsink()');
		counterexample('R2-B2-message-sink', 'con <- file("o.txt", "w")\nsink(con, type="message")\nmessage("hi")\nsink(type="message")\nclose(con)', '5@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\nmessage("hi")\nsink(type="message")\nclose(con)');
		counterexample('R2-B2b-message-sink-warning', 'con <- file("o.txt", "w")\nsink(con, type="message")\nwarning("hi")\nsink(type="message")\nclose(con)', '5@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\nwarning("hi")\nsink(type="message")\nclose(con)');
		counterexample('R2-B3-sink-type-output-closer', 'sink("o.txt")\ncat("a\\n")\nsink(type="output")', '3@sink', 'sink("o.txt")\ncat("a\\n")\nsink(type="output")');
		counterexample('R2-B4-cat-append', 'cat("a\\n", file="o.txt")\ncat("b\\n", file="o.txt", append=TRUE)', '2@cat', 'cat("a\\n", file="o.txt")\ncat("b\\n", file="o.txt", append=TRUE)');
		counterexample('R2-B4b-write-append', 'write("a", file="o.txt")\nwrite("b", file="o.txt", append=TRUE)', '2@write', 'write("a", file="o.txt")\nwrite("b", file="o.txt", append=TRUE)');
		counterexample('R2-B4c-cat-no-append', 'cat("a\\n", file="o.txt")\ncat("b\\n", file="o.txt")', '2@cat', 'cat("b\\n", file="o.txt")');
		counterexample('R2-B5-invisible-sapply-print', 'sink("o.txt")\ninvisible(sapply(1:2, print))\nsink()', '3@sink', 'sink("o.txt")\ninvisible(sapply(1:2, print))\nsink()');
		counterexample('R2-paste-reads-scipen', 'options(scipen=-9)\ny <- 1\nx <- paste(100000)', '3@x', 'options(scipen=-9)\nx <- paste(100000)');
		counterexample('R2-col2rgb-reads-palette', 'palette(c("red", "blue"))\nx <- col2rgb(2)', '2@x', 'palette(c("red", "blue"))\nx <- col2rgb(2)');
		counterexample('R2-timezone-reads-tz', 'Sys.setenv(TZ="Asia/Tokyo")\nSys.setenv(A="1")\nx <- Sys.timezone()', '3@x', 'Sys.setenv(TZ="Asia/Tokyo")\nx <- Sys.timezone()');
		counterexample('B12e-umask', 'Sys.umask("077")\nwriteLines("a", "f.txt")\nx <- file.mode("f.txt")', '3@x', 'Sys.umask("077")\nwriteLines("a", "f.txt")\nx <- file.mode("f.txt")');
		counterexample('R3-B1-capture-closure', 'f <- function() { cat("a\\n"); 1 }\ny <- 2\nx <- capture.output(f())', '3@x', 'f <- function() {\n        cat("a\\n")\n        1\n    }\nx <- capture.output(f())');
		counterexample('R3-B1b-capture-block', 'x <- capture.output({ cat("a\\n"); cat("b\\n") })', '1@x', 'x <- capture.output({ cat("a\\n"); cat("b\\n") })');
		counterexample('R3-B1c-capture-assign', 'f <- function() { cat("a\\n"); 1 }\nx <- capture.output(r <- f())', '2@x', 'f <- function() {\n        cat("a\\n")\n        1\n    }\nx <- capture.output(r <- f())');
		counterexample('R3-B2-cat-stderr', 'con <- file("o.txt", "w")\nsink(con, type="message")\ncat("to stderr\\n", file=stderr())\nsink(type="message")\nclose(con)', '5@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\ncat("to stderr\\n", file=stderr())\nsink(type="message")\nclose(con)');
		counterexample('R3-B3-promise-seed', 'f <- function(code) { set.seed(3); code }\ny <- f(runif(1))', '2@y', 'f <- function(code) {\n        set.seed(3)\n        code\n    }\ny <- f(runif(1))');
		counterexample('R3-B3b-promise-default', 'f <- function(v = runif(1)) { set.seed(3); v }\ny <- f()', '2@y', 'f <- function(v=runif(1)) {\n        set.seed(3)\n        v\n    }\ny <- f()');
		counterexample('R3-B3c-promise-options', 'f <- function(code) { options(digits=3); code }\ny <- f(format(pi))', '2@y', 'f <- function(code) {\n        options(digits=3)\n        code\n    }\ny <- f(format(pi))');
		counterexample('R3-B4-prettynum-digits', 'options(digits=3)\nx <- prettyNum(123456.789)', '2@x', 'options(digits=3)\nx <- prettyNum(123456.789)');
		counterexample('R3-B5-suppress-messages', 'con <- file("o.txt", "w")\nsink(con, type="message")\nsuppressMessages(message("hidden"))\nmessage("seen")\nsink(type="message")\nclose(con)', '6@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\nsuppressMessages(message("hidden"))\nmessage("seen")\nsink(type="message")\nclose(con)');
		counterexample('R3-B6-try-not-silent', 'con <- file("o.txt", "w")\nsink(con, type="message")\ntry(stop("oops"), silent=FALSE)\nsink(type="message")\nclose(con)', '5@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\ntry(stop("oops"), silent=FALSE)\nsink(type="message")\nclose(con)');
		counterexample('R3-B7-muffling-handler', 'con <- file("o.txt", "w")\nsink(con, type="message")\noptions(warn=1)\nwithCallingHandlers({ warning("w1"); message("m") }, warning=function(w) invokeRestart("muffleWarning"))\nsink(type="message")\nclose(con)', '6@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\noptions(warn=1)\nwithCallingHandlers({ warning("w1"); message("m") }, warning=function(w) invokeRestart("muffleWarning"))\nsink(type="message")\nclose(con)');
		counterexample('R3-B8-restart-message', 'con <- file("o.txt", "w")\nsink(con, type="message")\nwithRestarts(invokeRestart("myR", 5), myR=function(v) message("restart ", v))\nsink(type="message")\nclose(con)', '5@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\nwithRestarts(invokeRestart("myR", 5), myR=function(v) message("restart ", v))\nsink(type="message")\nclose(con)');
		counterexample('R3-B9-package-startup-message', 'con <- file("o.txt", "w")\nsink(con, type="message")\npackageStartupMessage("psm")\nsink(type="message")\nclose(con)', '5@close', 'con <- file("o.txt", "w")\nsink(con, type="message")\npackageStartupMessage("psm")\nsink(type="message")\nclose(con)');
		counterexample('R3-assigned-visible-closure', 'f <- function() { cat("a\\n"); 1 }\nsink("o.txt")\nr <- f()\nsink()', '4@sink', 'f <- function() {\n        cat("a\\n")\n        1\n    }\nsink("o.txt")\nr <- f()\nsink()');
		counterexample('R4-B1-delayed-options', 'delayedAssign("z", format(pi))\noptions(digits=4)\nwriteLines(z, "o.txt")', '3@writeLines', 'delayedAssign("z", format(pi))\noptions(digits=4)\nwriteLines(z, "o.txt")');
		counterexample('R4-B1b-delayed-env', 'delayedAssign("z", Sys.getenv("QQ"))\nSys.setenv(QQ="1")\nwriteLines(z, "o.txt")', '3@writeLines', 'delayedAssign("z", Sys.getenv("QQ"))\nSys.setenv(QQ="1")\nwriteLines(z, "o.txt")');
		counterexample('R4-B1c-delayed-forced-first', 'delayedAssign("z", format(pi))\nz\noptions(digits=4)\nwriteLines(z, "o.txt")', '4@writeLines', 'delayedAssign("z", format(pi))\nz\noptions(digits=4)\nwriteLines(z, "o.txt")');
		counterexample('R4-B2-capture-autoprint-method', 'print.foo <- function(x, ...) { cat("<foo>\\n"); invisible(x) }\nx <- capture.output(structure(1, class = "foo"))', '2@x', 'print.foo <- function(x, ...) {\n        cat("<foo>\\n")\n        invisible(x)\n    }\nx <- capture.output(structure(1, class = "foo"))');
		counterexample('R4-B2b-capture-autoprint-block', 'print.foo <- function(x, ...) { cat("<foo>\\n"); invisible(x) }\nx <- capture.output({ print(1); structure(1, class = "foo") })', '2@x', 'print.foo <- function(x, ...) {\n        cat("<foo>\\n")\n        invisible(x)\n    }\nx <- capture.output({ print(1); structure(1, class = "foo") })');
		counterexample('R4-B2c-capture-autoprint-options', 'options(digits=3)\nx <- capture.output(pi)', '2@x', 'options(digits=3)\nx <- capture.output(pi)');
		counterexample('R4-B3-capture-split', 'sink("o.txt")\nx <- capture.output(cat("a\\n"), split = TRUE)\nsink()', '3@sink', 'sink("o.txt")\nx <- capture.output(cat("a\\n"), split = TRUE)\nsink()');
		counterexample('R4-B4-geterrmessage-try', 'r <- try(stop("e1"), silent = TRUE)\nm <- geterrmessage()', '2@m', 'r <- try(stop("e1"), silent = TRUE)\nm <- geterrmessage()');
		counterexample('R4-B4b-geterrmessage-trycatch', 'tryCatch(log("a"), error = function(e) 1)\nm <- geterrmessage()', '2@m', 'tryCatch(log("a"), error = function(e) 1)\nm <- geterrmessage()');
		counterexample('R4-B5-nested-suppress', 'con <- file("o.txt", "w")\nsink(con, type = "message")\nsuppressMessages(suppressWarnings({ message("a"); warning("w") }))\nmessage("visible")\nsink(type = "message")\nclose(con)', '6@close', 'con <- file("o.txt", "w")\nsink(con, type = "message")\nsuppressMessages(suppressWarnings({ message("a"); warning("w") }))\nmessage("visible")\nsink(type = "message")\nclose(con)');
		counterexample('R4-B6-function-literal', 'sink("o.txt")\nfunction(x) x\nsink()', '3@sink', 'sink("o.txt")\nfunction(x) x\nsink()');
		counterexample('R4-B6b-eval-quote', 'sink("o.txt")\neval(quote(5))\nsink()', '3@sink', 'sink("o.txt")\neval(quote(5))\nsink()');
		counterexample('R4-B7-else-value', 'sink("o.txt")\nif(FALSE) 1 else 2\nsink()', '3@sink', 'sink("o.txt")\nif(FALSE) { } else 2\nsink()');
		counterexample('R4-B7b-else-if-value', 'sink("o.txt")\nif(FALSE) 1 else if(FALSE) 2 else sum(1, 2)\nsink()', '3@sink', 'sink("o.txt")\nif(FALSE) { } else if(FALSE) { } else sum(1, 2)\nsink()');
		counterexample('R4-B8-print-closure', 'f <- function() 1\nsink("o.txt")\nprint(f)\nsink()', '4@sink', 'f <- function() 1\nsink("o.txt")\nprint(f)\nsink()');
		counterexample('R4-B8b-autoprint-closure', 'sink("o.txt")\nf <- function(x) { y <- x + 1; y }\nf\nsink()', '4@sink', 'sink("o.txt")\nf <- function(x) {\n        y <- x + 1\n        y\n    }\nf\nsink()');
		counterexample('R5-B1-custom-class-handler', 'sink("o.txt")\ntryCatch(stop(errorCondition("m", class = "my")), my = function(e) cat("my\\n"))\nsink()', '3@sink', 'sink("o.txt")\ntryCatch(stop(errorCondition("m", class = "my")), my = function(e) cat("my\\n"))\nsink()');
		counterexample('R5-B1b-custom-class-caught', 'x <- 1\ntryCatch({ stop(errorCondition("m", class = "my")); x <- 2 }, my = function(e) NULL)\ny <- x', '3@y', 'x <- 1\ny <- x');
		counterexample('R5-B1c-custom-class-calling', 'sink("o.txt")\ntry(withCallingHandlers(stop(errorCondition("m", class = "my")), my = function(e) cat("h\\n")), silent = TRUE)\nsink()', '3@sink', 'sink("o.txt")\ntry(withCallingHandlers(stop(errorCondition("m", class = "my")), my = function(e) cat("h\\n")), silent = TRUE)\nsink()');
		counterexample('R5-B2-restart-jumps', 'n <- 0\nwithRestarts({ n <- 1; invokeRestart("r"); n <- 2 }, r = function() NULL)\ny <- n', '3@y', 'n <- 0\nn <- 1\ny <- n');
		counterexample('R5-B2b-restart-in-body', 'n <- 0\nf <- function() { invokeRestart("r"); n <<- 2 }\nwithRestarts(f(), r = function() NULL)\ny <- n', '4@y', 'n <- 0\ny <- n');
		counterexample('R5-B3-try-kept-unused', 'e <- new.env()\ne$a <- 1\nlockBinding("a", e)\nr <- try(e$a <- 2, silent = TRUE)\ny <- e$a', '5@y', 'e <- new.env()\ne$a <- 1\nlockBinding("a", e)\nr <- try(e$a <- 2, silent = TRUE)\ny <- e$a');
		counterexample('R5-B3b-trycatch-kept-unused', 'sink("o.txt")\nr <- tryCatch(cat(log("a")), error = function(e) NULL)\ncat("x\\n")\nsink()', '4@sink', 'sink("o.txt")\nr <- tryCatch(cat(log("a")), error = function(e) NULL)\ncat("x\\n")\nsink()');
		counterexample('R5-B4-raising-builtin-maybe', 'x <- 1\ntryCatch(x <- log("a"), error = function(e) NULL)\ny <- x', '3@y', 'x <- 1\ntryCatch(x <- log("a"), error = function(e) NULL)\ny <- x');
		counterexample('R5-B4b-earlier-raise', 'x <- 1\ntry({ z <- 1 + "a"; x <- 2 }, silent = TRUE)\ny <- x', '3@y', 'x <- 1\ntry({\n    1 + "a"\n    x <- 2\n}, silent = TRUE)\ny <- x');
		counterexample('R5-B5-forced-by-assign', 'sink("o.txt")\ndelayedAssign("p", { cat("forced\\n"); 1 })\nx <- p\nsink()', '4@sink', 'sink("o.txt")\ndelayedAssign("p", { cat("forced\\n"); 1 })\nx <- p\nsink()');
		counterexample('R5-B5b-forced-by-call', 'sink("o.txt")\ndelayedAssign("p", { cat("forced\\n"); 1 })\nf <- function(a) a\nx <- f(p)\nsink()', '5@sink', 'sink("o.txt")\ndelayedAssign("p", { cat("forced\\n"); 1 })\nf <- function(a) a\nx <- f(p)\nsink()');
		counterexample('R5-B6-forced-in-body', 'sink("o.txt")\ndelayedAssign("p", cat("forced\\n"))\nf <- function() { y <- p; 2 }\nr <- f()\nsink()', '5@sink', 'sink("o.txt")\ndelayedAssign("p", cat("forced\\n"))\nf <- function() {\n        p\n        2\n    }\nr <- f()\nsink()');
		counterexample('R5-B6b-forced-in-env', 'sink("o.txt")\ne <- new.env()\ndelayedAssign("p", cat("forced\\n"), assign.env = e)\nx <- e$p\nsink()', '5@sink', 'sink("o.txt")\ne <- new.env()\ndelayedAssign("p", cat("forced\\n"), assign.env = e)\nx <- e$p\nsink()');
		counterexample('R6-B1-warning-exits', 'x <- 0\ntryCatch({ x <- 1; warning("m"); x <- 2 }, warning = function(c) NULL)\ny <- x', '3@y', 'x <- 0\ntryCatch({ x <- 1; warning("m"); x <- 2 }, warning = function(c) NULL)\ny <- x');
		counterexample('R6-B1b-message-exits', 'x <- 0\ntryCatch({ x <- 1; message("m"); x <- 2 }, message = function(c) NULL)\ny <- x', '3@y', 'x <- 0\ntryCatch({ x <- 1; message("m"); x <- 2 }, message = function(c) NULL)\ny <- x');
		counterexample('R6-B1c-signal-in-function', 'x <- 0\ng <- function() signalCondition(structure(class = c("my", "condition"), list(message = "m", call = NULL)))\ntryCatch({ x <- 1; g(); x <- 2 }, my = function(c) NULL)\ny <- x', '4@y', 'x <- 0\ng <- function() signalCondition(structure(class = c("my", "condition"), list(message = "m", call = NULL)))\ntryCatch({ x <- 1; g(); x <- 2 }, my = function(c) NULL)\ny <- x');
		counterexample('R6-B2-promise-in-body', 'sink("o.txt")\nf <- function() { delayedAssign("p", { cat("P\\n"); 1 }); p }\nx <- f()\nsink()', '4@sink', 'sink("o.txt")\nf <- function() {\n        delayedAssign("p", { cat("P\\n"); 1 })\n        p\n    }\nx <- f()\nsink()');
		counterexample('R6-B2b-promise-unused-read', 'delayedAssign("x", { options(digits = 3); 1 })\ny <- x\nz <- format(pi)', '3@z', 'delayedAssign("x", { options(digits = 3); 1 })\ny <- x\nz <- format(pi)');
		counterexample('R6-B3-promise-eval-env', 'e <- new.env()\ndelayedAssign("v", { cat("V\\n"); 3 }, assign.env = e)\nr <- eval(quote(v), e)', '3@r', 'e <- new.env()\ndelayedAssign("v", { 3 }, assign.env = e)\nr <- eval(quote(v), e)');
		counterexample('R6-B4-active-env-access', 'sink("o.txt")\ne <- new.env()\nmakeActiveBinding("ab", function() { cat("R\\n"); 1 }, e)\nx <- e$ab\nsink()', '5@sink', 'sink("o.txt")\ne <- new.env()\nmakeActiveBinding("ab", function() { cat("R\\n"); 1 }, e)\nx <- e$ab\nsink()');
		counterexample('R6-B4b-active-as-list', 'sink("o.txt")\ne <- new.env()\nmakeActiveBinding("ab", function() { cat("R\\n"); 1 }, e)\ny <- as.list(e)\nsink()', '5@sink', 'sink("o.txt")\ne <- new.env()\nmakeActiveBinding("ab", function() { cat("R\\n"); 1 }, e)\ny <- as.list(e)\nsink()');
		counterexample('R6-B4c-active-setter', 'sink("o.txt")\nmakeActiveBinding("ab", function(v) { if(!missing(v)) cat("set", v, "\\n"); 1 }, environment())\nab <- 2\nsink()', '4@sink', 'sink("o.txt")\nmakeActiveBinding("ab", function(v) { if(!missing(v)) cat("set", v, "\\n"); 1 }, environment())\nab <- 2\nsink()');
		counterexample('R6-B5-lock-binding-reads', 'x <- 1\nlockBinding("x", environment())\nr <- tryCatch({ x <- 2; "no" }, error = function(e) "locked")', '3@r', 'x <- 1\nlockBinding("x", environment())\nr <- tryCatch({ x <- 2; "no" }, error = function(e) "locked")');
		counterexample('R6-B5b-active-binding-regular', 'x <- 1\nr <- tryCatch({ makeActiveBinding("x", function() 2, environment()); "made" }, error = function(e) "regular")', '2@r', 'x <- 1\nr <- tryCatch({ makeActiveBinding("x", function() 2, environment()); "made" }, error = function(e) "regular")');
		counterexample('R6-B6-handler-of-dropped-call', 'f <- function() { tryCatch(return(1), error = function(e) 2); 3 }\ny <- f()', '2@y', 'f <- function() return(1)\ny <- f()');
		counterexample('R7-B1-protected-stop-in-lambda', 'f <- function() stop("a")\ny <- 5\nr <- sapply(1:2, function(i) tryCatch(f(), error = function(e) 0))\nprint(y)', '4@print', 'y <- 5\nprint(y)');
		counterexample('R7-B1b-try-in-lapply', 'f <- function() stop("a")\ny <- 5\nr <- lapply(1:2, function(i) try(f(), silent = TRUE))\nprint(y)', '4@print', 'y <- 5\nprint(y)');
		counterexample('R7-B2-super-before-raise', 'x <- 1\nf <- function() { x <<- 2; c(1)[[2]]; x <<- 3 }\ntryCatch(f(), error = function(e) NULL)\nprint(x)', '4@print', 'x <- 1\nf <- function() {\n        x <<- 2\n        c(1)[[2]]\n        x <<- 3\n    }\ntryCatch(f(), error = function(e) NULL)\nprint(x)');
		counterexample('R7-B3-warn-in-function', 'f <- function() { options(warn = 2); on.exit(options(warn = 0)); as.integer("a"); 1 }\nr <- tryCatch(f(), error = function(e) 2)\nprint(r)', '3@print', 'f <- function() {\n        options(warn = 2)\n        on.exit(options(warn = 0))\n        as.integer("a")\n        1\n    }\nr <- tryCatch(f(), error = function(e) 2)\nprint(r)');
		counterexample('R7-B4-if-na-raises', 'r <- tryCatch({ if(NA) 1; 5 }, error = function(e) 7)\nprint(r)', '2@print', 'r <- tryCatch({ if(NA) 1; 5 }, error = function(e) 7)\nprint(r)');
		counterexample('R7-B5-active-through-parameter', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nf <- function(env) { env$a; 1 }\nf(e)\nprint(n)', '6@print', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nf <- function(env) env$a\nf(e)\nprint(n)');
		counterexample('R7-B6-active-body-reads', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\ny <- e$a\nprint(n)', '5@print', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\ny <- e$a\nprint(n)');
		counterexample('R7-B7-active-evalq', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nevalq(a, e)\nprint(n)', '5@print', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nevalq(a, e)\nprint(n)');
		counterexample('R7-B8-active-setter-dollar', 'v <- 0\ne <- new.env()\nmakeActiveBinding("s", function(x) { if(!missing(x)) v <<- x; v }, e)\nassign("s", 4, envir = e)\ne$s <- 8\nprint(v)', '6@print', 'v <- 0\ne <- new.env()\nmakeActiveBinding("s", function(x) { if(!missing(x)) v <<- x; v }, e)\nassign("s", 4, envir = e)\ne$s <- 8\nprint(v)');
		counterexample('R7-B9-sys-frame-caller', 'f <- function() { y <- 3; g(); y }\ng <- function() { e <- sys.frame(-1); e$y <- 4 }\nprint(f())', '3@print', 'f <- function() {\n        y <- 3\n        g()\n        y\n    }\ng <- function() {\n        e <- sys.frame(-1)\n        e$y <- 4\n    }\nprint(f())');
		counterexample('R7-B10-active-read-no-autoprint', 'sink("o.txt")\nn <- 0\nmakeActiveBinding("ab", function() { n <<- n + 1; n }, globalenv())\ny <- ab + 1\nprint(n)\nsink()', '6@sink', 'sink("o.txt")\nn <- 0\nmakeActiveBinding("ab", function() { n <<- n + 1; n }, globalenv())\ny <- ab + 1\nprint(n)\nsink()');
		counterexample('R8-B1-raise-in-applied-lambda-caught', 'f <- function() stop("a")\nr <- tryCatch(sapply(1:2, function(i) f()), error = function(e) -1)\nprint(r)', '3@print', 'f <- function() stop("a")\nr <- tryCatch(sapply(1:2, function(i) f()), error = function(e) -1)\nprint(r)');
		counterexample('R8-B2-next-method-autoprint', 'sink("o.txt")\nprint.foo <- function(x, ...) { cat("foo\\n"); invisible(x) }\nprint.bar <- function(x, ...) { cat("bar\\n"); NextMethod() }\no <- structure(1, class = c("bar", "foo"))\no\nsink()', '6@sink', 'sink("o.txt")\nprint.foo <- function(x, ...) {\n        cat("foo\\n")\n        invisible(x)\n    }\nprint.bar <- function(x, ...) {\n        cat("bar\\n")\n        NextMethod()\n    }\no <- structure(1, class = c("bar", "foo"))\no\nsink()');
		counterexample('R8-B3-builtin-generic-method-effect', 'sink("o.txt")\nlength.foo <- function(x) { cat("len\\n"); 2L }\no <- structure(list(), class = "foo")\ny <- length(o)\nsink()', '5@sink', 'sink("o.txt")\nlength.foo <- function(x) {\n        cat("len\\n")\n        2L\n    }\no <- structure(list(), class = "foo")\ny <- length(o)\nsink()');
		counterexample('R8-B3b-dollar-method-effect', 'sink("o.txt")\n"$.foo" <- function(x, name) { cat("get", name, "\\n"); 1 }\no <- structure(list(), class = "foo")\ny <- o$a\nsink()', '5@sink', 'sink("o.txt")\n"$.foo" <- function(x, name) {\n        cat("get", name, "\\n")\n        1\n    }\no <- structure(list(), class = "foo")\ny <- o$a\nsink()');
		counterexample('R8-B4-s4-initialize-effect', 'sink("o.txt")\nsetClass("Q", representation(v = "numeric"))\nsetMethod("initialize", "Q", function(.Object, ...) { cat("init\\n"); callNextMethod(.Object, ...) })\nq <- new("Q", v = 1)\nsink()', '5@sink', 'sink("o.txt")\nsetClass("Q", representation(v = "numeric"))\nsetMethod("initialize", "Q", function(.Object, ...) { cat("init\\n"); callNextMethod(.Object, ...) })\nq <- new("Q", v = 1)\nsink()');
		counterexample('R8-B5-local-envir-session-state', 'e <- new.env()\nlocal(options(digits = 3), envir = e)\nprint(pi)', '3@print', 'e <- new.env()\nlocal(options(digits = 3), envir = e)\nprint(pi)');
		counterexample('R8-B6-sys-frame-sys-parent', 'g <- function() assign("y", 4, envir = sys.frame(sys.parent()))\nf <- function() { y <- 3; g(); y }\nprint(f())', '3@print', 'g <- function() assign("y", 4, envir = sys.frame(sys.parent()))\nf <- function() {\n        y <- 3\n        g()\n        y\n    }\nprint(f())');
		counterexample('R8-B7-parent-frame-default', 'g <- function(env = parent.frame()) assign("y", 4, envir = env)\nf <- function() { y <- 3; g(); y }\nprint(f())', '3@print', 'g <- function(env=parent.frame()) assign("y", 4, envir = env)\nf <- function() {\n        y <- 3\n        g()\n        y\n    }\nprint(f())');
		counterexample('R8-B8-get-caller-frame', 'g <- function() get("y", envir = parent.frame())\nf <- function() { y <- 3; g() }\nprint(f())', '3@print', 'g <- function() get("y", envir = parent.frame())\nf <- function() {\n        y <- 3\n        g()\n    }\nprint(f())');
		counterexample('R8-B9-active-read-in-callee', 'n <- 0\nmakeActiveBinding("ab", function() { n <<- n + 1; n }, globalenv())\nf <- function() ab\ninvisible(f())\nprint(n)', '5@print', 'n <- 0\nmakeActiveBinding("ab", function() { n <<- n + 1; n }, globalenv())\nf <- function() ab\ninvisible(f())\nprint(n)');
		counterexample('R8-B9b-active-read-in-lambda', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nr <- sapply(1:3, function(i) e$a)\nprint(n)', '5@print', 'e <- new.env()\nn <- 0\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nr <- sapply(1:3, function(i) e$a)\nprint(n)');
		counterexample('R8-B10-active-setter-by-callee', 'v <- 0\ne <- new.env()\nmakeActiveBinding("s", function(x) { if(!missing(x)) v <<- x; v }, e)\nset <- function(env, val) assign("s", val, envir = env)\nset(e, 3)\nprint(v)', '6@print', 'v <- 0\ne <- new.env()\nmakeActiveBinding("s", function(x) { if(!missing(x)) v <<- x; v }, e)\nset <- function(env, val) assign("s", val, envir = env)\nset(e, 3)\nprint(v)');
		counterexample('R8-B11-state-after-nested-call', 'g <- function() options(digits = 3)\nf <- function() { g(); print(pi) }\nf()', '3@f', 'g <- function() options(digits = 3)\nf <- function() {\n        g()\n        print(pi)\n    }\nf()');
		counterexample('R8-B12-active-binding-in-own-frame', 'mk <- function() { e <- environment(); makeActiveBinding("a", function() { cat("A\\n"); 1 }, e); function() a }\ng <- mk()\ninvisible(g())\nx <- g()', '4@g', 'mk <- function() {\n        e <- environment()\n        makeActiveBinding("a", function() { cat("A\\n"); 1 }, e)\n        function() a\n    }\ng <- mk()\ng()');
		counterexample('R9-B1-enclosing-frame-counter', 'make <- function() { n <- 0; function() { e <- parent.env(environment()); e$n <- e$n + 1; e$n } }\ncnt <- make()\ncnt()\nprint(cnt())', '4@print', 'make <- function() {\n        n <- 0\n        function() {\n            e <- parent.env(environment())\n            e$n <- e$n + 1\n            e$n\n        }\n    }\ncnt <- make()\ncnt()\nprint(cnt())');
		counterexample('R9-B1b-sys-function-frame-read', 'make <- function() { n <- 4; function() { e <- environment(sys.function()); e[["n"]] * 2 } }\ng <- make()\nprint(g())', '3@print', 'make <- function() {\n        n <- 4\n        function() {\n            e <- environment(sys.function())\n            e[["n"]] * 2\n        }\n    }\ng <- make()\nprint(g())');
		counterexample('R9-B2-sys-frame-zero-global', 'y <- 5\nf <- function() { e <- sys.frame(0); e$y <- 8; 1 }\ninvisible(f())\nprint(y)', '4@print', 'f <- function() {\n        e <- sys.frame(0)\n        e$y <- 8\n        1\n    }\ninvisible(f())\nprint(y)');
		counterexample('R9-B3-write-through-unknown-env', 'make <- function() { n <- 0; f <- function() { e <- environment(f); e$n <- e$n + 1; n }; f }\ncnt <- make()\ncnt()\nprint(cnt())', '4@print', 'make <- function() {\n        n <- 0\n        f <- function() {\n                e <- environment(f)\n                e$n <- e$n + 1\n                n\n            }\n        f\n    }\ncnt <- make()\ncnt()\nprint(cnt())');
		counterexample('R9-B4-rm-in-enclosing-frame', 'make <- function() { n <- 4; function() { rm("n", envir = parent.env(environment())); exists("n", envir = parent.env(environment()), inherits = FALSE) } }\ng <- make()\nprint(g())', '3@print', 'make <- function() {\n        n <- 4\n        function() {\n            rm("n", envir = parent.env(environment()))\n            exists("n", envir = parent.env(environment()), inherits = FALSE)\n        }\n    }\ng <- make()\nprint(g())');
		counterexample('R9-B5-unknown-effect-in-later-callee', 'f <- function() { y <- 3; g(); y }\ng <- function() { fr <- sys.frames(); assign("y", 11, envir = fr[[length(fr) - 1]]) }\nprint(f())', '3@print', 'f <- function() {\n        y <- 3\n        g()\n        y\n    }\ng <- function() {\n        fr <- sys.frames()\n        assign("y", 11, envir = fr[[length(fr) - 1]])\n    }\nprint(f())');
		counterexample('R9-B6-enclosing-frame-in-lambda', 'make <- function() { n <- 0; function(k) { e <- parent.env(environment()); invisible(sapply(seq_len(k), function(i) e$n <- e$n + i)); e$n } }\ng <- make()\nprint(g(3))', '3@print', 'make <- function() {\n        n <- 0\n        function(k) {\n            e <- parent.env(environment())\n            invisible(sapply(seq_len(k), function(i) e$n <- e$n + i))\n            e$n\n        }\n    }\ng <- make()\nprint(g(3))');
		counterexample('R9-B7-nrow-dispatches-dim', 'calls <- 0\ndim.dm <- function(x) { calls <<- calls + 1; c(1L, 1L) }\no <- structure(list(), class = "dm")\nnr <- nrow(o)\nprint(calls)', '5@print', 'calls <- 0\ndim.dm <- function(x) {\n        calls <<- calls + 1\n        c(1L, 1L)\n    }\no <- structure(list(), class = "dm")\nnr <- nrow(o)\nprint(calls)');
		counterexample('R9-B8-subset-of-function-list-applied', 'h <- function() options(digits = 3)\nfs <- list(h)\ninvisible(lapply(fs[1], function(f) f()))\nprint(pi)', '4@print', 'h <- function() options(digits = 3)\nfs <- list(h)\ninvisible(lapply(fs[1], function(f) f()))\nprint(pi)');
		counterexample('R9-B9-active-binding-callee-of-callee', 'n <- 0\ne <- new.env()\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nrd <- function() e$a\nf <- function() rd()\ninvisible(f())\nprint(n)', '7@print', 'n <- 0\ne <- new.env()\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nrd <- function() e$a\nf <- function() rd()\ninvisible(f())\nprint(n)');
		counterexample('R9-B10-active-binding-callee-in-lambda', 'n <- 0\ne <- new.env()\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nrd <- function(en) en$a\nr <- sapply(1:2, function(i) rd(e))\nprint(n)', '6@print', 'n <- 0\ne <- new.env()\nmakeActiveBinding("a", function() { n <<- n + 1; n }, e)\nrd <- function(en) en$a\nr <- sapply(1:2, function(i) rd(e))\nprint(n)');
		counterexample('R9-B11-rm-ls-all-prefix', 'x <- 3\nrm(list = ls(all = TRUE))\nprint(exists("x"))', '3@print', 'print(exists("x"))');
		counterexample('R9-B12-global-field-write-in-function', 'y <- 5\nf <- function() { e <- globalenv(); e$y <- 8; 1 }\ninvisible(f())\nprint(y)', '4@print', 'f <- function() {\n        e <- globalenv()\n        e$y <- 8\n        1\n    }\ninvisible(f())\nprint(y)');
		counterexample('R10-B1-list2env-literal-method', 'invisible(list2env(list(length.cnt = function(x) { options(digits = 3); 5L }), envir = globalenv()))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)', '4@print', 'invisible(list2env(list(length.cnt = function(x) { options(digits = 3); 5L }), envir = globalenv()))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)');
		counterexample('R10-B2-list2env-computed-method', 'm <- list(function(x) { options(digits = 3); 5L })\nnames(m) <- "length.cnt"\ninvisible(list2env(m, globalenv()))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)', '6@print', 'm <- list(function(x) { options(digits = 3); 5L })\nnames(m) <- "length.cnt"\ninvisible(list2env(m, globalenv()))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)');
		counterexample('R10-B2b-source-of-unknown-file-method', 'writeLines("Ops.cnt <- function(e1, e2) { options(digits = 3); TRUE }", "m.R")\nfor(f in list.files(pattern = "^m[.]R$")) source(f)\no <- structure(1, class = "cnt")\ns <- o == 1\nprint(pi)', '5@print', 'writeLines("Ops.cnt <- function(e1, e2) { options(digits = 3); TRUE }", "m.R")\nfor(f in list.files(pattern = "^m[.]R$")) source(f)\no <- structure(1, class = "cnt")\ns <- o == 1\nprint(pi)');
		counterexample('R10-B2c-do-call-assign-method', 'do.call("assign", list("length.cnt", function(x) { options(digits = 3); 5L }))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)', '4@print', 'do.call("assign", list("length.cnt", function(x) { options(digits = 3); 5L }))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)');
		counterexample('R10-B3-environment-of-top-closure', 'h <- function() NULL\nenvironment(h)$dd <- 3\noptions(digits = dd)\nprint(pi)', '4@print', 'h <- function() NULL\nenvironment(h)$dd <- 3\noptions(digits = dd)\nprint(pi)');
		counterexample('R10-B3b-assign-into-environment-of-fn', 'h <- function() NULL\nassign("length.cnt", function(x) { options(digits = 3); 5L }, envir = environment(h))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)', '5@print', 'h <- function() { }\nassign("length.cnt", function(x) { options(digits = 3); 5L }, envir = environment(h))\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)');
		counterexample('R10-B4-active-binding-method', 'makeActiveBinding("length.cnt", function() function(x) { options(digits = 3); 5L }, globalenv())\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)', '4@print', 'makeActiveBinding("length.cnt", function() function(x) { options(digits = 3); 5L }, globalenv())\no <- structure(list(), class = "cnt")\nn <- length(o)\nprint(pi)');
		counterexample('R10-B5-median-runs-xtfrm', 'xtfrm.k <- function(x) { options(digits = 3); as.numeric(unclass(x)) }\no <- structure(c(3, 1, 2), class = "k")\ns <- median(o)\nprint(pi)', '4@print', 'xtfrm.k <- function(x) {\n        options(digits = 3)\n        as.numeric(unclass(x))\n    }\no <- structure(c(3, 1, 2), class = "k")\ns <- median(o)\nprint(pi)');
		counterexample('R10-B5b-message-runs-condition-method', 'conditionMessage.myc <- function(c) { options(digits = 3); "m" }\ncnd <- structure(class = c("myc", "condition"), list(message = "x", call = NULL))\nmessage(cnd)\nprint(pi)', '4@print', 'conditionMessage.myc <- function(c) {\n        options(digits = 3)\n        "m"\n    }\ncnd <- structure(class = c("myc", "condition"), list(message = "x", call = NULL))\nmessage(cnd)\nprint(pi)');
		counterexample('R10-B5c-lapply-runs-as-list', 'as.list.k <- function(x, ...) { options(digits = 3); list(1) }\no <- structure(1, class = "k")\ns <- lapply(o, identity)\nprint(pi)', '4@print', 'as.list.k <- function(x, ...) {\n        options(digits = 3)\n        list(1)\n    }\no <- structure(1, class = "k")\ns <- lapply(o, identity)\nprint(pi)');
		counterexample('R10-B5d-head-runs-subset', '`[.k` <- function(x, i, ...) { options(digits = 3); unclass(x)[i] }\no <- structure(c(3, 1, 2), class = "k")\ns <- head(o, 1)\nprint(pi)', '4@print', '`[.k` <- function(x, i, ...) {\n        options(digits = 3)\n        unclass(x)[i]\n    }\no <- structure(c(3, 1, 2), class = "k")\ns <- head(o, 1)\nprint(pi)');
		counterexample('R10-B6-summary-group-of-any', 'Summary.cs <- function(..., na.rm = FALSE) { options(digits = 2); TRUE }\no <- structure(1, class = "cs")\ninvisible(any(o))\nprint(pi)', '4@print', 'Summary.cs <- function(..., na.rm=FALSE) {\n        options(digits = 2)\n        TRUE\n    }\no <- structure(1, class = "cs")\ninvisible(any(o))\nprint(pi)');
		counterexample('R10-B6b-unlist-own-method', 'unlist.k <- function(x, ...) { options(digits = 3); 1 }\no <- structure(1, class = "k")\ninvisible(unlist(o))\nprint(pi)', '4@print', 'unlist.k <- function(x, ...) {\n        options(digits = 3)\n        1\n    }\no <- structure(1, class = "k")\ninvisible(unlist(o))\nprint(pi)');
		counterexample('R10-B7-as-numeric-runs-as-double', 'as.double.lbl <- function(x, ...) { options(digits = 3); 1 }\no <- structure(1, class = "lbl")\ns <- as.numeric(o)\nprint(pi)', '4@print', 'as.double.lbl <- function(x, ...) {\n        options(digits = 3)\n        1\n    }\no <- structure(1, class = "lbl")\ns <- as.numeric(o)\nprint(pi)');
		counterexample('R10-B8-seq-along-runs-length', 'length.k <- function(x) { options(digits = 3); 3L }\no <- structure(list(), class = "k")\ns <- seq_along(o)\nprint(pi)', '4@print', 'length.k <- function(x) {\n        options(digits = 3)\n        3L\n    }\no <- structure(list(), class = "k")\ns <- seq_along(o)\nprint(pi)');
		counterexample('R10-B9-do-call-of-generic', 'format.cnt <- function(x, ...) { options(digits = 3); "c" }\ns <- do.call(format, list(structure(1, class = "cnt")))\nprint(pi)', '3@print', 'format.cnt <- function(x, ...) {\n        options(digits = 3)\n        "c"\n    }\ns <- do.call(format, list(structure(1, class = "cnt")))\nprint(pi)');
		counterexample('C-B1-dir-create-before-write', 'dir.create("d")\nwriteLines("a", "d/f.txt")', '2@writeLines', 'dir.create("d")\nwriteLines("a", "d/f.txt")');
		counterexample('C-B1b-setwd-into-created-dir', 'dir.create("d")\nwriteLines("a", "d/f.txt")\nsetwd("d")\nx <- readLines("f.txt")', '4@x', 'dir.create("d")\nwriteLines("a", "d/f.txt")\nsetwd("d")\nx <- readLines("f.txt")');
		counterexample('C-B2-file-remove-result', 'writeLines("abc", "f.txt")\nprint(file.remove("f.txt"))', '2@print', 'writeLines("abc", "f.txt")\nprint(file.remove("f.txt"))');
		counterexample('C-B3-autoprinted-dev-off', 'png("a.png")\npng("b.png")\ndev.off()', '3@dev.off', 'png("a.png")\npng("b.png")\ndev.off()');
		counterexample('C-B4-sink-opener-keeps-inputs', 'sink("o.txt")\nk <- 1\nf <- function() k\nprint(f())\nsink()', '1@sink', 'sink("o.txt")\nk <- 1\nf <- function() k\nprint(f())\nsink()');
		counterexample('C-B4b-sink-opener-keeps-binding-body', 'sink("o.txt")\nf <- function() { e <- new.env(); makeActiveBinding("ab", function() { cat("R"); 1 }, e); e$ab }\ny <- f()\nsink()', '1@sink', 'sink("o.txt")\nf <- function() {\n        e <- new.env()\n        makeActiveBinding("ab", function() { cat("R"); 1 }, e)\n        e$ab\n    }\ny <- f()\nsink()');
		counterexample('C-B7-on-exit-return-keeps-raise', 'f <- function(x) { on.exit(return(5)); stopifnot(is.numeric(x)); 1 }\nprint(f("a"))', '2@print', 'f <- function(x) {\n        on.exit(return(5))\n        stopifnot(is.numeric(x))\n    }\nprint(f("a"))');
		/* the call that may raise is an exit of the program */
		assertSliced(label('RA-B1-try-around-forced-promise', ['functions-with-global-side-effects', 'call-normal', 'newlines']), shell, 'g <- function(a) { r <- try(a, silent = TRUE); 1 }\ng(stop("lazy"))\nprint("alive")', ['3@print'], 'g <- function(a) {\n        try(a, silent = TRUE)\n        1\n    }\ng(stop("lazy"))\nprint("alive")', { cfgExcludeProperties: ['single-entry-and-exit'] });
		/* the call raises what its callee raises, so what follows depends on the call and not only on the stopifnot within */
		assertSliced(label('RA-B2-a-validating-call-stays', ['functions-with-global-side-effects', 'call-normal', 'newlines']), shell, 'validate <- function(x) { stopifnot(is.numeric(x), all(x >= 0)); invisible(TRUE) }\nvalidate(c(1, 2))\nprint("valid")', ['3@print'], 'validate <- function(x) {\n        stopifnot(is.numeric(x), all(x >= 0))\n        invisible(TRUE)\n    }\nvalidate(c(1, 2))\nprint("valid")', { cfgExcludeProperties: ['single-entry-and-exit'] });
		/* in R, `validate(c(-1, 2))` stops the program before the print */
		assertSliceKeeps('RA-B2b a validating call that raises stays', shell, 'validate <- function(x) { stopifnot(is.numeric(x), all(x >= 0)); invisible(TRUE) }\nvalidate(c(-1, 2))\nprint("valid")', '3@print', { kept: ['validate(c(-1, 2))', 'stopifnot(is.numeric(x), all(x >= 0))'] });
		counterexample('RA-B3-rm-reads-what-it-removes', 'mean <- function(x) stop("shadow")\nrm(mean)\nprint(mean(1:3))', '2@rm', 'mean <- function(x) { }\nrm(mean)');
		counterexample('RA-B3b-rm-of-a-variable', 'x <- 1\nrm(x)', '2@rm', 'x <- 1\nrm(x)');
		/* rm(list = <vector of names>) removes (and so reads) every one of the names */
		counterexample('SF-rm-list-vector-reads-defs', 'a <- 1\nb <- 2\nrm(list = c("a", "b"))', '3@rm', 'a <- 1\nb <- 2\nrm(list = c("a", "b"))');
		counterexample('SF-rm-list-vector-kills', 'a <- 1\nb <- 2\nrm(list = c("a", "b"))\nprint(exists("b"))', '4@print', 'print(exists("b"))');
		counterexample('SF-rm-list-variable-vector', 'nms <- c("a", "b")\na <- 1\nb <- 2\nrm(list = nms)\nprint(exists("b"))', '5@print', 'print(exists("b"))');
		/* quit() ends the program, so what follows it in the called function must not run in the slice */
		counterexample('SF-quit-ends-program', 'f <- function() {\n  cat("live\\n")\n  quit(save = "no")\n  cat("dead\\n")\n}\nf()', '6@f', 'f <- function() {\n        cat("live\\n")\n        quit(save = "no")\n    }\nf()');
		assertSliced(label('SF-q-in-branch', ['functions-with-global-side-effects', 'call-normal', 'newlines']), shell, 'x <- 1\nif(x > 0) q()\ncat("after\\n")', ['3@cat'], 'x <- 1\nif(x > 0) q()\ncat("after\\n")', { cfgExcludeProperties: ['single-entry-and-exit'] });
	});
}));
