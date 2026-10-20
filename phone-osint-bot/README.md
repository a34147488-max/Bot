# Phone OSINT Telegram bot (privacy-respecting)

A small Telegram bot that validates a phone number, offers a rough country-code hint, and opens public search-engine queries. It does not scrape websites, use leaked/private databases, identify a private home address, fetch private photos, or enumerate someone's friends.

## Deploy

1. Create a separate bot with @BotFather.
2. Deploy this folder as its own Node.js service (Node 20+).
3. Set environment variable `BOT_TOKEN` to the bot token in your hosting dashboard. Never commit the token.
4. Start command: `npm start`.
5. Open the bot and send `/start`.

No database or paid generation/search API is required. Search links open public search engines; search results depend on those engines and may be incomplete or inaccurate.

## Privacy limits

- A phone number alone does not reliably reveal a person's current city, home address, photos, contacts, or friends.
- Telegram bots cannot search all Telegram accounts by arbitrary phone number or read private profile data.
- The contact-sharing flow only accepts a contact that Telegram identifies as the sender, where that identifier is available.
- Country hints are approximate and use a short prefix list, not a full numbering-plan database.
