// Test Geometry related functions
// @ts-check
import * as Color from '/color.js';
import * as Geometry from '/geometry.js';
import * as Util from '/util.js';

const S = 16;
const WIDTH = 10;

/**
 * Try to move to position, if possible.
 *
 * @param {number} x x map-coordinate.
 * @param {number} y y map-coordinate.
 */
window.on_map_click = function(x, y) {
	// Snap to grid
	x = Util.quantize(x, S);
	y = Util.quantize(y, S);

	console.log('Trying to move to', x, y);
	if (Geometry.can_move([character.x, character.y, character.map], [x, y, character.map])) {
		move(x, y).then(_ => {
			clear_drawings();
			draw_lines();
			draw_grid();
		});
	}

	return true;
}

/**
 * Main.
 */
function main() {
	set_message('Test');

	draw_lines();
	draw_grid();
}

/**
 * Draw "can-move" grid.
 */
function draw_grid() {
	const here = [character.x, character.y, character.map];
	console.log('Drawing Grid...')

	// Our move
	for (let i = -WIDTH; i < WIDTH; i++) {
		for (let j = -WIDTH; j < WIDTH; j++) {
			const there = [Util.quantize(here[0], S) + S * i, Util.quantize(here[1], S) + S * j, here[2]];
			const can_builtin_move = can_move_to(there[0], there[1]);
			const can_our_move = Geometry.can_move(here, there);

			if (can_our_move) {
				draw_circle(there[0], there[1], 2, null, Color.GREEN);
			}

			if (can_builtin_move) {
				draw_circle(there[0], there[1], 3, null, Color.BLUE);
			} else {
				draw_circle(there[0], there[1], 1, null, Color.RED);
			}
		}
	}
}

/**
 * Draw all boundary lines on this map.
 */
export function draw_lines() {
	// Horizontal lines
	for (let y_line of G.geometry[character.map].y_lines) {
		const y = y_line[0];
		const x1 = y_line[1];
		const x2 = y_line[2];

		draw_line(x1, y, x2, y, null, Color.RED);
	}

	// Vertical lines
	for (let x_line of G.geometry[character.map].x_lines) {
		const x = x_line[0];
		const y1 = x_line[1];
		const y2 = x_line[2];

		draw_line(x, y1, x, y2, null, Color.RED);
	}
}

try {
	main();
} catch (e) {
	console.error('Unhandled exception', e);
}
