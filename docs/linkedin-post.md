# LinkedIn Launch Post

Plan for announcing Browser FX on LinkedIn.

## When to post

**Target: Tuesday morning, 8 to 10am, in the timezone where most connections live.**

How the gating works: LinkedIn does not schedule the post for later. It seeds it to a
small slice of the network immediately, watches roughly the first 60 to 90 minutes
(dwell time, comments, reshares, profile clicks), then uses that early signal to decide
whether to push it wider. Timing is not about a magic hour. It is about posting when
enough of the audience is awake to generate that signal.

What to do:

- Tuesday, Wednesday, or Thursday morning. Avoid Friday afternoon and weekends.
  Less competition then, but also far less audience, and the early window is what
  gets fed.
- Be at the computer for the hour after posting. Replying to every comment is the
  highest-leverage thing under direct control. A reply counts as engagement and pulls
  the commenter back in. This matters more than the hour chosen.
- Put the Chrome Web Store link in the first comment, not the post body. Outbound
  links in the body still get modestly downranked.
- Upload the demo video as native LinkedIn video rather than linking to YouTube.
  Native video gets meaningfully more reach than an external video link.

What to ignore: editing the post after publishing is fine, the penalty is mostly
folklore now.

Honest size of the effect: timing is maybe a 10 to 20 percent swing. The first line of
the post and showing up to reply are worth several times that.

## The post

Only the first two lines show before the "see more" truncation, so the opener carries
the post.

```
I built a Chrome extension that adds audio effects to any browser tab.

I wanted to play around with the Web Audio API. Instead of making a browser synth
or a drum machine, I thought I'd make something that worked with those things.
That's what Browser FX is. It works on YouTube or a web synth.

There are 22 effects and four slots to combine them in. I also added MIDI support. You can map the knobs to a hardware
controller.

It's free and fun. Check it out.
```

First comment:

```
https://chromewebstore.google.com/detail/browser-fx/oanepaeodkjbadgpgkolbidpbflbmmmd
```

## Open decision: which combination number

- **234,256** is exactly 22^4. It counts only the case where all four slots are
  filled and slot order matters.
- **245,410** is 22 + 22^2 + 22^3 + 22^4. It covers chains of one, two, three, or
  four effects.

Both are defensible. 234,256 is the one in the draft.

## Voice notes

Graded against the anti-AI-cadence rules. Tells that were removed from earlier drafts,
kept here so they do not creep back in on edits:

- "Instead of making **another** browser synth" added a sneer at other people's
  projects that was not in the original intent. Dropped "another".
- "Browser FX grabs the audio out of a tab and runs it through effects in real time"
  handed the sentence to the product instead of the person, and was a balanced
  two-part sentence joined by "and". Replaced with first-person framing.
- "It works on YouTube, Spotify, or any web synth you already use" was a rule-of-three
  with an escalating catch-all, plus a second-person marketing tail. Cut to two items,
  no tail.

Rules that matter most for any rewrite: plain SVO sentences of similar length, most
starting with "I" and a plain verb. No em dashes. No triads. No "actually". No
mic-drop closer, end flat.
