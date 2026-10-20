(() => {
  const $ = (id) => document.getElementById(id);
  const missions = [
    { title: "Сигнал из туманности", text: "Настрой сканер и найди источник загадочного сигнала в глубоком космосе.", name: "Сигнал пойман", detail: "Ты обнаружил повторяющийся импульс из туманности Лира.", reward: 35 },
    { title: "Ледяная луна", text: "Просканируй поверхность ледяной луны и найди следы древней атмосферы.", name: "Лёд заговорил", detail: "Под слоем кристаллов найдены редкие энергетические включения.", reward: 45 },
    { title: "Забытый маяк", text: "Проследи за слабым сигналом и восстанови навигационный маяк.", name: "Маяк восстановлен", detail: "Старый маяк снова светит и добавил сектор на звёздную карту.", reward: 60 },
    { title: "Сад астероидов", text: "Найди безопасный маршрут сквозь поле сияющих астероидов.", name: "Маршрут открыт", detail: "Новый путь сокращает перелёт и ведёт к неизученному сектору.", reward: 75 },
    { title: "Глубокий космос", text: "Собери данные о неизвестном объекте на краю исследованной системы.", name: "Неизвестное найдено", detail: "Объект излучает собственный свет. Экспедиция вошла в историю.", reward: 100 }
  ];
  const defaults = { energy: 120, discoveries: 0, level: 1, progress: 0, mission: 0, log: [] };
  let state;
  try { state = { ...defaults, ...JSON.parse(localStorage.getItem("nova-save") || "{}") }; } catch { state = { ...defaults }; }
  state.log = Array.isArray(state.log) ? state.log.slice(0, 8) : [];
  state.mission = Math.max(0, Math.min(Number(state.mission) || 0, missions.length - 1));
  state.progress = Math.max(0, Math.min(Number(state.progress) || 0, 3));
  const save = () => { try { localStorage.setItem("nova-save", JSON.stringify(state)); } catch {} };
  const pad = n => String(n).padStart(2, "0");
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }
  function render() {
    $("energy").textContent = state.energy.toLocaleString("ru-RU");
    $("discoveries").textContent = state.discoveries;
    $("level").textContent = pad(state.level);
    $("levelName").textContent = ["Новичок", "Следопыт", "Исследователь", "Навигатор", "Звёздный первооткрыватель"][Math.min(state.level - 1, 4)];
    const m = missions[state.mission];
    $("missionTitle").textContent = m.title;
    $("missionText").textContent = m.text;
    $("progress").style.width = (state.progress / 3 * 100) + "%";
    $("progressLabel").textContent = state.progress + " / 3 действия";
    $("progressPct").textContent = Math.round(state.progress / 3 * 100) + "%";
    $("scanBtn").disabled = state.energy < 10;
    $("scanBtn").querySelector("span:first-child").textContent = state.energy < 10 ? "Недостаточно энергии" : state.progress === 2 ? "Завершить сканирование" : "Сканировать сектор";
    $("logList").innerHTML = state.log.length ? state.log.map(item => '<div class="log-item"><div class="log-icon">✦</div><div><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.detail) + ' · +' + item.reward + ' энергии</small></div></div>').join("") : '<div class="empty"><span>✧</span><p>Тишина космоса. Твоё первое открытие ещё впереди.</p></div>';
  }
  $("scanBtn").addEventListener("click", () => {
    if (state.energy < 10) { $("result").textContent = "Энергии мало. Заверши миссию или вернись позже."; return; }
    state.energy -= 10;
    state.progress++;
    $("result").textContent = state.progress < 3 ? ["Сканер калибруется…", "Получены первые данные…"][state.progress - 1] : "Сигнал подтверждён. Анализ завершён.";
    if (state.progress >= 3) {
      const m = missions[state.mission];
      state.energy += m.reward;
      state.discoveries++;
      state.log.unshift({ title: m.name, detail: m.detail, reward: m.reward });
      state.log = state.log.slice(0, 8);
      state.level = 1 + Math.floor(state.discoveries / 2);
      state.progress = 0;
      state.mission = (state.mission + 1) % missions.length;
      $("result").textContent = "Открытие завершено: «" + m.name + "». Награда +" + m.reward + " энергии. Следующая миссия готова.";
    }
    save(); render();
  });
  render();
})();