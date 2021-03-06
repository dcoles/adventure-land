// Item upgrades and compounding
// @ts-check
import * as Game from '/game.js';
import * as Util from '/util.js';

// Build a map of Quest IDs → NPC IDs
// If we can't find the NPC's location, assume we can exchange at Xyn
const QUEST_NPCS = new Map(Object.entries(G.npcs)
	.filter(([id, npc]) => npc.quest && find_npc(id))
	.map(([id, npc]) => [npc.quest, id]));

/**
 * Item grade.
 */
export const Grade = {
	COMMON: 0,
	HIGH: 1,
	RARE: 2,
	LEGENDARY: 3,
}

/**
 * Criteria for matching items.
 *
 * @typedef ItemCriteria
 * @property {string} [name] Item name/ID
 * @property {number} [level] Item level
 * @property {number} [max_grade] Maximum item grade
 * @property {boolean} [upgradeable] Is item upgradeable?
 * @property {boolean} [compoundable] Is item compoundable?
 * @property {boolean} [exchangeable] Is item exchangeable?
 */

 /**
  * @typedef ItemLocation
  * @property {number} slot Item slot index.
  * @property {string} [bank] If set, gives the name of the bank account.
  */

/**
 * Get indexed character items.
 *
 * @param {ItemCriteria} [criteria] Filter the returned items.
 * @returns {[number, Item][]} Array of `[index, item]` tuples.
*/
export function indexed_items(criteria) {
	criteria = criteria || {};
	return character.items.map((item, index) => [index, item]).filter(([_, item]) => match(item, criteria));
}

/**
 * Get current inventory items including location.
 *
 * @param {ItemCriteria} [criteria] Items must match this criteria.
 * @returns {[ItemLocation, Item][]} Array of `[item_location, item]` tuples.
 */
export function character_indexed_items(criteria) {
	criteria = criteria ?? {};
	return character.items.map((item, slot) => [{slot: slot}, item])
		.filter(([_, item]) => match(item, criteria));
}

/**
 * Get current bank items including location.
 *
 * @param {ItemCriteria} [criteria] Items must match this criteria.
 * @returns {[ItemLocation, Item][] | null} Array of `[item_location, item]` tuples or null if not in the bank.
 */
export function bank_indexed_items(criteria) {
	criteria = criteria ?? {};
	if (!character.bank) {
		return null;
	}

	const items = [];
	for (let [account_name, account_items] of Object.entries(character.bank)
		.filter(([name, _]) => name !== 'gold')) {

		items.push(...account_items.map((item, slot) => [{slot: slot, bank: account_name}, item])
			.filter(([_, item]) => match(item, criteria)));
	}

	return items;
}

/**
 * Find slot of an item.
 *
 * @param {ItemCriteria} criteria Criteria for matching item.
 * @returns {number} Inventory slot.
 */
export function find(criteria) {
	return character.items.findIndex((item) => match(item, criteria));
}

/**
 * Does this item match certain criteria?
 *
 * @param {AdventureLand.Item} item
 * @param {ItemCriteria} criteria
 */
export function match(item, criteria) {
	if (!item) {
		return false;
	}

	if (criteria.name && item.name !== criteria.name) {
		return false;
	}

	if (Number.isInteger(criteria.level) && item.level !== criteria.level) {
		return false;
	}

	if (Number.isInteger(criteria.max_grade) && grade(item) > criteria.max_grade) {
		return false;
	}

	if (criteria.upgradeable && !is_upgradeable(item)) {
		return false;
	}

	if (criteria.compoundable && !is_compoundable(item)) {
		return false;
	}

	if (criteria.exchangeable && !is_exchangeable(item)) {
		return false;
	}

	return true;
}

/**
 * Is this item upgradeable?
 *
 * @param {AdventureLand.Item} item Item ID (e.g. "helm")
 */
export function is_upgradeable(item) {
	return 'upgrade' in G.items[item.name];
}

/**
 * Is this item upgradeable?
 *
 * @param {AdventureLand.Item} item Item
 */
export function is_compoundable(item) {
	return 'compound' in G.items[item.name];
}

/**
 * Is this item exchangeable?
 *
 * @param {AdventureLand.Item} item Item object
 */
export function is_exchangeable(item) {
	// Check if we have at least the required number of items to exchange
	return item.q >= G.items[item.name].e;
}

/**
 * Calculate the value of a item stack.
 *
 * @param {AdventureLand.Item} item Item
 */
export function stack_value(item) {
	return (item.q || 1) * value(item);
}

/**
 * Calculate the value of a single item.
 *
 * @param {AdventureLand.Item} item Item
 */
export function value(item) {
	// By default, this is the price a merchant will pay
	return parent.calculate_item_value(item);
}

/**
 * Grade of an item.
 *
 * @param {AdventureLand.Item} item Item
 */
export function grade(item) {
	return window.item_grade(item);
}

/**
 * What is the minimum level for a certain grade of a particular item.
 * @param {AdventureLand.Item} item Item
 * @param {number} grade Item grade
 * @returns {number} Level
 */
export function min_level_for_grade(item, grade) {
	if (grade === Grade.COMMON) {
		return 0;
	}

	return G.items[item.name].grades[grade - 1];
}

/**
 * What is the minimum scroll level we must use to upgrade this item?
 *
 * @param {string} item_id Item ID (e.g. `"hpamulet"`).
 * @param {number} item_level Current item level.
 * @returns {number} Scroll level.
 */
export function scroll_level(item_id, item_level) {
	return G.items[item_id].grades.findIndex((g) => g > item_level);
}

/**
 * Swap the contents of two slots.
 *
 * @param {ItemLocation} a First slot
 * @param {ItemLocation} b Second slot
 * @returns {Promise} Resolves when swap completes.
 */
export async function swap(a, b) {
	if (a.bank && b.bank) {
		// Bank-Bank
		if (a.bank !== a.bank) {
			throw new Error('Not Implemented');
		}
		window.bank_move(a.bank, a.slot, b.slot)
	} else if (a.bank) {
		// Bank-Inventory
		window.bank_swap(a.bank, a.slot, b.slot);
	} else if (b.bank) {
		// Inventory-Bank
		window.bank_swap(b.bank, b.slot, a.slot);
	} else {
		// Inventory-Inventory
		window.swap(a.slot, b.slot);
	}

	await Game.next_event('player');
}

/**
 * Store item in bank.
 *
 * @param {number} slot Inventory source slot (0-41).
 * @param {string} account Bank account (e.g. "items0").
 * @param {number} [account_slot] Bank account destination slot (0-41; default: auto).
 * @returns {Promise} Resolves when item is stored.
 */
export async function store(slot, account, account_slot) {
	window.bank_store(slot, account, account_slot);

	const result = await Promise.race([Game.next_event('player'), Game.next_event('game_response', r => r === 'storage_full')]);
	if (Util.is_string(result)) {
		throw {reason: result};
	}
}

/**
 * Retrieve a list of items from the bank.
 *
 * @param {Array<[string, number]>} items Items to retrieve (pack, pack_slot).
 */
export async function retrieve_items(items) {
	let free_slot = -1;
	for (let [pack, pack_slot] of items) {
		free_slot = find_free_inventory_slot(free_slot);
		if (free_slot == -1) {
			break;
		}

		window.bank_retrieve(pack, pack_slot, free_slot);
	}

	await Game.next_event('player');
}

/**
 * Find empty inventory slot.
 *
 * @param {number} [after=-1] Find the next empty slot after this one.
 * @returns {number} Inventory index or -1 if no space available.
 */
export function find_free_inventory_slot(after) {
	after = after || -1;
	for (let i = after + 1; i < character.items.length; i++) {
		if (!character.items[i]) {
			return i;
		}
	}

	// No available space
	return -1;
}

/**
 * Find empty bank account slot.
 *
 * @param {string} account_name Account to search.
 * @returns {number} Account index or -1 if no space available.
 */
export function find_free_bank_slot(account_name) {
	if (!character.bank) {
		game_log('Not inside bank');
		return -1;
	}

	const account = character.bank[account_name];
	if (!account) {
		game_log(`No such account: ${account_name}`);
		return -1;
	}

	for (let i = 0; i < account.length; i++) {
		if (!account[i]) {
			return i;
		}
	}

	// No available space
	return -1;
}

/**
 * Find the NPC associated with a quest.
 *
 * @param {string} name Quest name.
 * @returns {string} NPC ID
 */
export function npc_for_quest(name) {
	return QUEST_NPCS.get(name) || 'exchange';
}

/**
 * Return string key for an item.
 *
 * @param {AdventureLand.Item} item Item.
 * @returns {string} String suitable for use as a key.
 */
export function key(item) {
	return item.level ? `${item.name}@${item.level}` : item.name;
}
