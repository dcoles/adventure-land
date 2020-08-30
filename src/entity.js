// Functions for working with entities.
// @ts-check

import * as Adventure from './adventure.js';
import * as Util from './util.js';

const character = Adventure.get_character();

/**
 * Return nearest monsters.
 *
 * @param {object} [criteria] Criteria for matching monster.
 * @returns {Array} Monsters ordered from nearest to furthest away.
 */
export function get_nearest_monsters(criteria) {
	criteria = criteria || {};
	criteria.type = 'monster';
	criteria.min_xp = criteria.min_xp || 1;  // don't kill puppies

	const entities = Object.values(Adventure.get_entities());
	return filter(entities, criteria).sort(compare_distance);
}

/**
 * Filter entities.
 *
 * @param {Array} entities Entities to filter.
 * @param {object} criteria Criteria to filter entities by.
 * @param {"character"|"monster"} [criteria.type] Entity must match this type.
 * @param {object} [criteria.target] Entity must be targetting this entity.
 * @param {boolean} [criteria.no_target] Entity must not have a target.
 * @param {number} [criteria.min_xp] Entity must give at least this much XP.
 * @param {boolean} [criteria.path_check] Entity must be directly reachable.
 * @param {Function} [criteria.filter] General-purpose filter function.
 * @returns {Array} Filtered entities.
 */
export function filter(entities, criteria) {
	return entities.filter((entity) => {
		if (criteria.type && entity.type !== criteria.type) {
			return false;
		}

		if (criteria.target && entity.target !== criteria.target.name) {
			return false;
		}

		if (criteria.no_target && entity.target && entity.target.name !== character.name) {
			return false;
		}

		if (criteria.min_xp && entity.xp < criteria.min_xp) {
			return false;
		}

		if (criteria.path_check && !Adventure.can_move_to(entity)) {
			return false;
		}

		if (criteria.filter && !criteria.filter(entity)) {
			return false;
		}

		return true;
	});
}

/**
 * Comparision function for ordering entities from nearest to furthest away.
 *
 * @param {object} a First entity to compare.
 * @param {object} b Second entity to compare.
 * @returns {number}
 */
export function compare_distance(a, b) {
	return distance_between(window.character, a) - distance_between(window.character, b);
}

/**
 * Calculate the distance between two entities.
 *
 * @param {object} a The first entity.
 * @param {object} b The second entity.
 * @returns {number|null} Distance in pixels or null if not on the same map.
 */
export function distance_between(a, b) {
	if (a.in !== b.in) {
		return null;
	}

	return Util.distance(a.x, a.y, b.x, b.y);
}

/** Calculate time for target to move a certain distance
 *
 * @param {object} entity Target to measure.
 * @param {number} distance Distance target will move.
 * @returns {number} Duration in milliseconds.
*/
export function movement_time(entity, distance) {
	return distance / entity.speed * 1000;
}

/**
 * Calculate the difficulty of an entity.
 *
 * 0 is easy, 10 is impossibly hard.
 *
 * @param {object} entity Target to calculate difficulty of
 * @returns {number} Difficulty score out of 10.
 */
export function difficulty(entity) {
	const target_dps = Math.max(entity.attack * entity.frequency - 50, 0);
	const character_dps = character.attack * character.frequency;

	// How many seconds until someone would die?
	const t_target = entity.hp / character_dps;
	const t_character = character.hp / target_dps;
	const t_end = Math.min(t_target, t_character);

	const target_damage = Math.min(character_dps * t_end, entity.hp);
	const character_damage = Math.min(target_dps * t_end, character.hp);

	return 5 * (character_damage / character.hp) + 5 * (1 - (target_damage / entity.hp));
}

/**
 * Does it appear that two entities will collide?
 *
 * Note: This is based off the entities current velocity, so should that
 * change the actual result may be different.
 *
 * @see https://www.gamasutra.com/view/feature/131790/simple_intersection_tests_for_games.php?page=3
 *
 * @param {object} a First entity.
 * @param {object} b Second entity.
 * @param {number} [t_max] Max seconds to consider (default: forever).
 * @returns {boolean} True if they will collide, otherwise False.
 */
export function will_collide(a, b, t_max) {
	t_max = t_max || Infinity;

	const a_width = Adventure.get_width(a);
	const a_height = Adventure.get_height(a);
	const b_width = Adventure.get_width(b);
	const b_height = Adventure.get_height(b);

	// Bounding boxes
	const a_max = [a.x + a_width / 2, a.y + a_height / 2];
	const a_min = [a.x - a_width / 2, a.y - a_height / 2];
	const b_max = [b.x + b_width / 2, b.y + b_height / 2];
	const b_min = [b.x - b_width / 2, b.y - b_height / 2];

	// Solve from the reference frame of A (B in motion)
	// v = v_b - v_a
	const v = [b.vx - a.vx, b.vy - a.vy];

	// Iterate over axes and find start/end overlap times
	let u0 = [0, 0];
	let u1 = [0, 0];
	for (let i = 0; i < 2; i++) {
		if (a_max[i] < b_min[i] && v[i] < 0) {
			// A to the left|above of B and B approaching
			u0[i] = (a_max[i] - b_min[i]) / v[i];
		} else if (b_max[i] < a_min[i] && v[i] > 0) {
			// B to the left|above of A and B approaching
			u0[i] = (a_min[i] - b_max[i]) / v[i];
		}

		if (b_max[i] > a_min[i] && v[i] < 0) {
			// B to the right|below of A and B approaching
			u1[i] = (a_min[i] - b_max[i]) / v[i];
		} else if (a_max[i] > b_min[i] && v[i] > 0) {
			// A to the right|below of B and B approaching
			u1[i] = (a_max[i] - b_min[i]) / v[i];
		}
	}

	// Can only overlap if first overlap time is before the last overlap time
	const u0_max = Math.max(...u0);
	const u1_min = Math.min(...u1);
	return u0_max < u1_min && u0_max <= t_max + 0.250;  // Slight fudge
}

/**
 * Print the location of an entity.
 *
 * @param {object} entity An entity with a position.
 * @param {number} entity.x x-coordinate (pixels).
 * @param {number} entity.y y-coordinate (pixels).
 * @param {string} [entity.in] Optional instance/map.
 * @param {string} [entity.map] Optional map.
 */
export function location_to_string(entity) {
	let s = `${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}`;
	if (entity.in && entity.in != entity.map) {
		s += ` in ${entity.in}`;
	} else if (entity.map) {
		s += ` on ${entity.map}`;
	}

	return s;
}