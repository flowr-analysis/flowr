import type { PlaygroundLinkParts } from '../../util/text/playground-link';
import { Playground } from '../../util/text/playground-link';

/**
 * A markdown link that opens the playground on exactly this: the script, what the link points at, and
 * where the cursor sits. See {@link Playground.link} for what the parts mean.
 */
export function linkToPlayground(text: string, parts: PlaygroundLinkParts): string {
	return `[${text}](${Playground.link(parts)})`;
}

/**
 * The mark a feature carries in its own title line, so whoever reads about it can run it in their browser
 * without the description growing a paragraph for the link. The marks are what the page lights up when it
 * opens, which is how a new rule or a new query gets shown off.
 */
export function tryInPlayground(parts: PlaygroundLinkParts, what = 'this example'): string {
	return `(&nbsp;[▶&nbsp;Explore in Browser](${Playground.link(parts)} "run ${what} in flowR's playground, no setup")&nbsp;)`;
}
