(() => {
  const $ = id => document.getElementById(id);
  const missions = [
    {title:"Сигнал из туманности",tag:"РАЗВЕДКА",text:"Неизвестный импульс пробился сквозь космический шум. Определи источник и занеси находку в журнал.",name:"Импульс туманности",detail:"Источник сигнала найден в облаке Лиры. Первый неизвестный импульс внесён в звёздную карту.",reward:35},
    {title:"Ледяная луна",tag:"АНАЛИЗ",text:"Под толщей древнего льда обнаружены следы необычной атмосферы. Проведи спектральный анализ.",name:"Атмосфера Эйры",detail:"В ледяной коре обнаружены кристаллы с редким энергетическим следом.",reward:45},
    {title:"Забытый маяк",tag:"ВОССТАНОВЛЕНИЕ",text:"На краю сектора мерцает аварийный маяк. Восстанови его питание и открой безопасный маршрут.",name:"Маяк активирован",detail:"Навигационный маяк снова передаёт координаты. Открыт новый маршрут.",reward:60},
    {title:"Сад астероидов",tag:"НАВИГАЦИЯ",text:"Проложи курс через поле минерализованных астероидов и найди путь к неизученному сектору.",name:"Сад астероидов",detail:"Безопасный маршрут построен. В поле найдены редкие минеральные образования.",reward:75},
    {title:"Граница тишины",tag:"ПЕРВЫЙ КОНТАКТ",text:"За пределами известных карт движется объект без теплового следа. Сканируй его осторожно.",name:"Объект за границей",detail:"Обнаружен неизвестный светящийся объект. Карта экспедиции расширена.",reward:100}
  ];
  const defaults={energy:120,discoveries:0,level:1,progress:0,mission:0,log:[],sound:false};
  let state;
  try{state={...defaults,...JSON.parse(localStorage.getItem("nova-save")||"{}")}}catch{state={...defaults}}
  state.energy=Math.max(0,Number(state.energy)||0);
  state.discoveries=Math.max(0,Number(state.discoveries)||0);
  state.level=Math.max(1,Number(state.level)||1);
  state.mission=Math.max(0,Math.min(Number(state.mission)||0,missions.length-1));
  state.progress=Math.max(0,Math.min(Number(state.progress)||0,2));
  state.log=Array.isArray(state.log)?state.log.slice(0,8):[];
  function save(){try{localStorage.setItem("nova-save",JSON.stringify(state))}catch{}}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function render(){
    const previousEnergy=$("energy").textContent;
    $("energy").textContent=state.energy.toLocaleString("ru-RU");
    if(previousEnergy!==$("energy").textContent){$("energy").classList.remove("value-pop");void $("energy").offsetWidth;$("energy").classList.add("value-pop");}
    $("energyBar").style.width=Math.min(100,state.energy/150*100)+"%";
    $("energyPct").textContent=Math.min(100,Math.round(state.energy/150*100))+"%";
    $("discoveries").textContent=String(state.discoveries).padStart(2,"0");
    $("level").textContent=String(state.level).padStart(2,"0");
    const m=missions[state.mission];
    $("missionNumber").textContent=String(state.mission+1).padStart(2,"0");
    $("missionTitle").textContent=m.title;
    $("missionTag").textContent=m.tag;
    $("missionText").textContent=m.text;
    $("reward").innerHTML='НАГРАДА <b>+'+m.reward+' EN</b>';
    $("progress").style.width=(state.progress/3*100)+"%";
    $("progressLabel").textContent=state.progress+" / 3";
    $("scanBtn").disabled=state.energy<10;
    $("scanBtn").innerHTML=(state.energy<10?"Нет энергии":state.progress===2?"Завершить миссию":"Сканировать")+' <span>↗</span>';
    $("logCount").textContent=state.log.length+" ЗАПИСЕЙ";
    $("logList").innerHTML=state.log.length?state.log.map(x=>'<article class="log-item"><div class="log-icon">✦</div><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.detail)+'</small><div class="log-reward">+'+Number(x.reward)+' EN · МИССИЯ ЗАВЕРШЕНА</div></div></article>').join(""):'<div class="log-empty"><span>—</span> Журнал пуст. Первое открытие ждёт тебя.</div>';
    $("soundBtn").textContent=state.sound?"♪":"◖";
  }
  function beep(freq=440,duration=.08){if(!state.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;const c=new C();const o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.type="sine";g.gain.value=.035;o.connect(g);g.connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.stop(c.currentTime+duration)}catch{}}
  $("scanBtn").addEventListener("click",()=>{
    if(state.energy<10){$("result").textContent="Энергии недостаточно. Заверши доступные действия позже.";return}
    state.energy-=10;state.progress++;beep(310+state.progress*100);
    const card=$("missionSection").querySelector(".mission-card");card.classList.remove("scanning","completed");void card.offsetWidth;card.classList.add("scanning");setTimeout(()=>card.classList.remove("scanning"),1150);
    if(state.progress<3){$("result").textContent=["Сканер калибруется. Получен первый пакет данных…","Сигнал усиливается. Координаты почти определены…"][state.progress-1]}
    else{
      const m=missions[state.mission];state.energy+=m.reward;state.discoveries++;state.log.unshift({title:m.name,detail:m.detail,reward:m.reward});state.log=state.log.slice(0,8);state.level=1+Math.floor(state.discoveries/2);state.progress=0;state.mission=(state.mission+1)%missions.length;
      card.classList.remove("scanning");card.classList.add("completed");setTimeout(()=>card.classList.remove("completed"),900);
      $("result").textContent="ОТКРЫТИЕ ПОДТВЕРЖДЕНО — "+m.name+". Получено +"+m.reward+" энергии.";beep(720,.18);
    }
    save();render();
  });
  $("startBtn").addEventListener("click",()=>{$("missionSection").scrollIntoView({behavior:"smooth",block:"start"});const card=$("missionSection").querySelector(".mission-card");card.classList.remove("scanning");void card.offsetWidth;card.classList.add("scanning");setTimeout(()=>card.classList.remove("scanning"),1150);setTimeout(()=>$("scanBtn").focus({preventScroll:true}),350)});
  $("soundBtn").addEventListener("click",()=>{state.sound=!state.sound;save();render();if(state.sound)beep(520)});
  render();
})();