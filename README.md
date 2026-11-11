# Debloat X

A Chrome extension that turns x.com into a quiet, text-first layout: a small text nav on the left, one centered timeline, and no sidebar, Grok, or upsells.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `debloat-x` folder.
4. Reload any open x.com tabs.

## Use

- Click the toolbar icon to turn it on or off. An "off" badge shows when it is disabled.
- `n` writes a post (X's own shortcut). `/` focuses search.
- `.` loads new posts when the new posts button is visible.

## What it changes

- Replaces X's left sidebar with a text nav: home, explore, notifications, chat, history, profile, write and settings. Unread counts come from X's own nav.
- Explore keeps search, Today's News and the post feed. News items become a plain list of underlined titles with the time on the right; trends, tabs and "who to follow" are hidden. The search field is a flat line instead of a pill.
- Explore opens without focusing search; click the field or press `/` to search. Suggestions and recent searches use a compact, scrollable text list without avatars or leading icons.
- Hides the right sidebar, Grok, the chat drawer, Premium upsell cards and promoted posts.
- Keeps all your Home timeline and category tabs (including Politics, Tech and pinned lists), with X's horizontal scroll controls, and hides "who to follow" blocks there.
- Aligns the composer, tabs and feed in a centered column up to 600px wide. It shrinks to fit smaller desktop windows.
- Uses readable post text, lowercase tabs and page headers, a plain back arrow, and text actions on posts (`reply 16  repost 5  like 267  views 4.7k  keep  share`).
- Restyles scrollbars (thin, arrowless, visible only on hover), the post "…" menu (text-only items), and the "See new posts" pill (a thin text arrow and "new posts" instead of avatars).
- Every control follows one interaction style: text goes from muted to full color on hover, rows get the same faint highlight, keyboard focus underlines the label, and hover transitions take 120ms. Menus and the search dropdown are the same flat, square panel.
- Post actions share a centered baseline and wrap when the column is narrow. Likes reserve space for the label, count and status dot so sharing stays in place; the dot fades and scales in over 160–220ms, with motion disabled when reduced motion is requested.
- New post (the modal and the composer on home) matches the timeline: a lowercase placeholder, text tools (`media  gif  poll  emoji  schedule  location  disclosure`), and a `post` pill that fills in once there is something to post. Tools wrap when space is tight. The audience picker is a quiet outline pill.
- Confirmation dialogs, toasts and profile hover cards use the same flat panel as menus (10px corners), with a short fade-and-pop entrance. Dialog buttons use the pill style.
- Photos and video in posts get a double border: a tinted outer frame with the media inset inside its own hairline.
- Menus with pictures (like "choose audience") show a small square image with left-aligned text, and their section headings are small muted labels.
- An opened post uses a 32px avatar so it sits with the smaller name text.
- Opening write, a photo or display settings keeps the page behind it as it was, so home doesn't change layout under the modal.
- Fades the timeline in when a post opens, and replaces X's loading spinner in the timeline with a pulsing skeleton post. Both respect reduced-motion settings.

## No layout shift

- `content.css` is injected at `document_start`, before X renders, so the first frame is already in the final layout.
- The extension is on by default. The off state is mirrored in `localStorage` and read synchronously, so a disabled extension never flashes the restyled layout.
- The nav is `position: fixed` and inserted from a synchronous MutationObserver, which runs before the browser paints.
- The theme comes from the server-rendered `<body>` background, and the profile link is cached, so neither changes after load.
- Promoted posts and upsell cards are hidden as soon as they are inserted, before they paint.

## Limits

- X changes its markup often. If something stops being hidden, the selectors in `content.css` need updating.
- Ads are detected by their "Ad" / "Promoted" label.
- Windows narrower than 701px keep X's normal mobile layout.
