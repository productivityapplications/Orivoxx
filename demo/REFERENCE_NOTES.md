# Reference video notes

Source: `demo/reference/reference.mp4` (organizer-provided reference, not redistributed; gitignored).

## Technical

| Property | Value |
|---|---|
| Duration | 2:33 (153.0 s) |
| Resolution | 1280 × 720 |
| Frame rate | 30 fps |
| Video | H.264 |
| Audio | AAC, 48 kHz, stereo |
| Size | 8.9 MB |

## What the reference does

- A single narration track carries the whole story; the visuals follow the voice, not the reverse.
- Every visual is a real screen recording inside a rounded browser frame, usually on a soft gradient background.
- Large lower-third captions repeat the narration in short phrases (3–7 words), advancing every few seconds.
- Occasional full-frame title cards carry one question or statement in heavy type.
- Cuts are hard. There are no crossfades, no stock footage, no talking head, no mascot.
- Scenes change every 5–8 seconds; the longest hold is a scroll through one product surface.
- The ending returns to the product, not to a logo animation.

## What we reuse

- Narration-led pacing: audio first, then scene lengths derived from the measured audio.
- Real screen recordings only.
- Lower-third captions in Inter, phrase by phrase.
- Hard cuts and a calm, explanatory voice.
- A closing product shot with the tagline, no logo sting.

## What we deliberately change

- **Dark UI.** Orivoxx is dark-only; the reference is light. We keep the product's real palette.
- **No browser chrome frame.** We record the app viewport at 1920×1080 with no decorative frame, so the UI fills the frame.
- **No music.** The reference's audio bed is not reproduced; narration only, normalized to −16 LUFS.
- **No decorative gradient.** Background is the product background (`#0B0D10`).
- **Content-specific scenes.** Catalogue → leaderboard → result → compare → submit → docs, instead of a single dashboard.

## Timing rule

Each scene's duration is `audio duration + 0.35 s` of hold, rounded to 0.1 s. Hard cut between scenes. The only allowed gaps over 600 ms are the deliberate holds at the end of a scene, and there is never more than one per scene.
