// Frei lizenziertes Gameplay aus Open-Source-Spielen, gehostet auf Wikimedia Commons (CORS-fähig).
// Die Lizenzangaben stammen von den jeweiligen Commons-Dateiseiten und werden automatisch in die
// YouTube-Beschreibung übernommen.

const T = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/';

export const OPEN_GAMEPLAY = [
  {
    id: 'supertux-coins',
    game: 'SuperTux',
    title: 'SuperTux – Level 1, alle Münzen',
    genre: 'Jump ’n’ Run',
    duration: 64,
    size: 7.7e6,
    url: T + '6/66/SuperTux_level_1_all_coins_run.webm/SuperTux_level_1_all_coins_run.webm.480p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:SuperTux_level_1_all_coins_run.webm',
    author: 'Dabmasterars; SuperTux Development Team',
    license: 'GPL',
  },
  {
    id: 'supertux-pacifist',
    game: 'SuperTux',
    title: 'SuperTux – Level 1, Pazifist-Run',
    genre: 'Jump ’n’ Run',
    duration: 37,
    size: 4.5e6,
    url: T + 'b/b3/SuperTux_level_1_pacifist_run.webm/SuperTux_level_1_pacifist_run.webm.480p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:SuperTux_level_1_pacifist_run.webm',
    author: 'Dabmasterars; SuperTux Development Team',
    license: 'GPL',
  },
  {
    id: 'voxelibre',
    game: 'VoxeLibre (MineClone2)',
    title: 'VoxeLibre / MineClone2 – Minecraft-artiges Gameplay',
    genre: 'Voxel / Minecraft-Stil',
    duration: 86,
    size: 37e6,
    url: T + '9/92/MineClone2_-_Release_0.84_-_The_Very_Nice_Release.webm/MineClone2_-_Release_0.84_-_The_Very_Nice_Release.webm.1080p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:MineClone2_-_Release_0.84_-_The_Very_Nice_Release.webm',
    author: 'VoxeLibre',
    license: 'CC BY 3.0',
  },
  {
    id: 'minetest-bouncy',
    game: 'Minetest / Luanti',
    title: 'Minetest – Hüpfblöcke',
    genre: 'Voxel / Minecraft-Stil',
    duration: 113,
    size: 73e6,
    url:
      T +
      'f/f2/Devtest_Minetest_5.6.1_Bouncy_node_160%25_2023.01.04_-_20.33.06.05.webm/Devtest_Minetest_5.6.1_Bouncy_node_160%25_2023.01.04_-_20.33.06.05.webm.1080p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:Devtest_Minetest_5.6.1_Bouncy_node_160%25_2023.01.04_-_20.33.06.05.webm',
    author: 'Video: PantheraLeo1359531; Spiel: The Minetest Team',
    license: 'CC BY-SA 3.0',
  },
  {
    id: 'veloren',
    game: 'Veloren',
    title: 'Veloren – Voxel-RPG',
    genre: 'Voxel / Action-RPG',
    duration: 121,
    size: 71e6,
    url: T + 'b/b6/Gameplay_Veloren_2023.02.09_-_16.17.16.03.webm/Gameplay_Veloren_2023.02.09_-_16.17.16.03.webm.1080p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:Gameplay_Veloren_2023.02.09_-_16.17.16.03.webm',
    author: 'Video: PantheraLeo1359531; Spiel: Veloren community and Veloren team',
    license: 'GPLv3',
  },
  {
    id: 'xonotic',
    game: 'Xonotic',
    title: 'Xonotic 0.8.2 – Arena-Shooter',
    genre: 'Shooter',
    duration: 183,
    size: 31e6,
    url: T + 'b/b9/Xonotic_0-8-2_gameplay.webm/Xonotic_0-8-2_gameplay.webm.480p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:Xonotic_0-8-2_gameplay.webm',
    author: 'Drummyfish, Xonotic developers',
    license: 'GPLv3',
  },
  {
    id: 'mindustry',
    game: 'Mindustry',
    title: 'Mindustry – Fabrik & Tower-Defense',
    genre: 'Strategie',
    duration: 45,
    size: 33e6,
    url:
      T +
      'd/d7/Mindustry_159.6_screencast_-_Debian_GNU_Linux_-_Flatpak_-_Serpulo_-_Planetary_Launch_Terminal_-_testing_conveyors%2C_ammunition%2C_turrets%2C_spaceships.webm/Mindustry_159.6_screencast_-_Debian_GNU_Linux_-_Flatpak_-_Serpulo_-_Planetary_Launch_Terminal_-_testing_conveyors%2C_ammunition%2C_turrets%2C_spaceships.webm.1080p.vp9.webm',
    page: 'https://commons.wikimedia.org/wiki/File:Mindustry_159.6_screencast_-_Debian_GNU_Linux_-_Flatpak_-_Serpulo_-_Planetary_Launch_Terminal_-_testing_conveyors,_ammunition,_turrets,_spaceships.webm',
    author: 'Valerio Bozzolan; Spiel: Anuken und Mindustry-Mitwirkende',
    license: 'GPLv3',
  },
];

export function creditLine(item) {
  return `Gameplay: „${item.title}“ von ${item.author} (${item.license}) – ${item.page}`;
}

/** Lädt einen Clip herunter und meldet den Fortschritt (0..1). */
export async function downloadClip(item, onProgress, signal) {
  const res = await fetch(item.url, { signal });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length')) || item.size;
  const reader = res.body.getReader();
  const parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    onProgress?.(Math.min(1, loaded / total));
  }
  const name = `${item.game} – ${item.title.split('–').pop().trim()}.webm`.replace(/[\\/:*?"<>|]/g, '');
  return new File(parts, name, { type: 'video/webm' });
}
