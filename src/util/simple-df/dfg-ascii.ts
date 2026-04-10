import type { DataflowGraph } from '../../dataflow/graph/graph';
import { graphlib, layout } from 'dagre';
import { edgeTypesToNames } from '../../dataflow/graph/edge';
import { normalizeIdToNumberIfPossible, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../dataflow/graph/vertex';

function combineAscii(has: string, add: string): string {
	if(has === ' ' || has === add) {
		return add;
	}
	const [a, b] = [has, add].sort();
	let res: string = add;
	if(b === edgesChar.vertical && a === edgesChar.horizontal) {
		res = '┼';
	} else if((b === edgesChar.topRight || b === edgesChar.topLeft || b === '┬') && a === edgesChar.horizontal) {
		res = '┬';
	} else if((b === edgesChar.bottomRight || b === edgesChar.bottomLeft || b === '┴') && a === edgesChar.horizontal) {
		res = '┴';
	} else if((b === edgesChar.topRight || b === edgesChar.bottomRight || b === '┤') && a === edgesChar.vertical) {
		res = '┤';
	} else if((b === edgesChar.topLeft || b === edgesChar.bottomLeft || b === '├') && a === edgesChar.vertical) {
		res = '├';
	} else if((b === '┤' || b === '├') && a === edgesChar.horizontal) {
		res = '┼';
	} else if((b === '┬' || b === '┴') && a === edgesChar.vertical) {
		res = '┼';
	}

	return res;
}

class AsciiCanvas {
	private readonly filler: string;
	private readonly grid:   string[][];
	private readonly shiftX: number;
	private readonly shiftY: number;

	constructor(filler = ' ', shiftX = 0, shiftY = 0) {
		this.grid = [];
		this.filler = filler;
		this.shiftX = shiftX;
		this.shiftY = shiftY;
	}

	set(x: number, y: number, char: string, overwrite = false): void {
		x += this.shiftX;
		y += this.shiftY;
		if(x < 0 || y < 0 || isNaN(x) || isNaN(y)) {
			return;
		}
		while(this.grid.length <= y) {
			this.grid.push([]);
		}
		while(this.grid[y].length <= x) {
			this.grid[y].push(this.filler);
		}
		this.grid[y][x] = overwrite ? char : combineAscii(this.grid[y][x], char);
	}

	drawText(x: number, y: number, text: string): void {
		for(let i = 0; i < text.length; i++) {
			this.set(x + i, y, text[i]);
		}
	}

	toString(): string {
		return this.grid.map(r => r.join('')).join('\n');
	}
}

/**
 * Converts the given dataflow graph to an ASCII representation.
 */
export function dfgToAscii(dfg: DataflowGraph): string {
	const g = new graphlib.Graph();
	const verts = Array.from(dfg.vertices(true));
	g.setGraph({
		nodesep: 1,
		ranksep: 4,
		edgesep: 0,
		rankdir: verts.length < 15 ? 'LR' : 'TB',
		ranker:  'longest-path',
	});
	for(const [id, v] of verts) {
		let label = recoverName(id, dfg.idMap) ?? v.tag;

		if(label.length < 3) {
			label = label.padStart(2, ' ').padEnd(3, ' ');
		}

		g.setNode(String(id), {
			label,
			width:  Math.max(3, label.length*1.2),
			height: 4,
			shape:  'rectangle'
		});
	}
	const edgesDone = new Set<string>();
	let longestId = 0;
	for(const [from, edges] of dfg.edges()) {
		longestId = Math.max(longestId, String(from).length);
		for(const [to, { types }] of edges) {
			if(!g.hasNode(String(from)) || !g.hasNode(String(to)) || edgesDone.has(`${to}-${from}`)) {
				continue;
			}
			longestId = Math.max(longestId, String(to).length);
			g.setEdge(String(from), String(to), edgeTypesToNames(types));
			edgesDone.add(`${from}-${to}`);
		}
	}
	layout(g, {
		minlen: 2
	});
	const canvas = new AsciiCanvas();
	renderEdges(g, canvas);
	renderVertices(dfg, g, canvas);
	const lines = canvas.toString().split('\n').filter(line => line.trim() !== '');
	const edgeLines: string[] = [];
	// add all edges
	for(const [from, edges] of dfg.edges()) {
		for(const [to, { types }] of edges) {
			if(!g.hasNode(String(from)) || !g.hasNode(String(to))) {
				continue;
			}
			edgeLines.push(`${from.toString().padStart(longestId, ' ')} -> ${to.toString().padStart(longestId, ' ')}: ${Array.from(edgeTypesToNames(types)).join(', ')}`);
		}
	}
	// always merge two edgelines with padding
	if(edgeLines.length > 0) {
		lines.push('Edges:');
	}
	const longestFirstLine = Math.max(...edgeLines.map(l => l.length));
	for(let i = 0; i < edgeLines.length; i += 2) {
		const line1 = edgeLines[i];
		const line2 = edgeLines[i + 1];
		if(line2) {
			lines.push(line1.padEnd(Math.min(50, longestFirstLine), ' ') + line2);
		} else {
			lines.push(line1);
		}
	}
	return lines.join('\n');
}

const type2Edge = {
	[VertexType.FunctionCall]:       'c',
	[VertexType.Use]:                'u',
	[VertexType.FunctionDefinition]: 'f',
	[VertexType.VariableDefinition]: 'v',
	[VertexType.Value]:              '0'

} as const satisfies Record<VertexType, string>;

function renderVertices(dfg: DataflowGraph, g: graphlib.Graph, canvas: AsciiCanvas): void {
	for(const nodeId of g.nodes()) {
		const node = g.node(nodeId);
		if(!node) {
			continue;
		}

		const label = node.label as string;
		const x = Math.round(node.x);
		const y = Math.round(node.y);

		const tag = dfg.getVertex(normalizeIdToNumberIfPossible(nodeId))?.tag;
		let e = '+';
		if(tag && tag in type2Edge) {
			e = type2Edge[tag as VertexType];
		}
		canvas.drawText(x - 1, y - 1, `${e}${'-'.repeat(label.length)}${e}`);
		canvas.drawText(x - 1 + Math.round(label.length/2 - nodeId.length/2), y - 1, `<${nodeId}>`);
		canvas.drawText(x - 1, y, `|${label}|`);
		canvas.drawText(x - 1, y + 1, `${e}${'-'.repeat(label.length)}${e}`);
	}
}

const edgesChar = {
	vertical:    '│',
	horizontal:  '─',
	topLeft:     '┌',
	topRight:    '┐',
	bottomLeft:  '└',
	bottomRight: '┘',
};
function determineCornerChar(lastDirection: 'horizontal' | 'vertical' | null, px: number, py: number, tx: number, ty: number): string {
	if(px === tx) {
		return edgesChar.vertical;
	} else if(py === ty) {
		return edgesChar.horizontal;
	} else if(px < tx) {
		if(py < ty) {
			return lastDirection === 'horizontal' ? edgesChar.topRight : edgesChar.bottomLeft;
		} else {
			return lastDirection === 'horizontal' ? edgesChar.bottomRight : edgesChar.topLeft;
		}
	} else {
		if(py < ty) {
			return lastDirection === 'horizontal' ? edgesChar.topLeft : edgesChar.bottomRight;
		} else {
			return lastDirection === 'horizontal' ? edgesChar.bottomLeft : edgesChar.topRight;
		}
	}
}

function renderEdges(g: graphlib.Graph, canvas: AsciiCanvas): void {
	const otherEdges = new Set<string>();
	for(const e of g.edges()) {
		const edge = g.edge(e);
		let points = edge.points;

		// we rework edges into sequences of straight lines only, adding intermediate points as needed
		const newPoints = [points[0]];
		for(let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			if(prev.x !== curr.x && prev.y !== curr.y) {
				const intermediate = { x: prev.x, y: curr.y };
				newPoints.push(intermediate);
			}
			newPoints.push(curr);
		}
		points = newPoints;

		let lastDirection: 'horizontal' | 'vertical' | null = null;
		// let single edges overwrite themselves
		const writtenPoints = new Set<string>();
		for(let i = 0; i < points.length - 1; i++) {
			const p = points[i - 1] ?? points[i];
			const a = points[i];
			const b = points[i + 1];

			const px = Math.round(p.x);
			const py = Math.round(p.y);
			const x1 = Math.round(a.x);
			const y1 = Math.round(a.y);
			const x2 = Math.round(b.x);
			const y2 = Math.round(b.y);

			if(x1 === x2) {
				// vertical
				const [start, end] = y1 < y2 ? [y1, y2] : [y2, y1];
				for(let y = start; y <= end; y++) {
					const key = `${x1},${y}`;
					const overwrite = writtenPoints.has(key) && !otherEdges.has(key);
					if(y === (y1 < y2 ? start : end)) {
						const cornerChar = determineCornerChar(lastDirection, px, py, x2, y2);
						canvas.set(x1, y, cornerChar, overwrite);
					} else {
						canvas.set(x1, y, edgesChar.vertical, overwrite);
					}
					writtenPoints.add(`${x1},${y}`);
				}
				lastDirection = 'vertical';
			} else if(y1 === y2) {
				// horizontal
				const [start, end] = x1 < x2 ? [x1, x2] : [x2, x1];
				for(let x = start; x <= end; x++) {
					const key = `${x},${y1}`;
					const overwrite = writtenPoints.has(key) && !otherEdges.has(key);
					if(x === (x1 < x2 ? start : end)) {
						const cornerChar = determineCornerChar(lastDirection, px, py, x2, y2);
						canvas.set(x, y1, cornerChar, overwrite);
					} else {
						canvas.set(x, y1, edgesChar.horizontal, overwrite);
					}
					writtenPoints.add(`${x},${y1}`);
				}
				lastDirection = 'horizontal';
			}
		}
		for(const p of writtenPoints) {
			otherEdges.add(p);
		}
	}
}