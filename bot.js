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
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return { digits, international: "+" + digits };
}

function countryHint(digits) {
  const prefixes = [
    ["380", "Украина"], ["55", "Бразилия"], ["31", "Нидерланды"],
    ["49", "Германия"], ["44", "Великобритания"], ["33", "Франция"],
    ["34", "Испания"], ["39", "Италия"], ["91", "Индия"],
    ["81", "Япония"], ["86", "Китай"], ["7", "Россия / Казахстан"],
    ["1", "США / Канада"]
  ];
  const found = prefixes.find(([prefix]) => digits.startsWith(prefix));
  return found ? found[1] : "не удалось определить по коду";
}

function resultsKeyboard(phone) {
  const q = encodeURIComponent('"' + phone + '"');
  return new InlineKeyboard()
    .url("Google", "https://www.google.com/search?q=" + q)
    .url("Bing", "https://www.bing.com/search?q=" + q).row()
    .url("DuckDuckGo", "https://duckduckgo.com/?q=" + q);
}

function homeKeyboard() {
  return new InlineKeyboard()
    .text("Проверить номер", "lookup").row()
    .text("Поделиться своим контактом", "share_contact");
}

bot.command("start", async ctx => {
  sessions.delete(String(ctx.from.id));
  await ctx.reply(
    "Бот для проверки публичных упоминаний номера телефона.\n\n" +
    "Работает без GPU-worker, базы данных и сторонних API. Он проверяет формат номера и формирует ссылки на открытый веб-поиск. " +
    "По одному номеру нельзя надёжно получить частные фотографии, адрес проживания или список друзей; бот не взламывает закрытые базы и не раскрывает скрытые данные.\n\n" +
    "Чтобы начать, нажми «Проверить номер».",
    { reply_markup: homeKeyboard() }
  );
});

bot.command("help", async ctx => ctx.reply(
  "Команды:\n/start — меню\n/lookup — проверить номер\n\n" +
  "Отправь номер в международном формате, например +5511999999999. Бот показывает примерную страну по коду и ссылки на поиск публичных упоминаний."
));

bot.command("lookup", async ctx => {
  sessions.set(String(ctx.from.id), "phone");
  await ctx.reply("Отправь номер в международном формате с кодом страны, например +5511999999999.");
});

bot.callbackQuery("lookup", async ctx => {
  await ctx.answerCallbackQuery();
  sessions.set(String(ctx.from.id), "phone");
  await ctx.reply("Отправь номер в международном формате с кодом страны, например +5511999999999.");
});

bot.callbackQuery("share_contact", async ctx => {
  await ctx.answerCallbackQuery();
  sessions.set(String(ctx.from.id), "contact");
  await ctx.reply("Поделись только собственным контактом, используя кнопку ниже.", {
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
  if (!contact.user_id || String(contact.user_id) !== uid) {
    await ctx.reply(
      "Telegram не подтвердил, что контакт принадлежит тебе. Для защиты приватности бот принимает только подтверждённый собственный контакт.",
      { reply_markup: { remove_keyboard: true } }
    );
    return;
  }
  await ctx.reply(
    "Собственный контакт подтверждён Telegram. Твой Telegram ID: " + contact.user_id +
    ". Бот не получает скрытые данные, адрес проживания или список друзей.",
    { reply_markup: { remove_keyboard: true } }
  );
});

bot.on("message:text", async ctx => {
  if (ctx.from.is_bot || ctx.message.text.startsWith("/")) return;
  const uid = String(ctx.from.id);
  if (sessions.get(uid) !== "phone") return;
  sessions.delete(uid);

  const phone = normalizePhone(ctx.message.text);
  if (!phone) {
    await ctx.reply("Номер не распознан. Укажи от 7 до 15 цифр с кодом страны.");
    return;
  }

  await ctx.reply(
    "Номер: " + phone.international + "\n" +
    "Предполагаемая страна по коду: " + countryHint(phone.digits) + "\n\n" +
    "Ссылки ведут на публичный веб-поиск. Совпадения могут относиться к другому человеку; владелец номера этим не подтверждается.",
    { reply_markup: resultsKeyboard(phone.international) }
  );
});

bot.catch(err => console.error("Telegram bot error", err));
bot.start({ onStart: info => console.log("Standalone bot @" + info.username + " started; no worker or database required") });
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
