/**
 * What every generated page shares: its template, the parts spliced into it, the version marker stamped
 * into it, and how it is written.
 * @module
 */
import fs from 'fs';
import path from 'path';
import { fillVersion, versionMarker } from './version-marker';

/** one of the pages that link to each other */
interface Page {
	/** what a template calls the page in `<!--NAV:...-->` and `<!--CONTROLS:...-->` */
	readonly id:    string;
	/** where the page lives, relative to the site root */
	readonly dir:   string;
	/** what the other pages call it */
	readonly label: string;
	/** the class this page puts on the links of its own bar, where it uses one */
	readonly link?: string;
	/** the size of the theme icons this page draws, where it is not the usual one */
	readonly icon?: number;
}

/** every page that has a bar, in the order each of their navs lists them */
const Pages: readonly Page[] = [
	{ id: 'landing', dir: '', label: 'Landing Page' },
	{ id: 'playground', dir: 'wiki/playground', label: 'Playground', link: 'link', icon: 15 },
	{ id: 'sigdb', dir: 'wiki/sigdb', label: 'Signature DB' },
	{ id: 'capabilities', dir: 'wiki/capabilities', label: 'Capabilities' },
	{ id: 'benchmark', dir: 'wiki/stats/benchmark', label: 'Benchmarks' }
];

/** the last entry of every nav, which is not a page of this site */
const Wiki = 'https://github.com/flowr-analysis/flowr/wiki';

/** whitespace is content in these, so they are put back untouched */
const Protected = /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi;
const Marker = /\0(\d+)\0/g;

/** what a page adds to the shared palette, said once for each half of it */
const Palette = /^<!--THEME-(LIGHT|DARK)\n([\s\S]*?)\n-->\n/gm;

/** the page-specific footer row, e.g. the benchmark page's live hooks; other pages leave it out */
const FooterNotes = /^<!--FOOTER-NOTES\n([\s\S]*?)\n-->\n/gm;

/** the shared part `name` from `scripts/partials/` */
function partial(name: string): string {
	return fs.readFileSync(path.join('scripts', 'partials', name), 'utf8').trimEnd();
}

function page(id: string): Page {
	const found = Pages.find(p => p.id === id);
	if(found === undefined) {
		throw new Error(`there is no page named ${id}`);
	}
	return found;
}

/** how one page reaches another, which has to hold for a folder opened from disk too */
function reach(from: Page, to: Page): string {
	return `${path.posix.relative(from.dir, to.dir)}/`;
}

/** every other page, as a link at the depth `from` sits at */
function pageLinks(from: Page, cls: string): string {
	return Pages.filter(p => p !== from).map(p => `<a ${cls}href="${reach(from, p)}" target="_blank" rel="noopener">${p.label}</a>`).join('\n');
}

/** the bar links of a page: every other one, in the same order however deep the page itself sits */
function nav(from: Page): string {
	const cls = from.link ? `class="${from.link}" ` : '';
	return `${pageLinks(from, cls)}\n<a ${cls}href="${Wiki}" target="_blank" rel="noopener">Wiki</a>`;
}

/** the GitHub mark and the theme switch, which end every bar */
function controls(from: Page): string {
	return partial('controls.html')
		.replaceAll('<!--CONTROLS-CLASS-->', from.link ? `${from.link} gh` : 'gh')
		.replaceAll('<!--ICON-->', String(from.icon ?? 16));
}

/** how a page reaches the site root; empty for the root itself so its own links need no prefix */
function reachRoot(from: Page): string {
	return from.dir === '' ? '' : `${path.posix.relative(from.dir, '')}/`;
}

/** the footer every page shares; `notes` is the page-specific row only the benchmark page fills */
function footer(from: Page, notes: string): string {
	return partial('footer.html')
		.replace('<!--FOOTER-ROOT-->', reachRoot(from))
		.replace('<!--FOOTER-PAGES-->', pageLinks(from, ''))
		.replace('<!--FOOTER-NOTES-->', notes ? `<p class="notes">${notes}</p>` : '');
}

/**
 * dark colors are needed twice (explicit theme + system-preference media query), so stated once here.
 * a page adds colors via THEME-LIGHT/THEME-DARK; THEME-CSS:own skips the shared palette entirely.
 */
function fillTheme(text: string): string {
	const more: Record<string, string> = { LIGHT: '', DARK: '' };
	return text
		.replace(Palette, (_, half: string, lines: string) => {
			more[half] = `${lines}\n`;
			return '';
		})
		.replace(/<!--THEME-CSS(:own)?-->/, (_, own?: string) => {
			const source = own ? '<!--MORE-->\n<!--DARK-->\n<!--MORE-->\n' : `${partial('theme.css')}\n`;
			const [light, dark] = source.split('<!--DARK-->\n').map((half, at) => half.replace('<!--MORE-->\n', more[at === 0 ? 'LIGHT' : 'DARK']));
			return [
				`:root {\n${light}}`,
				`:root[data-theme="dark"] {\n${dark}}`,
				`@media (prefers-color-scheme: dark) {\n\t:root:not([data-theme="light"]) {\n${dark.replace(/^(?=.)/gm, '\t')}\t}\n}`
			].join('\n');
		});
}

/** the shared parts a template asks for, spliced in the way the version marker is */
function fillParts(text: string): string {
	/* pulled out first: the footer that uses this may appear before the FOOTER-NOTES block itself */
	let notes = '';
	const stripped = text.replace(FooterNotes, (_, lines: string) => {
		notes = lines;
		return '';
	});
	return fillTheme(stripped)
		.replace('<!--BASE-CSS-->', () => partial('base.css'))
		.replace('<!--BAR-CSS-->', () => partial('bar.css'))
		.replace('<!--FOOTER-CSS-->', () => partial('footer.css'))
		.replace('<!--CHROME-SCRIPT-->', () => partial('chrome.html'))
		.replace(/<!--NAV:([\w-]+)-->/, (_, id: string) => nav(page(id)))
		.replace(/<!--CONTROLS:([\w-]+)-->/, (_, id: string) => controls(page(id)))
		.replace(/<!--FOOTER:([\w-]+)-->/, (_, id: string) => footer(page(id), notes));
}

/** the template `name` from `scripts/`, with its parts and the version placeholders filled in */
export function template(...name: readonly string[]): string {
	return fillVersion(fillParts(fs.readFileSync(path.join('scripts', ...name), 'utf8')), versionMarker());
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
