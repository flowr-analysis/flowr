/**
 * The kind of project that flowR is analyzing.
 *
 * This lives in its own module as the configuration refers to it (see `FlowrConfig.specializeConfig`) and the
 * files context, which classifies it, pulls in the config itself.
 * @module
 */

/** The kind of project that flowR is analyzing, see {@link FlowrAnalyzerFilesContext#projectKind}. */
export enum ProjectKind {
	/** An R package (has a `DESCRIPTION` file that does not mark it as a {@link ProjectKind.ShinyApp}). */
	Package  = 'package',
	/** A single R script. */
	Script   = 'script',
	/** A Shiny application (`Type: shiny` in the `DESCRIPTION`, `app.R`, or `ui.R` with `server.R`). */
	ShinyApp = 'shiny-app',
	/** A notebook or literate document (`.ipynb`, `.Rmd`, `.qmd`, `.rnw`). */
	Notebook = 'notebook',
	/** A multi-file project that is not a package. */
	Project  = 'project',
	/** The kind could not be determined (e.g. before the files are known). */
	Unknown  = 'unknown'
}
