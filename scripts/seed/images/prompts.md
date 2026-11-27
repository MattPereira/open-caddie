# Seed image prompts

Issue: https://github.com/MattPereira/open-caddie/issues/258

## Workflow

Use the Codex harness built-in `image_gen` tool, one call per asset. No AI Gateway or generation at seed/build time. Copy originals from returned tool paths into gitignored `scripts/seed/images/raw/` using the exact filenames below. Final optimized assets are committed under `public/seed/`; app/seed builds need no generation credentials or raw files.

The user approved the first three samples before the remaining batch. AI regeneration is not byte-identical; compression is deterministic for the same raw inputs and pinned Sharp version. After copying all 22 PNG originals, run `pnpm seed:images` from the repository root, or `pnpm seed:images /path/to/raw`. Output: 16 avatars (256px, ≤30 KiB), five landscapes (1600×600px, ≤200 KB), one transparent crest (512px), six SVG scorecards. Landscapes use a panoramic center crop so the greens survive the existing bottom-aligned Course hero. The command fails if an image exceeds its budget or `public/seed/` exceeds 3 MB.

Scorecard SVGs derive only from `scripts/seed/world/course-data.ts`; never generate numbers with AI. The original table layout includes per-hole yardages, pars, stroke indexes, nine-hole and full totals, men's ratings and slopes. Limitations remain in `docs/seed/course-sources.md` and are noted on each card. These are seed reference cards, not official designs.

Intentional fallbacks: Vijay Swing, Max Bogey and Adam Scotty have no avatars; Pat Admin retains its default. Bethpage Black has no landscape; Handicap Hustlers has no crest. All six Courses have scorecard SVGs. `scripts/seed/world/image-data.ts` is the shared asset manifest for seed wiring and compression.

## Panther Woods

Target: `public/seed/players/panther-woods.webp`

Raw: `scripts/seed/images/raw/panther-woods.png`

Use case: illustration-story. Create one square avatar illustration for Panther Woods, a fictional adult amateur golfer, age about 38, medium-dark brown skin, short close-cropped black hair, distinct rounded face, small friendly smile, calm focused demeanor, wearing an unbranded deep red golf polo and plain dark cap. A distinct invented character, NOT a portrait or direct likeness of any real professional. Ghibli-inspired hand-painted anime aesthetic, expressive warm eyes, delicate ink outlines, soft gouache shading, lush softly blurred golf greenery behind him, warm afternoon sunlight. Shared seed artwork palette: forest green, warm cream, muted golden yellow, terracotta red. Head-and-shoulders front three-quarter view, centered, head and cap entirely within central 70 percent with generous breathing room; must survive circular avatar crop and remain clear at 256px. Grounded golf clothing. No text, logos, watermark, golf clubs crossing face, or border.

## Pebble Beach Golf Links

Target: `public/seed/courses/pebble-beach.webp`

Raw: `scripts/seed/images/raw/pebble-beach.png`

Use case: illustration-story. Create a wide 3:2 landscape painting for the golf course Pebble Beach Golf Links in Monterey, California: an evocative view of its tiny seventh-hole putting green perched above rugged ocean cliffs, gently undulating closely mown green, one slender pin with small flag, a pale sandy bunker tucked beside the green, cypress trees inland, blue-green Pacific surf and white foam along rocky shoreline. Geographically grounded golf landscape, an interpretation rather than an exact surveyed course diagram. Ghibli-inspired lush hand-painted anime background art, delicate ink details, atmospheric gouache and watercolor textures, warm afternoon sunlight and luminous distant sea. Shared seed artwork palette: forest green, warm cream, muted golden yellow, terracotta accents and natural sea blues. Strong landscape composition with the green and coastline visible within the middle horizontal band so it survives a wide card crop. No people, architecture clutter, text, lettering, branding, watermark, frame or official scorecard.

## Mulligan Mafia

Target: `public/seed/clubs/mulligan-mafia.webp`

Raw: `scripts/seed/images/raw/mulligan-mafia.png`

Use case: logo-brand. Create one square illustrated golf SOCIETY crest for the fictional amateur social club Mulligan Mafia (not golf equipment). A simple friendly heraldic shield, forest-green field, warm cream thick outline, two crossed golf irons with recognizable small iron heads behind a single white dimpled golf ball, small muted gold accent. One broad cream ribbon across the lower shield bearing ONLY the exact readable text 'MULLIGAN MAFIA' in dark green bold clean uppercase lettering. Hand-painted anime storybook charm inspired by Ghibli, restrained gouache texture, simple confident shapes, grounded golf details, warm palette matching lush golf landscape paintings. Centered compact emblem fully contained within central 75 percent of canvas with ample transparent margin; silhouette and ball recognizable at small avatar size, text legible at 512px. Transparent background outside crest. No extra text, dates, slogans, monograms, gangster weapons, skulls, mockup, scenery or watermark.

## John Nightly

Target: `public/seed/players/john-nightly.webp`

Raw: `scripts/seed/images/raw/john-nightly.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: John Nightly, a stocky white man in his late 50s, wavy silver-blond hair, friendly broad face, short silver beard, mischievous smile, patterned muted tropical golf shirt.

## Scottie Shuffler

Target: `public/seed/players/scottie-shuffler.webp`

Raw: `scripts/seed/images/raw/scottie-shuffler.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Scottie Shuffler, a tall-looking white man in his early 30s, tousled dark brown hair, round cheeks, clean shaven, shy easy grin, forest-green polo and cream cap.

## Rory McEagle

Target: `public/seed/players/rory-mceagle.webp`

Raw: `scripts/seed/images/raw/rory-mceagle.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Rory McEagle, an Irish white man in his early 30s, thick curly chestnut hair, freckles, lively warm eyes, compact face, navy polo, no cap.

## Phil Nickelson

Target: `public/seed/players/phil-nickelson.webp`

Raw: `scripts/seed/images/raw/phil-nickelson.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Phil Nickelson, a white man in his early 50s, swept-back dark hair with gray temples, square friendly face, raised eyebrows, relaxed grin, dark green polo, no cap.

## Tyson DeShambles

Target: `public/seed/players/tyson-deshambles.webp`

Raw: `scripts/seed/images/raw/tyson-deshambles.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Tyson DeShambles, a muscular white man in his early 30s, sandy brown hair, short tidy beard, analytical expression softened with a smile, cream flat cap, muted blue golf polo.

## Rivers Koepka

Target: `public/seed/players/rivers-koepka.webp`

Raw: `scripts/seed/images/raw/rivers-koepka.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Rivers Koepka, a broad-shouldered white man in his mid 30s, dark buzz cut, thick eyebrows, close beard, quietly confident smile, terracotta polo, no cap.

## Dustin Thomas

Target: `public/seed/players/dustin-thomas.webp`

Raw: `scripts/seed/images/raw/dustin-thomas.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Dustin Thomas, a slim white man in his early 30s, short light brown hair, long oval face, neat clean-shaven look, cheerful expression, cream polo and forest-green cap.

## Justin Johnson

Target: `public/seed/players/justin-johnson.webp`

Raw: `scripts/seed/images/raw/justin-johnson.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Justin Johnson, a white man in his late 30s, dark brown hair, full short dark beard, strong nose, laid-back smile, slate blue polo and plain cream cap.

## Jordan Slice

Target: `public/seed/players/jordan-slice.webp`

Raw: `scripts/seed/images/raw/jordan-slice.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Jordan Slice, a white man in his early 30s, light brown short hair, high forehead, round kind face, earnest smile, muted sky-blue polo and cream visor.

## Rickie Fowleri

Target: `public/seed/players/rickie-fowleri.webp`

Raw: `scripts/seed/images/raw/rickie-fowleri.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Rickie Fowleri, a Japanese-American man in his early 30s, medium warm skin, thick dark slightly shaggy hair beneath plain orange cap, small mustache, bright friendly grin, muted orange polo.

## Bubba Wattson

Target: `public/seed/players/bubba-wattson.webp`

Raw: `scripts/seed/images/raw/bubba-wattson.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Bubba Wattson, a lanky white man in his early 40s, floppy dark wavy hair, long face, expressive eyes, playful smile, pale dusty rose polo, no cap.

## Arnold Lemonade

Target: `public/seed/players/arnold-lemonade.webp`

Raw: `scripts/seed/images/raw/arnold-lemonade.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Arnold Lemonade, a white man in his late 60s, silver combed hair, weathered face, deep smile lines, warmly amused eyes, muted gold polo, no cap.

## Jack Nickel

Target: `public/seed/players/jack-nickel.webp`

Raw: `scripts/seed/images/raw/jack-nickel.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Jack Nickel, a white man in his mid 60s, wavy silver-blond hair, broad round face, warm self-assured smile, cream cable-knit golf vest over a pale green polo, no cap.

## Jon Ram

Target: `public/seed/players/jon-ram.webp`

Raw: `scripts/seed/images/raw/jon-ram.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Jon Ram, a stocky Spanish man in his mid 30s, olive skin, thick dark short hair, bushy trimmed beard, kind strong eyebrows, reserved smile, forest-green polo, no cap.

## Collin Mulligan

Target: `public/seed/players/collin-mulligan.webp`

Raw: `scripts/seed/images/raw/collin-mulligan.png`

Use case: illustration-story. Create ONE square head-and-shoulders avatar for a fictional ADULT amateur golfer. Ghibli-inspired hand-painted anime aesthetic matching a warm red-polo golfer portrait: expressive warm eyes, delicate ink outlines, soft gouache shading and visible paper texture, softly blurred lush golf greenery, warm afternoon sunlight. Shared palette forest green, warm cream, muted golden yellow, terracotta red. Centered face and entire head/cap within central 70 percent with generous breathing room for circular avatar crop. Recognizable at 256px. Grounded golf clothes. Invent a distinct fictional character, NOT a direct likeness of a real person. No text, branding, watermark, border or equipment across face. Subject: Collin Mulligan, an East Asian American man in his late 20s, straight short black hair neatly swept aside, slim clean-shaven face, calm bright smile, cream polo with muted green collar, no cap.

## TPC Sawgrass THE PLAYERS Stadium Course

Target: `public/seed/courses/tpc-sawgrass.webp`

Raw: `scripts/seed/images/raw/tpc-sawgrass.png`

Use case: illustration-story. Create one wide 3:2 golf landscape painting, matching a warm hand-painted Pebble Beach coastal painting. Ghibli-inspired lush anime background art, delicate ink details, atmospheric gouache and watercolor paper textures, luminous natural daylight. Shared palette forest green, warm cream, muted golden yellow with natural sky and water blues. Grounded golf details, evocative geographic interpretation rather than an exact surveyed diagram. Keep green and main scenery in central horizontal band to survive a wide card crop. No people, text, branding, watermark, frame or official scorecard. Course: TPC Sawgrass THE PLAYERS Stadium Course. Florida stadium golf: a small island seventeenth putting green surrounded by blue water, a narrow connecting walkway, white sand bunker at green edge, distant palms and pines.

## Kapalua Plantation Course

Target: `public/seed/courses/kapalua-plantation.webp`

Raw: `scripts/seed/images/raw/kapalua-plantation.png`

Use case: illustration-story. Create one wide 3:2 golf landscape painting, matching a warm hand-painted Pebble Beach coastal painting. Ghibli-inspired lush anime background art, delicate ink details, atmospheric gouache and watercolor paper textures, luminous natural daylight. Shared palette forest green, warm cream, muted golden yellow with natural sky and water blues. Grounded golf details, evocative geographic interpretation rather than an exact surveyed diagram. Keep green and main scenery in central horizontal band to survive a wide card crop. No people, text, branding, watermark, frame or official scorecard. Course: Kapalua Plantation Course. Maui hillside: sweeping downhill fairways, a smoothly mown green with small flag, pale sand bunkers, tropical greenery and distant islands across the Pacific.

## Mauna Kea Golf Course

Target: `public/seed/courses/mauna-kea.webp`

Raw: `scripts/seed/images/raw/mauna-kea.png`

Use case: illustration-story. Create one wide 3:2 golf landscape painting, matching a warm hand-painted Pebble Beach coastal painting. Ghibli-inspired lush anime background art, delicate ink details, atmospheric gouache and watercolor paper textures, luminous natural daylight. Shared palette forest green, warm cream, muted golden yellow with natural sky and water blues. Grounded golf details, evocative geographic interpretation rather than an exact surveyed diagram. Keep green and main scenery in central horizontal band to survive a wide card crop. No people, text, branding, watermark, frame or official scorecard. Course: Mauna Kea Golf Course. Hawaiʻi Kohala coast: third-hole green across a rocky ocean inlet, dark black lava shore, green grass, palms, turquoise Pacific and breaking white surf.

## Royal County Down Championship Links

Target: `public/seed/courses/royal-county-down.webp`

Raw: `scripts/seed/images/raw/royal-county-down.png`

Use case: illustration-story. Create one wide 3:2 golf landscape painting, matching a warm hand-painted Pebble Beach coastal painting. Ghibli-inspired lush anime background art, delicate ink details, atmospheric gouache and watercolor paper textures, luminous natural daylight. Shared palette forest green, warm cream, muted golden yellow with natural sky and water blues. Grounded golf details, evocative geographic interpretation rather than an exact surveyed diagram. Keep green and main scenery in central horizontal band to survive a wide card crop. No people, text, branding, watermark, frame or official scorecard. Course: Royal County Down Championship Links. Northern Ireland links: undulating dunes, purple heather, golden gorse, bearded bunkers, a green with slender flag, distant Mourne Mountains and Dundrum Bay.
