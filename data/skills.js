/* Hearthstead — skills (static data) */
'use strict';

const SKILL_META={
  woodcut:  {icon:'🪓',name:'Woodcutting',color:'#a06030', blurb:'Chop trees and gather wood.'},
  foraging: {icon:'🌿',name:'Foraging',   color:'#6aaa40', blurb:'Find wild plants and resources.'},
  fishing:  {icon:'🎣',name:'Fishing',    color:'#50a0e0', blurb:'Catch fish from ponds, rivers, and oceans.'},
  mining:   {icon:'⛏️',name:'Mining',     color:'#808080', blurb:'Strike the quarry and haul stone from the earth.'},
  carpentry:{icon:'🪚',name:'Carpentry (items)', color:'#a06030', blurb:'Craft furniture, tools, and household items.'},
  metalworking:{icon:'⚒️',name:'Metalworking',color:'#7890a8', blurb:'Smelt ore and shape nails, tools, and armour at the kiln.'},
  crafting:{icon:'🛠️',name:'Crafting',color:'#c07090', blurb:'Fabrics, pottery, and glasswork.'},
  architecture:{icon:'🏗️',name:'Architecture (structures)',color:'#a89070', blurb:'Plan and build structures — unlock a Builder\'s House at higher levels.'},
  cooking:  {icon:'🍳',name:'Cooking',    color:'#e88030', blurb:'Prepare meals at the hearth and campfire.'},
  botany:   {icon:'🌱',name:'Botany',     color:'#58a868', blurb:'Grow, prepare, and craft with plants and fibers.'},
  husbandry:{icon:'🐾',name:'Husbandry', color:'#d08028', blurb:'Care for animals and companions.'},
  design:   {icon:'🎨',name:'Design',     color:'#d040d0', blurb:'Decorate and refine your home.'},
  exploration:{icon:'🧭',name:'Exploration',color:'#a080e0', blurb:'Expand the edges of your plot.'},
  knowledge:{icon:'📖',name:'Knowledge',  color:'#6890c8', blurb:'Study, learn, and understand the world around you.'},
  magic:    {icon:'✨',name:'Magic',      color:'#9040c0', blurb:'Channel arcane power — pocket shards will matter later.'},
  air:      {icon:'🌬️',name:'Air',        color:'#70b8d8', blurb:'Harness wind and sky — your air affinity grows with the breeze.'},
  earth:    {icon:'🪨',name:'Earth',      color:'#8a6840', blurb:'Root yourself in stone and soil — earth affinity deepens with the land.'},
  fire:     {icon:'🔥',name:'Fire',       color:'#e85030', blurb:'Kindle inner flame — fire affinity grows with heat and hearth.'},
  water:    {icon:'💧',name:'Water',      color:'#4080d0', blurb:'Flow with rivers and rain — water affinity deepens with every drop.'},
};

const SKILL_CATEGORIES=[
  { id:'collecting', label:'Collecting', skills:['woodcut','foraging','fishing','mining'] },
  { id:'crafting', label:'Crafting', skills:['carpentry','metalworking','crafting','architecture','cooking','botany'] },
  { id:'character', label:'Character', skills:['husbandry','design','exploration','knowledge','magic'] },
  { id:'affinities', label:'Affinities', skills:['air','earth','fire','water'] },
];
