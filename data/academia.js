/* Hearthstead — academia (static data) */
'use strict';

const STUDY_DESK_FURNITURE_KEY='study_desk';
const BOOKCASE_FURNITURE_KEY='bookcase';

const FORESTRY_JOURNAL_BOOK_ID='forestry';
const FORESTRY_CH1_DOUBLE_LOG_PCT=10;
const FORESTRY_CH3_SPECIAL_LEAVES_PCT=8;
const SPECIAL_LEAVES_ITEM_KEY='special_leaves';
const INCINERATING_AXE_KEY='incinerating_axe';
const INCINERATING_AXE_INCINERATE_CHANCE=0.4;
const INCINERATING_AXE_WOODCUT_XP_MULT=3;

const ACADEMIA_XP_PER_PAGE_MULT=30;
const ACADEMIA_XP_BOOK_COMPLETE_MULT=900;

const ACADEMIA_POCKET_ITEMS={
  glistening:{ icon:'✨', name:'Glistening Shard' },
};

const ACADEMIA_BOOKS={
  gathering:{
    id:'gathering',
    name:'Gathering',
    icon:'🌿',
    unlockLevel:1,
    pageCount:8,
    mysteryPageKey:'gathering_page',
    pageItemPrefix:'gathering_page_',
    pageIcon:'📄',
  },
  forestry:{
    id:'forestry',
    name:'Forestry Journal Volume 1',
    icon:'📔',
    unlockLevel:1,
    pageCount:20,
    pageTiers:[
      { key:'faintly_scribbled_page', icon:'📄', name:'Faintly Scribbled Page', pageMin:1, pageMax:5, xpMult:1 },
      { key:'intricate_diagrams_page', icon:'📑', name:'Intricate Diagrams Page', pageMin:6, pageMax:15, xpMult:2 },
      { key:'dense_cryptic_page', icon:'📜', name:'Dense Cryptic Page', pageMin:16, pageMax:20, xpMult:5 },
    ],
  },
};

const ACADEMIA_MYSTERY_PAGES={
  gathering_page:{ key:'gathering_page', icon:'📄', name:'Gathering Page', bookId:'gathering' },
  faintly_scribbled_page:{ key:'faintly_scribbled_page', icon:'📄', name:'Faintly Scribbled Page', bookId:'forestry', pageMin:1, pageMax:5, xpMult:1 },
  intricate_diagrams_page:{ key:'intricate_diagrams_page', icon:'📑', name:'Intricate Diagrams Page', bookId:'forestry', pageMin:6, pageMax:15, xpMult:2 },
  dense_cryptic_page:{ key:'dense_cryptic_page', icon:'📜', name:'Dense Cryptic Page', bookId:'forestry', pageMin:16, pageMax:20, xpMult:5 },
};

/** Woodcut page drop table (wired in woodcutting — not yet hooked). */
const FORESTRY_WOODCUT_PAGE_DROPS={
  clearing:{ rollDenom:120, tierWeights:{ faintly_scribbled_page:60, intricate_diagrams_page:35, dense_cryptic_page:5 } },
  ashwood_grove:{ rollDenom:110, tierWeights:{ faintly_scribbled_page:60, intricate_diagrams_page:35, dense_cryptic_page:5 } },
  old_coppice:{ rollDenom:100, tierWeights:{ faintly_scribbled_page:60, intricate_diagrams_page:35, dense_cryptic_page:5 } },
};

/** Inventory items (mystery pages found in the world). Numbered pages live only on the desk. */
const ACADEMIA_PAGE_ITEMS={ ...ACADEMIA_MYSTERY_PAGES };

const ACADEMIA_ARTEFACT_EXAMINE={
  artefact_basic:{
    key:'artefact_basic',
    tierLabel:'Small',
    icon:'🏺',
    name:'Basic Artefact',
    academiaXp:50,
    glisteningShardChance:0.05,
    botanicalKey:'fossilised_sap',
    botanicalChance:0.33,
  },
  artefact_rare:{
    key:'artefact_rare',
    tierLabel:'Medium',
    icon:'🗿',
    name:'Rare Artefact',
    academiaXp:100,
    glisteningShardChance:0.15,
    botanicalKey:'preserved_root',
    botanicalChance:0.33,
  },
  artefact_extreme:{
    key:'artefact_extreme',
    tierLabel:'Rare',
    icon:'👑',
    name:'Extreme Artefact',
    academiaXp:200,
    glisteningShardChance:0.25,
    botanicalKey:'amber_sap',
    botanicalChance:0.33,
  },
};

const ACADEMIA_ARTEFACT_EXAMINE_ORDER=['artefact_basic','artefact_rare','artefact_extreme'];

const ACADEMIA_MAPS={
  wet:{
    id:'wet',
    name:'Wet Map',
    icon:'🗺️',
    pieceCount:9,
    gridCols:3,
    pieceDropDenoms:{
      1:100, 2:150, 3:200, 4:350, 5:400, 6:500, 7:1000, 8:1500, 9:2000,
    },
  },
};

const ACADEMIA_MAP_PIECE_ITEMS={};
Object.keys(ACADEMIA_MAPS).forEach((mapId)=>{
  const map=ACADEMIA_MAPS[mapId];
  for(let n=1;n<=map.pieceCount;n++){
    const key='wet_map_piece_'+n;
    ACADEMIA_MAP_PIECE_ITEMS[key]={ key, icon:'🧩', name:'Wet Map Piece '+n, mapId, pieceNum:n };
  }
});

const ACADEMIA_GLISTENING_SHARD_XP_BONUS=500;
const ACADEMIA_MAP_PIECE_XP_MULT=500;

function academiaMapPieceXpForPiece(pieceNum){
  return ACADEMIA_MAP_PIECE_XP_MULT*Math.max(1, pieceNum|0);
}
const ACADEMIA_ARTEFACT_NOTHING_EARTH_XP=15;

const ACADEMIA_ARTEFACT_NOTHING_FLAVOR=[
  'Under the lamp it is only packed mud and pebbles — something once called this an artefact.',
  'The crust flakes away to wet clay and grit. Whatever it was, it fooled you once.',
  'Stones and silt, nothing more. The shape was a trick of the riverbank drying wrong.',
  'You brush off the last of it: common mud, a few chips of rock. The rest was wishful thinking.',
];

function getPocketDisplayMeta(){
  const meta={ ...SHARD_META };
  Object.assign(meta, ACADEMIA_POCKET_ITEMS);
  const fp=typeof getFeatherPocketDisplayEntry==='function'?getFeatherPocketDisplayEntry():null;
  if(fp){
    meta[fp.key]={ icon:fp.icon, name:fp.name };
  }
  return meta;
}

function academiaNumberedPageLabel(book, pageNum){
  return (book?.name||'Book')+' Page '+pageNum;
}

function getAcademiaBookDef(bookId){
  return ACADEMIA_BOOKS[bookId]||null;
}

function getAcademiaMysteryPageDef(itemKey){
  return ACADEMIA_MYSTERY_PAGES[itemKey]||null;
}

function getAcademiaBookTierDef(bookId,tierKey){
  const book=getAcademiaBookDef(bookId);
  if(!book?.pageTiers) return null;
  return book.pageTiers.find((t)=>t.key===tierKey)||null;
}

function getAcademiaBookTierDefs(bookId){
  const book=getAcademiaBookDef(bookId);
  return book?.pageTiers||[];
}

function getAcademiaArtefactExamineDef(key){
  return ACADEMIA_ARTEFACT_EXAMINE[key]||null;
}

function getAcademiaMapDef(mapId){
  return ACADEMIA_MAPS[mapId]||null;
}

function getAcademiaMapPieceDropDenom(mapId, pieceNum){
  const map=getAcademiaMapDef(mapId);
  return map?.pieceDropDenoms?.[pieceNum]||null;
}

function academiaPageXpForBook(book){
  const lvl=book?.unlockLevel||1;
  return ACADEMIA_XP_PER_PAGE_MULT*lvl;
}

function academiaPageXpMultForTier(tierKey){
  if(!tierKey) return 1;
  const mystery=getAcademiaMysteryPageDef(tierKey);
  const tier=mystery||getAcademiaBookTierDef(mystery?.bookId, tierKey);
  const mult=(tier||mystery)?.xpMult;
  return typeof mult==='number'&&mult>0?mult:1;
}

function academiaPageXpForDeposit(book,tierKey){
  return academiaPageXpForBook(book)*academiaPageXpMultForTier(tierKey);
}

function academiaBookCompleteXpForBook(book){
  const lvl=book?.unlockLevel||1;
  return ACADEMIA_XP_BOOK_COMPLETE_MULT*lvl;
}

function rollArtefactExamineOutcome(def){
  if(!def) return 'nothing';
  const roll=Math.random();
  if(roll<def.glisteningShardChance) return 'shard';
  if(roll<def.glisteningShardChance+def.botanicalChance) return 'botanical';
  return 'nothing';
}

function pickArtefactNothingFlavor(){
  const lines=ACADEMIA_ARTEFACT_NOTHING_FLAVOR;
  return lines[Math.floor(Math.random()*lines.length)];
}

/** Book rewards managed in the bookcase — chapter unlock mirrors study desk completion. */
const BOOKCASE_REWARD_BOOKS={
  forestry:{
    bookId:'forestry',
    chapters:[
      { num:1, desc:'Bonus logs and woodcutting experience from successful harvests.' },
      { num:2, desc:'An auxiliary equipment slot on the woodcutting screen.' },
      { num:3, desc:'Rare special leaves found while chopping trees.' },
      { num:4, desc:'The Incinerating Axe recipe — burn timber for fire rewards.' },
    ],
  },
};

function getBookcaseRewardBookDef(bookId){
  return BOOKCASE_REWARD_BOOKS[bookId]||null;
}

function getBookcaseRewardBookOrder(){
  return Object.keys(BOOKCASE_REWARD_BOOKS);
}

function isForestryJournalChapterActive(chapterNum){
  return typeof isBookcaseChapterActive==='function'
    &&isBookcaseChapterActive(FORESTRY_JOURNAL_BOOK_ID, chapterNum|0);
}
