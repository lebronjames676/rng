# Hero RNG Tycoon

A 3D browser game: roll for blocky heroes, defend your town from waves of monsters, and spend the gold you earn on a hex upgrade tree that grows your town from a wooden hut to a stone castle.

## How to play

- **Roll** for heroes. Every hero has a "1 in N" chance, from the Villager (1 in 2) to Death Incarnate (1 in 1M). Rolls can also come out **Golden** (x2.5 damage) or **HUGE** (x4 damage, bigger).
- Heroes stand on the glowing pads around the Town Hall and attack monsters walking in from the portals. New heroes fill empty pads automatically; open **Heroes** to swap in stronger ones (a red `!` means a better hero is waiting).
- Every wave your town survives pays out gold. If enemies get through and the Town HP hits 0, you drop back a wave, so you can farm gold and roll for stronger heroes.
- Tap or click enemies to hit them yourself.
- Spend gold in **Upgrades**. Buying a hex reveals its neighbours. Branches:
  - **Rolling**: faster rolls, Auto Roll, Double and Triple Roll, offline rolls
  - **Luck**: more luck, Lucky Streak (every 10th roll), Golden and HUGE chances
  - **Combat**: up to 8 hero slots, damage, attack speed, range, crits
  - **Clicking**: click damage, splash, crits, auto clickers, Thunder Clicks
  - **Gold**: bounties, wave rewards, lucky coins, interest, treasure goblins
  - **Town**: houses, farms and markets for gold per second, palisade and stone walls for Town HP, cannons and watchtowers that fight for you, and the Stone Hall and Castle Keep
- Collect copies of the same hero to earn mastery stars, which make every copy stronger.
- Boss waves arrive every 10 waves.
- Progress saves in your browser automatically. While you're away your town keeps earning gold, and with Offline Rolls it keeps rolling too.

### Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Roll | Roll button | `Space` or `R` |
| Toggle Auto Roll | Auto button | `A` |
| Upgrades | Upgrades button | `U` |
| Heroes | Heroes button | `H` |
| Rotate camera | Drag | |
| Zoom | Scroll or pinch | |
| Close panels | X button | `Esc` |

## Running it

The game is plain HTML, CSS and JavaScript modules with no build step. Browsers only load modules over HTTP, so serve the folder instead of opening `index.html` directly:

```sh
python3 -m http.server 8080
# or
npx http-server -p 8080
```

Then open http://localhost:8080.

To publish it, enable GitHub Pages for the repository (Settings → Pages → deploy from the branch root).

## Project layout

```
index.html           page shell and HUD markup
style.css            all UI styling
src/main.js          wires everything together and runs the game loop
src/util.js          number formatting and small helpers
src/audio.js         synthesized sound effects
src/data/            heroes, enemies and the upgrade tree definitions
src/game/logic.js    rules: rolling, hero power, equipping, gold, saving
src/game/battle.js   waves, enemies, hero attacks, cannons, towers, clicks
src/world/           three.js scene, town builder, blocky character rigs, effects
src/ui/              upgrade tree, heroes panel, roll display, HUD
vendor/              three.js r185 (MIT licence)
```

Everything is drawn in code: characters are built from boxes, textures and faces are painted on canvases, and icons are inline SVG. There are no image or sound files.
