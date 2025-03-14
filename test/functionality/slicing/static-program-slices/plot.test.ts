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
}));
