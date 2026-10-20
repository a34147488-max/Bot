const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json({limit:'64kb'}));
app.use(express.static(path.join(__dirname), { index: 'index.html', dotfiles: 'ignore' }));
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = (process.env.BOT_USERNAME || '').replace(/^@/,'');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const APP_URL = process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'https://a34147488-max.github.io/Bot/');
const path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? { rejectUnauthorized:false } : false });

async function initDb(){
 await pool.query(`CREATE TABLE IF NOT EXISTS anon_messages (
  id BIGSERIAL PRIMARY KEY, recipient_id BIGINT NOT NULL, sender_id BIGINT NOT NULL,
  text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), is_read BOOLEAN NOT NULL DEFAULT FALSE
 )`);
 await pool.query('CREATE INDEX IF NOT EXISTS anon_messages_recipient_created ON anon_messages(recipient_id, created_at DESC)');
}
async function telegram(method, body){
 if(!BOT_TOKEN) throw new Error('BOT_TOKEN is not configured');
 const r=await fetch('https://api.telegram.org/bot'+BOT_TOKEN+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json(); if(!j.ok) throw new Error(j.description||'Telegram API error'); return j.result;
}
function verifyInitData(initData){
 if(!BOT_TOKEN || !initData) return null;
 const params=new URLSearchParams(initData); const hash=params.get('hash'); if(!hash)return null; params.delete('hash');
 const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
 const expected=crypto.createHmac('sha256',secret).update(check).digest('hex');
 const a=Buffer.from(hash,'hex'), b=Buffer.from(expected,'hex');
 if(a.length!==b.length || !crypto.timingSafeEqual(a,b))return null;
 const authDate=Number(params.get('auth_date')||0);
 if(!authDate || Date.now()/1000-authDate>86400)return null;
 try{return JSON.parse(params.get('user')||'null')}catch{return null}
}
function auth(req,res,next){const user=verifyInitData(req.get('X-Telegram-Init-Data')||'');if(!user?.id)return res.status(401).json({error:'Open this app from the Telegram bot.'});req.tgUser=user;next()}
app.get('/health',(_req,res)=>res.json({ok:true}));
app.get('/api/me',auth,async(req,res)=>{
 if(!BOT_USERNAME)return res.status(503).json({error:'BOT_USERNAME is not configured'});
 const u=req.tgUser;
 res.json({id:u.id,name:[u.first_name,u.last_name].filter(Boolean).join(' ')||u.username||'Профиль',username:u.username||'',link:'https://t.me/'+BOT_USERNAME+'?start=anon_'+u.id});
});
app.get('/api/messages',auth,async(req,res)=>{
 try{
  const rows=await pool.query('SELECT id,text,created_at,is_read FROM anon_messages WHERE recipient_id=$1 ORDER BY created_at DESC LIMIT 100',[String(req.tgUser.id)]);
  const count=await pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_read=false)::int AS unread FROM anon_messages WHERE recipient_id=$1',[String(req.tgUser.id)]);
  await pool.query('UPDATE anon_messages SET is_read=true WHERE recipient_id=$1 AND is_read=false',[String(req.tgUser.id)]);
  res.json({messages:rows.rows.map(x=>({id:x.id,text:x.text,createdAt:x.created_at,isRead:x.is_read})),total:count.rows[0].total,unread:count.rows[0].unread});
 }catch(e){console.error(e);res.status(500).json({error:'Database unavailable'})}
});
app.post('/telegram-webhook',async(req,res)=>{
 if(WEBHOOK_SECRET && req.get('X-Telegram-Bot-Api-Secret-Token')!==WEBHOOK_SECRET)return res.sendStatus(403);
 res.sendStatus(200);
 try{
  const u=req.body?.message; if(!u?.chat?.id || u.chat.type!=='private' || !u.text)return;
  const chatId=u.chat.id, text=u.text.trim();
  if(text.startsWith('/start')){
   const payload=text.split(/\s+/)[1]||'';
   if(payload.startsWith('anon_') && /^anon_\d+$/.test(payload)){
    const target=payload.slice(5);
    if(target===String(chatId)){await telegram('sendMessage',{chat_id:chatId,text:'Это твоя личная ссылка. Перешли её друзьям, чтобы получить анонимные сообщения.'});return}
    await pool.query('INSERT INTO anon_sessions(sender_id,recipient_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'24 hours\') ON CONFLICT(sender_id) DO UPDATE SET recipient_id=EXCLUDED.recipient_id,expires_at=EXCLUDED.expires_at',[String(chatId),target]);
    await telegram('sendMessage',{chat_id:chatId,text:'Напиши одно анонимное сообщение в ответ на это сообщение. Твоё имя и профиль не будут показаны получателю.'});return;
   }
   await telegram('sendMessage',{chat_id:chatId,text:'Привет! Здесь можно отправить анонимное сообщение по персональной ссылке. Открой мини-приложение кнопкой ниже, чтобы получить свою ссылку.',reply_markup:{inline_keyboard:[[{text:'Открыть приложение',web_app:{url:APP_URL}}]]}});return;
  }
  if(text.startsWith('/'))return;
  const session=await pool.query('SELECT recipient_id FROM anon_sessions WHERE sender_id=$1 AND expires_at>NOW()',[String(chatId)]);
  if(!session.rowCount){await telegram('sendMessage',{chat_id:chatId,text:'Чтобы написать анонимно, сначала открой персональную ссылку человека.'});return}
  const target=session.rows[0].recipient_id;
  if(target===String(chatId)){await telegram('sendMessage',{chat_id:chatId,text:'Нельзя отправить сообщение самому себе.'});return}
  if(text.length>4000){await telegram('sendMessage',{chat_id:chatId,text:'Сообщение слишком длинное. Максимум 4000 символов.'});return}
  await pool.query('INSERT INTO anon_messages(recipient_id,sender_id,text) VALUES($1,$2,$3)',[target,String(chatId),text]);
  await telegram('sendMessage',{chat_id:chatId,text:'Сообщение отправлено анонимно.'});
  await pool.query('DELETE FROM anon_sessions WHERE sender_id=$1',[String(chatId)]);
 }catch(e){console.error('Webhook update failed:',e.message)}
});
async function main(){
 await initDb();
 await pool.query(`CREATE TABLE IF NOT EXISTS anon_sessions (
  sender_id BIGINT PRIMARY KEY, recipient_id BIGINT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
 )`);
 app.listen(PORT,async()=>{
  console.log('Anonymous messages API listening on '+PORT);
  if(BOT_TOKEN && process.env.RAILWAY_PUBLIC_DOMAIN){
   const domain=process.env.RAILWAY_PUBLIC_DOMAIN;
   try{await telegram('setWebhook',{url:'https://'+domain+'/telegram-webhook',secret_token:WEBHOOK_SECRET,allowed_updates:['message']});console.log('Telegram webhook configured')}
   catch(e){console.error('Could not set Telegram webhook:',e.message)}
  }else console.log('Set RAILWAY_PUBLIC_DOMAIN and BOT_TOKEN to enable webhook');
 });
}
main().catch(e=>{console.error('Startup failed:',e);process.exit(1)});
