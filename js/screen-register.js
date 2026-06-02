/* Hearthstead — register all game screens (load after feature modules) */
'use strict';

(function registerBuiltInScreens() {
  registerScreen('intro-screen', { kind: 'base' });

  registerScreen('exterior-screen', {
    kind: 'base',
    goldId: 'gold-ext',
    invCountId: 'inv-count-ext',
  });

  registerScreen('interior-screen', {
    kind: 'base',
    goldId: 'gold-int',
    invCountId: 'inv-count-int',
    equipStatId: 'equip-val-int',
  });

  registerScreen('skills-screen', {
    kind: 'base',
    goldId: 'gold-sk',
    invCountId: 'inv-count-sk',
    onFlushScreen: () => {
      if (typeof viewingSkillKey !== 'undefined' && viewingSkillKey && typeof renderSkillDetail === 'function') {
        renderSkillDetail(viewingSkillKey);
      }
    },
  });

  registerScreen('workbench-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-wb',
    invCountId: 'inv-count-wb',
    equipStatId: 'equip-val-wb',
    skillPrefix: 'wb',
    skillResolver: () => RECIPES[craft.recipeKey]?.skill || 'carpentry',
    closeFn: () => {
      if (typeof closeWorkbench === 'function') closeWorkbench();
    },
  });

  registerScreen('storeroom-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-store',
    invCountId: 'inv-count-store',
    closeFn: () => {
      if (typeof closeStoreRoom === 'function') closeStoreRoom();
    },
    onFlushScreen: () => {
      if (typeof renderStoreRoom === 'function') renderStoreRoom();
    },
  });

  registerScreen('tool-store-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-toolstore',
    invCountId: 'inv-count-toolstore',
    closeFn: () => {
      if (typeof closeToolStoreScreen === 'function') closeToolStoreScreen();
    },
    onFlushScreen: () => {
      if (typeof renderToolStore === 'function') renderToolStore();
    },
  });

  registerScreen('fireplace-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-fp',
    invCountId: 'inv-count-fp',
    skillPrefix: 'fp',
    skillResolver: () => 'cooking',
    closeFn: () => {
      if (typeof closeFireplaceScreen === 'function') closeFireplaceScreen();
    },
  });

  registerScreen('spinningwheel-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-sw',
    invCountId: 'inv-count-sw',
    skillPrefix: 'sw',
    skillResolver: () => 'crafting',
    closeFn: () => {
      if (typeof closeSpinningWheelScreen === 'function') closeSpinningWheelScreen();
    },
  });

  registerScreen('loom-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-loom',
    invCountId: 'inv-count-loom',
    skillPrefix: 'loom',
    skillResolver: () => 'crafting',
    closeFn: () => {
      if (typeof closeLoomScreen === 'function') closeLoomScreen();
    },
  });

  registerScreen('botany-table-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-botany',
    invCountId: 'inv-count-botany',
    skillPrefix: 'botany',
    skillResolver: () =>
      typeof getApothecaryActivitySkillKey === 'function' ? getApothecaryActivitySkillKey() : 'botany',
    closeFn: () => {
      if (typeof closeBotanyTableScreen === 'function') closeBotanyTableScreen();
    },
  });

  registerScreen('crafting-desk-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-crafting-desk',
    invCountId: 'inv-count-crafting-desk',
    skillPrefix: 'crafting-desk',
    skillResolver: () => 'crafting',
    closeFn: () => {
      if (typeof closeCraftingDeskScreen === 'function') closeCraftingDeskScreen();
    },
    onFlushScreen: () => {
      if (typeof renderCraftingDeskScreen === 'function') renderCraftingDeskScreen();
    },
  });

  registerScreen('study-desk-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-study',
    invCountId: 'inv-count-study',
    skillPrefix: 'study',
    skillResolver: () => 'academia',
    closeFn: () => {
      if (typeof closeStudyDeskScreen === 'function') closeStudyDeskScreen();
    },
    onFlushScreen: () => {
      if (typeof renderStudyDeskScreen === 'function') renderStudyDeskScreen();
    },
  });

  registerScreen('bookcase-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-bookcase',
    invCountId: 'inv-count-bookcase',
    skillPrefix: 'bookcase',
    skillResolver: () => 'academia',
    closeFn: () => {
      if (typeof closeBookcaseScreen === 'function') closeBookcaseScreen();
    },
    onFlushScreen: () => {
      if (typeof renderBookcaseScreen === 'function') renderBookcaseScreen();
    },
  });

  registerScreen('pets-screen', {
    kind: 'hut-overlay',
    goldId: 'gold-pets',
    invCountId: 'inv-count-pets',
    skillPrefix: 'pets',
    skillResolver: () => 'husbandry',
    closeFn: () => {
      if (typeof closePetsScreen === 'function') closePetsScreen();
    },
    onFlushScreen: () => {
      if (typeof renderPetsScreen === 'function') renderPetsScreen(viewingPetId);
    },
  });

  registerScreen('fishing-screen', {
    kind: 'world-overlay',
    goldId: 'gold-fish',
    invCountId: 'inv-count-fish',
    skillPrefix: 'fish',
    skillResolver: () =>
      typeof getFishingActivitySkillKey === 'function' ? getFishingActivitySkillKey() : 'fishing',
    closeFn: () => {
      if (typeof closeFishing === 'function') closeFishing();
    },
  });

  registerScreen('gathering-screen', {
    kind: 'world-overlay',
    goldId: 'gold-gather',
    invCountId: 'inv-count-gather',
    skillPrefix: 'gather',
    skillResolver: () => 'foraging',
    closeFn: () => {
      if (typeof closeGathering === 'function') closeGathering();
    },
  });

  registerScreen('woodcutting-screen', {
    kind: 'world-overlay',
    goldId: 'gold-wc',
    invCountId: 'inv-count-wc',
    skillPrefix: 'wc',
    skillResolver: () => 'woodcut',
    closeFn: () => {
      if (typeof closeWoodcutting === 'function') closeWoodcutting();
    },
  });

  registerScreen('mining-screen', {
    kind: 'world-overlay',
    goldId: 'gold-mine',
    invCountId: 'inv-count-mine',
    skillPrefix: 'mine',
    skillResolver: () => 'mining',
    closeFn: () => {
      if (typeof closeMining === 'function') closeMining();
    },
  });

  registerScreen('exploring-screen', {
    kind: 'world-overlay',
    goldId: 'gold-explore',
    invCountId: 'inv-count-explore',
    skillPrefix: 'explore',
    skillResolver: () => 'exploration',
    closeFn: () => {
      if (typeof closeExploring === 'function') closeExploring();
    },
    onFlushScreen: () => {
      if (typeof renderExploring === 'function') renderExploring();
    },
  });

  registerScreen('well-screen', {
    kind: 'world-overlay',
    goldId: 'gold-well',
    invCountId: 'inv-count-well',
    closeFn: () => {
      if (typeof closeWellScreen === 'function') closeWellScreen();
    },
  });

  registerScreen('fire-pit-screen', {
    kind: 'world-overlay',
    goldId: 'gold-firepit',
    invCountId: 'inv-count-firepit',
    skillPrefix: 'firepit',
    skillResolver: () =>
      typeof getFirePitActivitySkillKey === 'function' ? getFirePitActivitySkillKey() : 'cooking',
    closeFn: () => {
      if (typeof closeFirePitScreen === 'function') closeFirePitScreen();
    },
  });

  registerScreen('kiln-screen', {
    kind: 'world-overlay',
    goldId: 'gold-kiln',
    invCountId: 'inv-count-kiln',
    skillPrefix: 'kiln',
    skillResolver: () =>
      typeof getKilnActivitySkillKey === 'function' ? getKilnActivitySkillKey() : 'crafting',
    closeFn: () => {
      if (typeof closeKilnScreen === 'function') closeKilnScreen();
    },
  });

  registerScreen('washing-line-screen', {
    kind: 'world-overlay',
    goldId: 'gold-washing-line',
    invCountId: 'inv-count-washing-line',
    skillPrefix: 'washing-line',
    skillResolver: () => 'air',
    closeFn: () => {
      if (typeof closeWashingLineScreen === 'function') closeWashingLineScreen();
    },
  });

  registerScreen('whisper-camp-screen', {
    kind: 'world-overlay',
    goldId: 'gold-whisper-camp',
    invCountId: 'inv-count-whisper-camp',
    skillPrefix: 'whisper-camp',
    skillResolver: () => 'architecture',
    closeFn: () => {
      if (typeof closeWhisperCampScreen === 'function') closeWhisperCampScreen();
    },
  });

  registerScreen('coastal-docks-screen', {
    kind: 'world-overlay',
    goldId: 'gold-coastal-docks',
    invCountId: 'inv-count-coastal-docks',
    skillPrefix: 'coastal-docks',
    skillResolver: () => 'architecture',
    closeFn: () => {
      if (typeof closeCoastalDocksScreen === 'function') closeCoastalDocksScreen();
    },
  });

  registerScreen('barn-screen', {
    kind: 'world-overlay',
    goldId: 'gold-barn',
    invCountId: 'inv-count-barn',
    skillPrefix: 'barn',
    skillResolver: () =>
      typeof getBarnActivitySkillKey === 'function' ? getBarnActivitySkillKey() : 'architecture',
    closeFn: () => {
      if (typeof closeBarnScreen === 'function') closeBarnScreen();
    },
  });

  registerScreen('barn-interior-screen', {
    kind: 'base',
    goldId: 'gold-barn-int',
    invCountId: 'inv-count-barn-int',
    closeFn: () => {
      if (typeof exitBarnInterior === 'function') exitBarnInterior();
    },
    onLeave: (nextId) => {
      if (nextId !== 'barn-interior-screen' && typeof closeBarnInteriorPlaceMenu === 'function') {
        closeBarnInteriorPlaceMenu();
      }
    },
  });

  registerScreen('farming-screen', {
    kind: 'world-overlay',
    goldId: 'gold-farm',
    invCountId: 'inv-count-farm',
    skillPrefix: 'farm',
    skillResolver: () => 'botany',
    closeFn: () => {
      if (typeof closeFarmScreen === 'function') closeFarmScreen();
    },
    onLeave: (nextId) => {
      if (nextId !== 'farming-screen' && typeof stopFarmTimer === 'function') stopFarmTimer();
    },
  });
})();
