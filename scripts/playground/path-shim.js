/*
 * What node's `path` does, for the page that has no node. Every module the playground bundles keeps its
 * path arithmetic: joining, splitting, and comparing paths says nothing about a file system, and stubbing
 * it out is what once made every path look absolute and every file look like it was there.
 */
const isWindows = separator => separator === '\\';

function build(sep) {
	const split = p => p.split(/[\\/]+/);
	const rooted = p => p.startsWith('/') || p.startsWith('\\') || (isWindows(sep) && /^[A-Za-z]:[\\/]/.test(p));

	/** `a/./b/../c` as `a/c`, keeping the leading `..` a relative path is allowed to have */
	function tidy(parts, keepAbove) {
		const out = [];
		for(const part of parts) {
			if(part === '' || part === '.') {
				continue;
			} else if(part === '..' && out.length > 0 && out[out.length - 1] !== '..') {
				out.pop();
			} else if(part !== '..' || keepAbove) {
				out.push(part);
			}
		}
		return out;
	}

	const self = {
		sep,
		delimiter: isWindows(sep) ? ';' : ':',
		normalize(p) {
			const absolute = rooted(p);
			const drive = isWindows(sep) && /^[A-Za-z]:/.test(p) ? p.slice(0, 2) : '';
			const parts = tidy(split(p.slice(drive.length)), !absolute);
			const joined = parts.join(sep);
			const trailing = /[\\/]$/.test(p) && joined.length > 0 ? sep : '';
			return drive + (absolute ? sep : '') + joined + trailing || (absolute ? drive + sep : '.');
		},
		join(...parts) {
			const kept = parts.filter(part => typeof part === 'string' && part.length > 0);
			return kept.length === 0 ? '.' : self.normalize(kept.join(sep));
		},
		isAbsolute: p => rooted(p),
		dirname(p) {
			const parts = split(p.replace(/[\\/]+$/, ''));
			parts.pop();
			const head = parts.join(sep);
			return head.length > 0 ? head : rooted(p) ? sep : '.';
		},
		basename(p, ext) {
			const name = split(p.replace(/[\\/]+$/, '')).pop() ?? '';
			return ext !== undefined && name.endsWith(ext) && name !== ext ? name.slice(0, -ext.length) : name;
		},
		extname(p) {
			const name = self.basename(p);
			const dot = name.lastIndexOf('.');
			return dot <= 0 ? '' : name.slice(dot);
		},
		/* the page has no working directory, so everything resolves against the root it invents for itself */
		resolve(...parts) {
			let out = sep;
			for(const part of parts) {
				if(typeof part === 'string' && part.length > 0) {
					out = rooted(part) ? part : out + sep + part;
				}
			}
			return self.normalize(out) || sep;
		},
		relative(from, to) {
			const a = tidy(split(self.resolve(from)), false);
			const b = tidy(split(self.resolve(to)), false);
			let same = 0;
			while(same < a.length && same < b.length && a[same] === b[same]) {
				same++;
			}
			return [...Array.from({ length: a.length - same }, () => '..'), ...b.slice(same)].join(sep);
		},
		parse(p) {
			const dir = self.dirname(p), base = self.basename(p), ext = self.extname(p);
			return { root: rooted(p) ? sep : '', dir, base, ext, name: ext.length > 0 ? base.slice(0, -ext.length) : base };
		},
		format: ({ dir, base, name = '', ext = '' }) => self.join(dir ?? '', base ?? (name + ext)),
		toNamespacedPath: p => p
	};
	return self;
}

const posix = build('/');
const win32 = build('\\');
const path = { ...posix, posix, win32 };
path.posix = posix;
path.win32 = win32;
posix.posix = posix;
posix.win32 = win32;
win32.posix = posix;
win32.win32 = win32;
path.default = path;
module.exports = path;
