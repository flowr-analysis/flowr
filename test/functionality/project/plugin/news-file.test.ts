import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { defaultConfigOptions } from '../../../../src/config';
import {
	FlowrAnalyzerNewsFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-news-file-plugin';
import type { NewsChunk } from '../../../../src/project/plugins/file-plugins/files/flowr-news-file';


describe('NEWS-file', function() {
	const ctx = new FlowrAnalyzerContext(
		defaultConfigOptions,
		arraysGroupBy([
			new FlowrAnalyzerNewsFilePlugin()
		], p => p.type)
	);

	ctx.addFile(new FlowrInlineTextFile('NEWS', `
# ggplot2 (development version)

* The \`arrow\` and \`arrow.fill\` arguments are now available in 
  \`geom_linerange()\` and \`geom_pointrange()\` layers (@teunbrand, #6481).
* (internal) \`zeroGrob()\` now returns a \`grid::nullGrob()\` (#6390).
* \`stat_ydensity()\` now only requires the \`x\` or \`y\` aesthetic. The other will
  be populated with 0, similar to \`stat_boxplot()\` (@teunbrand, #6600)
* Implemented \`as.list()\` and \`S7::convert()\` methods for lists and classes in ggplot2 
  (@teunbrand, #6695)
* The default linetype in \`geom_sf()\` is derived from \`geom_polygon()\` for 
  polygons and from \`geom_line()\` for (multi)linestrings (@teunbrand, #6543).
* Using infinite \`radius\` aesthetic in \`geom_spoke()\` now throws a warning 
  (#6671)
* Scales and guides specified by a string can now use package name prefixes to
  indicate a namespace wherein to look for the scale/guide. For example, one can
  use \`scale_x_continuous(guide = "legendry::axis_base")\` (@teunbrand, #4705).
* \`get_layer_data()\` and \`get_layer_grob()\` now accept layer names as index 
  (@lgaborini, #6724)
* Added new argument \`geom_curve(shape)\` that will be passed down to 
  \`grid::curveGrob()\` (@fmarotta, #5998).
* Fixed a regression where default \`width\` was miscalculated when some panels
  are empty (@teunbrand, #6758)
* \`geom_hex()\` has a new \`radius\` aesthetic, representing the relative size of
  the hexagons (@teunbrand, #6727)
* Added \`preserve\` argument to \`position_jitterdodge()\` (@teunbrand, #6584).
* Fixed \`position_jitterdodge(jitter.height, jitter.width)\` applying to the 
  wrong dimension with flipped geoms (@teunbrand, #6535).
* New \`position_dodge2(group.row)\` argument that can be set to \`"many"\` to
  dodge groups with more than one row, such as in \`geom_violin()\` 
  (@teunbrand, #6663)

# ggplot2 4.0.1

This is a smaller patch release focussed on fixing regressions from 4.0.0 and 
polishing the recent features.

## Bug fixes

* Fixed regression where \`geom_area()\` didn't draw panels with single groups 
  when \`stat = "align"\` (@teunbrand, #6680)
* Fixed regression where \`position_stack(vjust)\` was ignored when there are
  only single groups (#6692)
* Fixed bug where \`NA\` handling in \`geom_path()\` was ignoring panels (@teunbrand, #6533)
* Fixed bug where \`stat_bin(boundary)\` was ignored (#6682).
* \`geom_text()\` and \`geom_label()\` accept expressions as the \`label\` aesthetic 
  (@teunbrand, #6638)
* Fixed regression where \`draw_key_rect()\` stopped using \`fill\` colours 
  (@mitchelloharawild, #6609).
* Fixed regression where \`scale_{x,y}_*()\` threw an error when an expression
  object is set to \`labels\` argument (@yutannihilation, #6617).
* Fixed regression where the first (unnamed) argument to colour/fill scales was 
  not passed as the \`name\` argument (@teunbrand, #6623)
* Fixed issue where vectorised \`arrow()\`s caused errors in drawing the 
  legend glyphs (@teunbrand, #6594)
* Fixed regression where \`NULL\`-aesthetics contributed to plot labels too 
  insistently. Now they contribute only as fallback labels (@teunbrand, #6616)
* Fixed regression where empty arguments to colour/fill scale caused errors
  (@jmbarbone, #6710)
* Fixed axis misplacement in \`coor_radial()\` when labels are blank (@teunbrand, #6574)

## Improvements

* Improved palette fallback mechanism in scales (@teunbrand, #6669).
* Allow \`stat\` in \`geom_hline\`, \`geom_vline\`, and \`geom_abline\`. (@sierrajohnson, #6559)
* \`stat_boxplot()\` treats \`width\` as an optional aesthetic (@Yunuuuu, #6575)
* The \`theme(panel.widths, panel.heights)\` setting attempts to preserve the
  plot's aspect ratio when only one of the two settings is given, and the plot 
  has a single panel (@teunbrand, #6701).
* Logical values for the linetype aesthetic will be interpreted numerically,
  so that \`linetype = FALSE\` becomes 0/'blank' and \`linetype = TRUE\` becomes 
  1/'solid' (@teunbrand, #6641)
* Out-of-bounds datapoints used as padding by \`stat_align()\` now get removed
  silently rather than verbosely (@teunbrand, #6667)

# ggplot2 4.0.0

## User facing

### Breaking changes

* The S3 parts of ggplot2 have been replaced with S7 bits (#6352).
* (breaking) \`geom_violin(quantiles)\` now has actual quantiles based on
  the data, rather than inferred quantiles based on the computed density. The
  \`quantiles\` parameter that replaces \`draw_quantiles\` now belongs to
  \`stat_ydensity()\` instead of \`geom_violin()\` (@teunbrand, #4120).
* (Breaking) The defaults for all geoms can be set at one in the theme.
  (@teunbrand based on pioneering work by @dpseidel, #2239)
    * A new \`theme(geom)\` argument is used to track these defaults.
    * The \`element_geom()\` function can be used to populate that argument.
    * The \`from_theme()\` function allows access to the theme default fields from
      inside the \`aes()\` function.
* Moved the following packages in the description. If your package depended on 
  ggplot2 to install these dependencies, you may need to list these in your 
  own DESCRIPTION file now (#5986).
    * Moved mgcv from Imports to Suggests
    * Moved tibble from Imports to Suggests
    * Removed glue dependency
* Default labels are derived in \`build_ggplot()\` (previously \`ggplot_build()\`) 
  rather than in the layer method of \`update_ggplot()\` 
  (previously \`ggplot_add.Layer()\`). This may affect code that accessed the 
  \`plot$labels\` property (@teunbrand, #5894).
* In binning stats, the default \`boundary\` is now chosen to better adhere to
  the \`nbin\` argument. This may affect plots that use default binning
  (@teunbrand, #5882, #5036)

### Lifecycle changes

* Deprecated functions and arguments prior to ggplot2 3.0.0 throw errors instead
  of warnings.
* Functions and arguments that were soft-deprecated up to ggplot2 3.4.0 now
  throw warnings.
* \`annotation_borders()\` replaces the now-deprecated \`borders()\` 
  (@teunbrand, #6392)
* Turned off fallback for \`size\` to \`linewidth\` translation in
  \`geom_bar()\`/\`geom_col()\` (#4848).
* The \`fatten\` argument has been deprecated in \`geom_boxplot()\`,
  \`geom_crossbar()\` and \`geom_pointrange()\` (@teunbrand, #4881).
* The following methods have been deprecated: \`fortify.lm()\`, \`fortify.glht()\`,
  \`fortify.confint.glht()\`, \`fortify.summary.glht()\` and \`fortify.cld()\`. It
  is recommend to use \`broom::augment()\` and \`broom::tidy()\` instead
  (@teunbrand, #3816).
* \`geom_errorbarh()\` is deprecated in favour of
  \`geom_errorbar(orientation = "y")\` (@teunbrand, #5961).
* Special getter and setter functions have been renamed for consistency, allowing
  for better tab-completion with \`get_*\`- and \`set_*\`-prefixes. The old names
  remain available for backward compatibility (@teunbrand, #5568).

  | New name             | Old name          |
  | -------------------- | ----------------- |
  | \`get_theme()\`        | \`theme_get()\`     |
  | \`set_theme()\`        | \`theme_set()\`     |
  | \`replace_theme()\`    | \`theme_replace()\` |
  | \`update_theme()\`     | \`theme_update()\`  |
  | \`get_last_plot()\`    | \`last_plot()\`     |
  | \`get_layer_data()\`   | \`layer_data()\`    |
  | \`get_layer_grob()\`   | \`layer_grob()\`    |
  | \`get_panel_scales()\` | \`layer_scales()\`  |
  
* \`facet_wrap()\` has new options for the \`dir\` argument for additional control
  over panel directions. They absorb interactions with the now-deprecated 
  \`as.table\` argument. Internally \`dir = "h"\` or \`dir = "v"\` is deprecated
  (@teunbrand, #5212).
* \`coord_trans()\` was renamed to \`coord_transform()\` (@nmercadeb, #5825).
  
### Improvements

#### Themes

* The \`theme()\` function offers new arguments:
    * \`geom\` to set defaults for layer aesthetics (#2239).
    * \`spacing\`/\`margins\` as root elements that are inherited by all other 
      spacings and (non-text) margins (@teunbrand, #5622).
    * \`palette.{aes}.discrete\` and \`palette.{aes}.continuous\` which determine
      the palettes used when scales have \`palette = NULL\`. This is the new
      default for generic scales like \`scale_colour_discrete()\` or 
      \`scale_fill_continuous()\`, see also the 'Scales' section (#4696).
    * \`panel.widths\` and \`panel.heights\` to control the (absolute) size of the
      panels (#5338, @teunbrand).
    * \`legend.key.justification\` to control the alignment of legend keys 
      (@teunbrand, #3669)
* Built-in \`theme_*()\` functions have new arguments:
    * \`ink\`/\`paper\`/\`accent\` to control foreground, background and highlight
    colours respectively of the whole plot (@teunbrand, #6063, @EvaMaeRey, #6438).
    * \`header_family\` to easily set the font for headers and titles (#5886)
        * To accommodate, \`plot.subtitle\`, \`plot.caption\` and \`plot.tag\` now
          inherit from the root \`text\` element instead of the \`title\` element.
* New function family for setting parts of a theme. For example, you can now use
  \`theme_sub_axis(line, text, ticks, ticks.length, line)\` as a substitute for
  \`theme(axis.line, axis.text, axis.ticks, axis.ticks.length, axis.line)\`. This
  should allow slightly terser and more organised theme declarations
  (@teunbrand, #5301).
* Adjustments to margins (#6115):
    * They can have NA-units, which indicate that the value should be inherited
      from the parent element.
    * New \`margin_part()\` function that comes pre-populated with NA-units, so
      you can change a single margin without worrying that the others look off.
    * New \`margin_auto()\` that recycles arguments in a CSS like fashion.
* The \`fill\` of the \`panel.border\` theme setting is ignored and forced to be
  transparent (#5782).
* \`theme_classic()\` has the following changes (@teunbrand, #5978 & #6320):
    * Axis ticks are now black (\`ink\`-coloured) instead of dark gray.
    * Axis line ends are now \`"square"\`.
    * The panel grid is now blank at the \`panel.grid\` hierarchy level instead of
    the \`panel.grid.major\` and \`panel.grid.minor\` levels.
* The \`theme(legend.spacing.{x/y})\` setting now accepts \`null\`-units 
  (@teunbrand, #6417).

#### Scales

* The default colour and fill scales have a new \`palette\` argument. The default, 
  \`palette = NULL\` will retrieve palettes from the theme (see the Themes section).
  This replaces the old options-based \`type\` system, with some limited backward 
  compatibility (@teunbrand, #6064).
* All scales now expose the \`aesthetics\` parameter (@teunbrand, #5841)
* All position scales now use the same definition of \`x\` and \`y\` aesthetics.
  This lets uncommon aesthetics like \`xintercept\` expand scales as usual.
  (#3342, #4966, @teunbrand)
* In continuous scales, when \`breaks\` is a function and \`n.breaks\` is set, the 
  \`n.breaks\` will be passed to the \`breaks\` function. Previously, \`n.breaks\` 
  only applied to the default break calculation (@teunbrand, #5972).
* Changes in discrete scales:
    * Added \`palette\` argument, which can be used to customise spacings between 
      levels (@teunbrand, #5770)
    * Added \`continuous.limits\` argument to control the display range
      (@teunbrand, #4174, #6259).
    * Added \`minor_breaks\` argument. This only makes sense in position scales,
      where it affects the placement of minor ticks and minor gridlines (#5434).
    * Added \`sec.axis\` argument. Discrete scales don't support transformations
      so it is recommended to use  \`dup_axis()\` to set custom breaks or labels.
      Secondary discrete axes work with the continuous analogues of discrete 
      breaks (@teunbrand, #3171)
    * When \`breaks\` yields a named vector, the names will be used as \`labels\`
      by default (@teunbrand, #6147).
* Changes in date/time scales:
    * <POSIXct> is silently cast to <Date> in date scales. Vice versa, <Date> 
      is cast to <POSIXct> in datetime scales (@laurabrianna, #3533)
    * Bare numeric provided to date or datetime scales get inversely transformed 
      (i.e. cast to <Date>/<POSIXct>) with a warning (@teunbrand)
    * The \`date_breaks\`, \`date_minor_breaks\` and \`date_labels\` arguments have
      been copied over to \`scale_{x/y}_time()\` (@teunbrand, #4335).
* More stability for vctrs-based palettes (@teunbrand, #6117).
* Scale names, guide titles and aesthetic labels can now accept functions
  (@teunbrand, #4313)

#### Coords

* Reversal of a dimension, typically 'x' or 'y', is now controlled by the
  \`reverse\` argument in \`coord_cartesian()\`, \`coord_fixed()\`, \`coord_radial()\`
  and \`coord_sf()\`. In \`coord_radial()\`, this replaces the older \`direction\`
  argument (#4021, @teunbrand).
* \`coord_*(expand)\` can now take a logical vector to control expansion at any
  side of the panel (top, right, bottom, left) (@teunbrand, #6020)
* New \`coord_cartesian(ratio)\` argument that absorbs the aspect ratio 
  functionality from \`coord_equal()\` and \`coord_fixed()\`, which are now 
  wrappers for \`coord_cartesian()\`.
* In non-orthogonal coordinate systems (\`coord_sf()\`, \`coord_polar()\` and
  \`coord_radial()\`), using 'AsIs' variables escape transformation when
  both \`x\` and \`y\` is an 'AsIs' variable (@teunbrand, #6205).
* Axis labels are now preserved better when using \`coord_sf(expand = TRUE)\` and
  graticule lines are straight but do not meet the edge (@teunbrand, #2985).
* \`coord_radial(clip = "on")\` clips to the panel area when the graphics device
  supports clipping paths (@teunbrand, #5952).
* \`coord_radial(r.axis.inside)\` can now take a numeric value to control
  placement of internally placed radius axes (@teunbrand, #5805).
* Munching in \`coord_polar()\` and \`coord_radial()\` now adds more detail,
  particularly for data-points with a low radius near the center
  (@teunbrand, #5023).

#### Layers

* Position adjustments can now have auxiliary aesthetics (@teunbrand).
    * \`position_nudge()\` gains \`nudge_x\` and \`nudge_y\` aesthetics (#3026, #5445).
    * \`position_dodge()\` gains \`order\` aesthetic (#3022, #3345)
* New \`stat_connect()\` to connect points via steps or other shapes
  (@teunbrand, #6228)
* New stat: \`stat_manual()\` for arbitrary computations (@teunbrand, #3501)
* \`geom_boxplot()\` gains additional arguments to style the colour, linetype and
  linewidths of the box, whiskers, median line and staples (@teunbrand, #5126).
* \`geom_violin()\` gains additional arguments to style the colour, linetype and
  linewidths of the quantiles, which replace the now-deprecated \`draw_quantiles\`
  argument (#5912).
* New parameters for \`geom_label()\` (@teunbrand and @steveharoz, #5365):
  * The \`linewidth\` aesthetic is now applied and replaces the \`label.size\`
    argument.
  * The \`linetype\` aesthetic is now applied.
  * New \`border.colour\` argument to set the colour of borders.
  * New \`text.colour\` argument to set the colour of text.
* New \`layer(layout)\` argument to interact with facets (@teunbrand, #3062)
* New default \`geom_qq_line(geom = "abline")\` for better clipping in the
  vertical direction. In addition, \`slope\` and \`intercept\` are new computed
  variables in \`stat_qq_line()\` (@teunbrand, #6087).
* \`stat_ecdf()\` now has an optional \`weight\` aesthetic (@teunbrand, #5058).
* \`stat_ellipse\` now has an optional \`weight\` (@teunbrand, #5272)
* \`stat_density()\` has the new computed variable: \`wdensity\`, which is
  calculated as the density times the sum of weights (@teunbrand, #4176).
  * \`linetype = NA\` is now interpreted to mean 'no line' instead of raising errors
  (@teunbrand, #6269).
* \`position_dodge()\` and \`position_jitterdodge()\` now have a \`reverse\` argument
  (@teunbrand, #3610)
* \`position_jitterdodge()\` now dodges by \`group\` (@teunbrand, #3656)
* \`geom_rect()\` can now derive the required corners positions from \`x\`/\`width\`
  or \`y\`/\`height\` parameterisation (@teunbrand, #5861).
* \`position_dodge(preserve = "single")\` now handles multi-row geoms better,
  such as \`geom_violin()\` (@teunbrand based on @clauswilke's work, #2801).
* \`geom_point()\` can be dodged vertically by using
  \`position_dodge(..., orientation = "y")\` (@teunbrand, #5809).
* The \`arrow.fill\` parameter is now applied to more line-based functions:
  \`geom_path()\`, \`geom_line()\`, \`geom_step()\` \`geom_function()\`, line
   geometries in \`geom_sf()\` and \`element_line()\`.
* \`geom_raster()\` now falls back to rendering as \`geom_rect()\` when coordinates
  are not linear (#5503).
* \`geom_ribbon()\` can have varying \`fill\` or \`alpha\` in linear coordinate
  systems (@teunbrand, #4690).
* Standardised the calculation of \`width\`, which are now implemented as
  aesthetics (@teunbrand, #2800, #3142, #5740, #3722).
* All binning stats now use the \`boundary\`/\`center\` parametrisation rather
  than \`origin\`, following in \`stat_bin()\`'s footsteps (@teunbrand).
* Reintroduced \`drop\` argument to \`stat_bin()\` (@teunbrand, #3449)
* \`stat_bin()\` now accepts functions for argument \`breaks\` (@aijordan, #4561)
* \`after_stat()\` and \`after_scale()\` throw warnings when the computed aesthetics
  are not of the correct length (#5901).
* \`geom_hline()\` and \`geom_vline()\` now have \`position\` argument
  (@yutannihilation, #4285).
* \`geom_contour()\` should be able to recognise a rotated grid of points
  (@teunbrand, #4320)

#### Other

* An attempt is made to use a variable's label attribute as default label
  (@teunbrand, #4631)
* \`guide_*()\` can now accept two inside legend theme elements:
  \`legend.position.inside\` and \`legend.justification.inside\`, allowing inside
  legends to be placed at different positions. Only inside legends with the same
  position and justification will be merged (@Yunuuuu, #6210).
* \`guide_bins()\`, \`guide_colourbar()\` and \`guide_coloursteps()\` gain an \`angle\`
  argument to overrule theme settings, similar to \`guide_axis(angle)\`
  (@teunbrand, #4594).
* New argument \`labs(dictionary)\` to label based on variable name rather than
  based on aesthetic (@teunbrand, #5178)
* The \`summary()\` method for ggplots is now more terse about facets
  (@teunbrand, #5989).
* \`facet_wrap()\` can have \`space = "free_x"\` with 1-row layouts and
  \`space = "free_y"\` with 1-column layouts (@teunbrand)
* Layers can have names (@teunbrand, #4066).
* Axis labels are now justified across facet panels (@teunbrand, #5820)
* \`facet_grid(space = "free")\` can now be combined with \`coord_fixed()\`
  (@teunbrand, #4584).
* The ellipsis argument is now checked in \`fortify()\`, \`get_alt_text()\`,
  \`labs()\` and several guides. (@teunbrand, #3196).
* \`ggsave()\` can write a multi-page pdf file when provided with a list of plots
  (@teunbrand, #5093).

### Bug fixes

* Fixed a bug where the \`guide_custom(order)\` wasn't working (@teunbrand, #6195)
* Fixed bug in \`guide_custom()\` that would throw error with \`theme_void()\`
  (@teunbrand, #5856).
* \`guide_colourbar()\` now correctly hands off \`position\` and \`available_aes\`
  parameters downstream (@teunbrand, #5930).
* \`guide_axis()\` no longer reserves space for blank ticks
  (@teunbrand, #4722, #6069).
* Fixed regression in axes where \`breaks = NULL\` caused the axes to disappear
  instead of just rendering the axis line (@teunbrand, #5816).
* Better handling of the \`guide_axis_logticks(negative.small)\` parameter when
  scale limits have small maximum (@teunbrand, #6121).
* Fixed regression in \`guide_bins(reverse = TRUE)\` (@teunbrand, #6183).  
* Binned guides now accept expressions as labels (@teunbrand, #6005)
* Fixed bug where binned scales wouldn't simultaneously accept transformations
  and function-limits (@teunbrand, #6144).
* Fixed bug in out-of-bounds binned breaks (@teunbrand, #6054)
* Fixed bug where binned guides would keep out-of-bounds breaks
  (@teunbrand, #5870)
* Binned scales with zero-width data expand the default limits by 0.1
  (@teunbrand, #5066)
* Date(time) scales now throw appropriate errors when \`date_breaks\`,
  \`date_minor_breaks\` or \`date_labels\` are not strings (@RodDalBen, #5880)
* Secondary axes respect \`n.breaks\` setting in continuous scales (@teunbrand, #4483).
* The size of the \`draw_key_polygon()\` glyph now reflects the \`linewidth\`
  aesthetic which internally defaults to 0 (#4852).
* \`draw_key_rect()\` replaces a \`NA\` fill by the \`colour\` aesthetic 
  (@teunbrand, #5385, #5756).
* Fixed bug where \`na.value\` was incorrectly mapped to non-\`NA\` values
  (@teunbrand, #5756).
* Missing values from discrete palettes are no longer inappropriately translated
  (@teunbrand, #5929). 
* Fixed bug where empty discrete scales weren't recognised as such
  (@teunbrand, #5945).
* Fixed regression with incorrectly drawn gridlines when using \`coord_flip()\`
  (@teunbrand, #6293).
* \`coord_radial()\` now displays no axis instead of throwing an error when
  a scale has no breaks (@teunbrand, #6271).
* \`coord_radial()\` displays minor gridlines now (@teunbrand).
* Position scales combined with \`coord_sf()\` can now use functions in the
 \`breaks\` argument. In addition, \`n.breaks\` works as intended and
 \`breaks = NULL\` removes grid lines and axes (@teunbrand, #4622).
* \`coord_sf()\` no longer errors when dealing with empty graticules (@teunbrand, #6052)
* \`position_fill()\` avoids stacking observations of zero (@teunbrand, #6338)
* Fix a bug in \`position_jitterdodge()\` where different jitters would be applied
  to different position aesthetics of the same axis (@teunbrand, #5818).
* Fixed bug in \`position_dodge2()\`'s identification of range overlaps
  (@teunbrand, #5938, #4327).
* \`geom_ribbon()\` now appropriately warns about, and removes, missing values
  (@teunbrand, #6243).
* Custom and raster annotation now respond to scale transformations, and can
  use AsIs variables for relative placement (@teunbrand based on
  @yutannihilation's prior work, #3120)
* \`geom_sf()\` now accepts shape names for point geometries (@sierrajohnson, #5808)
* \`geom_step()\` now supports the \`orientation\` argument (@teunbrand, #5936).
* \`geom_rug()\` prints a warning when \`na.rm = FALSE\`, as per documentation (@pn317, #5905)
* \`geom_curve()\` now appropriately removes missing data instead of throwing
  errors (@teunbrand, #5831).
* Improved consistency of curve direction in \`geom_curve()\` (@teunbrand, #5069).
* \`geom_abline()\` clips to the panel range in the vertical direction too
  (@teunbrand, #6086).
* The default \`se\` parameter in layers with \`geom = "smooth"\` will be \`TRUE\`
  when the data has \`ymin\` and \`ymax\` parameters and \`FALSE\` if these are
  absent. Note that this does not affect the default of \`geom_smooth()\` or
  \`stat_smooth()\` (@teunbrand, #5572).
* The bounded density option in \`stat_density()\` uses a wider range to
  prevent discontinuities (#5641).
* Fixed bug in \`stat_function()\` so x-axis title now produced automatically
  when no data added. (@phispu, #5647).
* \`stat_summary_2d()\` and \`stat_bin_2d()\` now deal with zero-range data
  more elegantly (@teunbrand, #6207).
* \`stat_summary_bin()\` no longer ignores \`width\` parameter (@teunbrand, #4647).
* Fixed bug where the \`ggplot2::\`-prefix did not work with \`stage()\`
  (@teunbrand, #6104).
* Passing empty unmapped aesthetics to layers raises a warning instead of
  throwing an error (@teunbrand, #6009).
* Staged expressions are handled more gracefully if legends cannot resolve them
  (@teunbrand, #6264).
* \`theme(strip.clip)\` now defaults to \`"on"\` and is independent of Coord
  clipping (@teunbrand, 5952).
* Fixed bug in \`facet_grid(margins = TRUE)\` when using expresssions
  (@teunbrand, #1864).
* Prevented \`facet_wrap(..., drop = FALSE)\` from throwing spurious errors when
  a character facetting variable contained \`NA\`s (@teunbrand, #5485).
  
## Developer facing

### Utilities

* New helper function \`gg_par()\` to translate ggplot2's interpretation of
  graphical parameters to {grid}'s interpretation (@teunbrand, #5866).
* New roxygen tag \`@aesthetics\` that takes a Geom, Stat or Position class and
  generates an 'Aesthetics' section.
* New \`make_constructor()\` function that builds a standard constructor for
  Geom and Stat classes (@teunbrand, #6142).
* New \`element_point()\` and \`element_polygon()\` that can be given to
  \`theme(point, polygon)\` as an extension point (@teunbrand, #6248).
* The helper function \`is_waiver()\` is now exported to help extensions to work
  with \`waiver()\` objects (@arcresu, #6173).
* \`update_geom_defaults()\` and \`update_stat_defaults()\` have a reset mechanism
  when using \`new = NULL\` and invisible return the previous defaults (#4993).
* New \`reset_geom_defaults()\` and \`reset_stat_defaults()\` to restore all geom or
  stat default aesthetics at once (@teunbrand, #5975).
* New function \`complete_theme()\` to replicate how themes are handled during
  plot building (#5801).
* New function \`get_strip_labels()\` to retrieve facet labels (@teunbrand, #4979)
* The ViewScale class has a \`make_fixed_copy()\` method to permit
  copying trained position scales (#3441).
  
### Internal changes

* Facet gains a new method \`setup_panel_params\` to interact with the
  panel_params setted by Coord object (@Yunuuuu, #6397, #6380)
* \`continuous_scale()\` and \`binned_scale()\` sort the \`limits\`
  argument internally (@teunbrand).
* \`Scale$get_labels()\` format expressions as lists.
* Using \`after_scale()\` in the \`Geom*$default_aes\` field is now
  evaluated in the context of data (@teunbrand, #6135)
* Improvements to \`pal_qualitative()\` (@teunbrand, #5013)
* Panel clipping responsibility moved from Facet class to Coord class through 
  new \`Coord$draw_panel()\` method.
* Rearranged the code of \`Facet$draw_panels()\` method (@teunbrand).
* Added \`gg\` class to \`labs()\` (@phispu, #5553).
* The plot's layout now has a coord parameter that is used to prevent setting 
  up identical panel parameters more than once (#5427)
* Applying defaults in \`geom_sf()\` has moved from the internal \`sf_grob()\` to 
  \`GeomSf$use_defaults()\` (@teunbrand).
* New \`Facet$draw_panel_content()\` method for delegating panel 
  assembly (@Yunuuuu, #6406).
* Layer data can be attenuated with parameter attributes (@teunbrand, #3175).
* When facets coerce the faceting variables to factors, the 'ordered' class
  is dropped (@teunbrand, #5666).
* \`stat_align()\` skips computation when there is only 1 group and therefore
  alignment is not necessary (#5788).
* \`position_stack()\` skips computation when all \`x\` values are unique and
  therefore stacking is not necessary (#5788).
* The summary function of \`stat_summary()\` and \`stat_summary_bin()\` is setup 
  once in total instead of once per group (@teunbrand, #5971)
* Removed barriers for using 2D structures as aesthetics (@teunbrand, #4189).
* Stricter check on \`register_theme_elements(element_tree)\` (@teunbrand, #6162)
* The \`legend.key.width\` and \`legend.key.height\` calculations are no
  longer precomputed before guides are drawn (@teunbrand, #6339)
* When \`validate_subclass()\` fails to find a class directly, it tries
  to retrieve the class via constructor functions (@teunbrand).
  
# ggplot2 3.5.2

This is a small release focusing on providing infrastructure for other packages
to gracefully prepare for changes in the next major release.

## Improvements

* Standardised test functions for important classes: \`is_ggproto()\`,
 \`is_ggplot()\`, \`is_mapping()\`, \`is_layer()\`, \`is_geom()\`, \`is_stat()\`,
 \`is_position()\`, \`is_coord()\`, \`is_facet()\`, \`is_scale()\`, \`is_guide()\`,
 \`is_guides()\`, \`is_margin()\`, \`is_theme_element()\` and \`is_theme()\`.
* New \`get_labs()\` function for retrieving completed plot labels
  (@teunbrand, #6008).
* New \`get_geom_defaults()\` for retrieving resolved default aesthetics.
* A new \`ggplot_build()\` S3 method for <ggplot_built> classes was added, which
  returns input unaltered (@teunbrand, #5800).
	`));
	ctx.resolvePreAnalysis();

	test('Parse the News!', () => {
		const files = ctx.files.getFilesByRole(FileRole.News);
		assert.lengthOf(files, 1, 'There should be exactly one NEWS file');

		const chunks = files[0].content();
		assert.lengthOf(chunks, 4, 'There should be four news chunks for every version');
		assert.strictEqual(chunks[1].version, '4.0.1', 'The second chunk should be for version 4.0.1');
		assert.typeOf(chunks[2].entries[0], 'object', 'The first entry of version 4.0.1 should be an object');
		assert.strictEqual((chunks[2].entries[0] as NewsChunk).header, '## User facing', 'The first entry of version 4.0.1 should have the correct header');
	});
});