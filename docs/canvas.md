# Canvas density

Linked from [SKILL.md](../SKILL.md)'s DENSITY.

`density` says how much a slide carries; `canvas` says how much page it has. A slides deck takes `canvas: 'low' | 'medium' | 'high'` in the model, or `--canvas` on `create` and `new`. **`medium` is the default** and leaves every deck exactly as it was.
| canvas | size | side margin | Body reads as | point caps, speaker / reading | use |
|---|---|---|---|---|---|
| `low` | 720×405 | 56 | 24 | 3 / 4 | presented in a room, one idea a page |
| `medium` | 960×540 | 60 | 16 | 3 / 8 | the default |
| `high` | 1280×720 | 32 | 10.5 | 6 / 24 | dashboards and tables read on a screen |
The tier sets the canvas, the margin, the foot band and the word caps, scales the style's role sizes, and cuts every library layout and template from its margins inward, so a style kit written for 960 works on all three. `--space` still wins on size. Low holds less: 61 of the 115 templates fit their sample copy there, so shorten the copy or split the slide when `validate` names an overlap. High and medium are clean on the same samples but for one `figure-decision` connector warning that medium and high share.
