/**
 * wordFindingPrompts.js
 *
 * Curated semantic-cue prompts for the word-finding task. Grounded in
 * cognitive-communication rehabilitation (Norman et al., 2019–2023 — see
 * project doc Section 7), not classical aphasia naming batteries.
 *
 * Each prompt presents a descriptive cue; the player retrieves and types
 * the target word. acceptable[] holds case-insensitive aliases (e.g.
 * "fall" and "autumn" for the same cue).
 */

const WORD_FINDING_PROMPTS = Object.freeze([
  { id: "wf-01", cue: "A common pet that barks and wags its tail", target: "dog", acceptable: ["dog", "dogs", "puppy"] },
  { id: "wf-02", cue: "The room in a home where you cook meals", target: "kitchen", acceptable: ["kitchen"] },
  { id: "wf-03", cue: "What you use to cut paper or fabric", target: "scissors", acceptable: ["scissors", "scissor"] },
  { id: "wf-04", cue: "The season when leaves change color and fall", target: "autumn", acceptable: ["autumn", "fall"] },
  { id: "wf-05", cue: "A large gray animal with a long trunk", target: "elephant", acceptable: ["elephant", "elephants"] },
  { id: "wf-06", cue: "The opposite of hot", target: "cold", acceptable: ["cold", "cool"] },
  { id: "wf-07", cue: "A yellow fruit that monkeys are often pictured eating", target: "banana", acceptable: ["banana", "bananas"] },
  { id: "wf-08", cue: "What you wear on your feet inside shoes", target: "socks", acceptable: ["socks", "sock"] },
  { id: "wf-09", cue: "The star at the center of our solar system", target: "sun", acceptable: ["sun", "the sun"] },
  { id: "wf-10", cue: "A place where books are borrowed for free", target: "library", acceptable: ["library", "libraries"] },
  { id: "wf-11", cue: "What you call the meal eaten in the morning", target: "breakfast", acceptable: ["breakfast"] },
  { id: "wf-12", cue: "A flying insect that makes honey", target: "bee", acceptable: ["bee", "bees"] },
  { id: "wf-13", cue: "The color of grass and most leaves", target: "green", acceptable: ["green"] },
  { id: "wf-14", cue: "What you use to write on a blackboard", target: "chalk", acceptable: ["chalk"] },
  { id: "wf-15", cue: "A vehicle with two wheels that you pedal", target: "bicycle", acceptable: ["bicycle", "bike", "bikes"] },
  { id: "wf-16", cue: "Frozen water in solid form", target: "ice", acceptable: ["ice"] },
  { id: "wf-17", cue: "The person who delivers mail to your home", target: "mail carrier", acceptable: ["mail carrier", "mailman", "postman", "postal worker", "letter carrier"] },
  { id: "wf-18", cue: "What you breathe in that fills balloons", target: "air", acceptable: ["air"] },
  { id: "wf-19", cue: "A round object used in soccer and basketball", target: "ball", acceptable: ["ball", "balls"] },
  { id: "wf-20", cue: "The day of the week that comes after Monday", target: "tuesday", acceptable: ["tuesday", "tues"] },
  { id: "wf-21", cue: "What you use to unlock a door", target: "key", acceptable: ["key", "keys"] },
  { id: "wf-22", cue: "A body of water smaller than an ocean", target: "lake", acceptable: ["lake", "lakes"] },
  { id: "wf-23", cue: "The person who fixes teeth", target: "dentist", acceptable: ["dentist", "dentists"] },
  { id: "wf-24", cue: "What you call a young cat", target: "kitten", acceptable: ["kitten", "kittens", "kitty"] },
]);

export { WORD_FINDING_PROMPTS };
