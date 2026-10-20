import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error("Missing BOT_TOKEN");
  process.exit(1);
}
const bot = new Bot(TOKEN);
const sessions = new Map();

function normalizePhone(raw) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return { digits, international: "+" + digits };
}
function countryHint(digits) {
  const prefixes = [
    ["55","Бразилия"],["31","Нидерланды"],["49","Германия"],["7","Россия / Казахстан"],
    ["1","США / Канада"],["44","Великобритания"],["33","Франция"],["34","Испания"],
    ["39","Италия"],["91","Индия"],["81","Япония"],["86","Китай"],["380","Украина"]
  ].sort((a,b)=>b[0].length-a[0].length);
  const found = prefixes.find(([p])=>digits.startsWith(p));
  return found ? found[1] : "не удалось определить по коду";
}
function resultsKeyboard(phone) {
  const q = encodeURIComponent('"' + phone + '"');
  return new InlineKeyboard()
    .url("Поиск в Google", "https://www.google.com/search?q=" + q)
    .url("Поиск в Bing", "https://www.bing.com/search?q=" + q).row()
    .url("Поиск в DuckDuckGo", "https://duckduckgo.com/?q=" + q);
}
function homeKeyboard() {
  return new InlineKeyboard()
    .text("Проверить номер", "lookup").row()
    .text("Поделиться своим контактом", "share_contact").row()
    .url("Как защитить номер", "https://support.google.com/accounts/answer/7660719");
}

bot.command("start", async ctx => {
  sessions.delete(String(ctx.from.id));
  await ctx.reply(
    "Поиск публичных упоминаний номера\n\n" +
    "Бот проверяет формат номера и создаёт ссылки на поисковые системы. Он не получает закрытые базы, частные фотографии, домашние адреса или список друзей и не раскрывает скрытые Telegram-профили. Результаты поиска нужно проверять самостоятельно.\n\n" +
    "Для проверки Telegram-профиля пользователь должен сам открыть бота и добровольно поделиться контактом.",
    { reply_markup: homeKeyboard() }
  );
});
bot.command("help", async ctx => ctx.reply(
  "Команды:\n/start — меню\n/lookup — поиск публичных упоминаний\n\n" +
  "Отправь номер с кодом страны, например +5511999999999. Бот не определяет точное местоположение человека и не подтверждает владельца номера."
));
bot.command("lookup", async ctx => {
  sessions.set(String(ctx.from.id), { mode: "phone" });
  await ctx.reply("Отправь номер в международном формате с кодом страны (например, +5511999999999). Не отправляй чужие конфиденциальные данные.");
});
bot.callbackQuery("lookup", async ctx => {
  await ctx.answerCallbackQuery();
  sessions.set(String(ctx.from.id), { mode: "phone" });
  await ctx.reply("Отправь номер в международном формате с кодом страны (например, +5511999999999).");
});
bot.callbackQuery("share_contact", async ctx => {
  await ctx.answerCallbackQuery();
  sessions.set(String(ctx.from.id), { mode: "contact" });
  await ctx.reply("Чтобы проверить только собственный Telegram-контакт, нажми кнопку ниже и отправь свой контакт добровольно.", {
    reply_markup: {
      keyboard: [[{ text: "Поделиться моим контактом", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});
bot.on("message:contact", async ctx => {
  const contact = ctx.message.contact;
  const uid = String(ctx.from.id);
  if (contact.user_id && String(contact.user_id) !== uid) {
    return ctx.reply("Для защиты приватности бот принимает только контакт, принадлежащий самому отправителю. Попроси владельца открыть бота и поделиться своим контактом.", { reply_markup: { remove_keyboard: true } });
  }
  if (!contact.user_id && contact.phone_number !== ctx.from.phone_number) {
    return ctx.reply("Telegram не подтвердил, что это твой контакт. Для проверки профиля поделись контактом через собственную карточку Telegram.", { reply_markup: { remove_keyboard: true } });
  }
  await ctx.reply(
    "Контакт получен добровольно. Telegram не предоставляет этому боту доступ к скрытым данным, списку друзей или адресу проживания. " +
    (contact.user_id ? "Telegram ID этого пользователя: " + contact.user_id + "." : "У Telegram не получилось подтвердить ID контакта."),
    { reply_markup: { remove_keyboard: true } }
  );
});
bot.on("message:text", async ctx => {
  if (ctx.from.is_bot || ctx.message.text.startsWith("/")) return;
  const uid = String(ctx.from.id);
  const session = sessions.get(uid);
  if (!session || session.mode !== "phone") return;
  sessions.delete(uid);
  const phone = normalizePhone(ctx.message.text);
  if (!phone) return ctx.reply("Не удалось распознать номер. Укажи от 7 до 15 цифр с кодом страны, например +5511999999999.");
  await ctx.reply(
    "Номер: " + phone.international + "\n" +
    "Предполагаемая страна по коду: " + countryHint(phone.digits) + "\n\n" +
    "Ниже — ссылки на поиск публичных страниц, где номер может упоминаться. Бот не сканирует закрытые базы и не подтверждает, кому принадлежит номер. Совпадения могут относиться к другому человеку.",
    { reply_markup: resultsKeyboard(phone.international) }
  );
});
bot.catch(err => console.error("Bot error", err));
bot.start({ onStart: info => console.log("Phone OSINT bot @" + info.username + " started") });
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
