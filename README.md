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

## What it changes

- Replaces X's left sidebar with a text nav: home, explore, notifications, chat, history, profile, write, settings. Unread counts come from X's own nav.
- Explore is a search landing: the news strip, trends, tabs, and "who to follow" blocks are hidden, and the search field is a flat line instead of a pill.
- Search suggestions and recent searches use a flat, shadowless panel with compact text rows.
- Hides the right sidebar, Grok, the chat drawer, Premium upsell cards and promoted posts.
- Keeps only the "for you" and "following" tabs on home and hides "who to follow" blocks there.
- Uses smaller type, lowercase tabs, and text actions on posts (`reply 16  repost 5  like 267  keep  share`).
- Restyles scrollbars (thin, arrowless, visible only on hover), the post "…" menu (text-only items), and the "See new posts" pill.
- Every control follows one interaction style: text goes from muted to full color on hover, rows get the same faint highlight, keyboard focus underlines the label, and all transitions take 120ms. Menus and the search dropdown are the same flat, square panel.
- New post (the modal and the composer on home) matches the timeline: 14px text, a lowercase placeholder, text tools (`media  gif  poll  emoji  schedule  location`), and a `post` pill that fills in once there is something to post. The audience picker is a quiet outline pill.
- Confirmation dialogs, toasts and profile hover cards use the same flat panel as menus (4px corners), with a short fade-and-pop entrance. Dialog buttons use the pill style.
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
