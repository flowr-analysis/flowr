/**
 * What every generated page shares: its template, the version marker stamped into it, and how it is written.
 * @module
 */
import fs from 'fs';
import path from 'path';
import { fillVersion, versionMarker } from './version-marker';

/** whitespace is content in these, so they are put back untouched */
const Protected = /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi;
const Marker = /\0(\d+)\0/g;

/** the template `name` from `scripts/`, with the version placeholders filled in */
export function template(...name: readonly string[]): string {
	return fillVersion(fs.readFileSync(path.join('scripts', ...name), 'utf8'), versionMarker());
}

/**
 * Drops the source indentation and the blank lines. One element per line stays on purpose: a committed page
 * that collapsed into one would turn every later change into a diff of the whole file.
 */
export function compact(page: string): string {
	const kept: string[] = [];
	return page
		.replace(Protected, block => `\0${kept.push(block) - 1}\0`)
		.replace(/^[ \t]+/gm, '')
		.replace(/\n{2,}/g, '\n')
		.trim()
		.replace(Marker, (_, at: string) => kept[Number(at)]);
}

/**
 * A page opened from disk has no server to answer a link to a folder, so a page that is itself an `index.html`
 * points its own relative folder links at one too.
 */
const LocalLinks = `<script>
	(function() {
		if(!/(^|\\/)index\\.html$/.test(location.pathname)) { return; }
		for(const a of document.querySelectorAll('a[href$="/"]')) {
			const href = a.getAttribute('href');
			if(!/^[a-z]+:|^\\/\\//i.test(href)) { a.setAttribute('href', href + 'index.html'); }
		}
	})();
</script>`;

/** writes `page` compacted to `target`, creating its folder, and returns the bytes written */
export function writePage(target: string, page: string): number {
	const out = compact(page.replace('</body>', `${LocalLinks}\n</body>`)) + '\n';
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, out);
	return out.length;
}
