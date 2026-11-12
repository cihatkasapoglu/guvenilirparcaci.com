(function () {
  const config = window.GP_SUPABASE_CONFIG;
  const display = document.querySelector("[data-daily-visitors]");
  if (!config || !display) return;

  function animateCount(target) {
    const finalValue = Math.max(0, Math.floor(Number(target) || 0));
    const duration = 850;
    const startedAt = performance.now();
    display.textContent = "0";
    function step(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(finalValue * eased);
      display.textContent = new Intl.NumberFormat("tr-TR").format(progress === 1 ? finalValue : current);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const STORAGE_KEY = "gp_daily_visitor_counter_v1";
  const THREE_MINUTES = 3 * 60 * 1000;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    console.warn("Sayaç tarayıcı kaydı okunamadı:", error);
  }

  const now = Date.now();
  if (saved && saved.date === today && Number.isFinite(saved.count) &&
      Number.isFinite(saved.lastCountedAt) && now - saved.lastCountedAt < THREE_MINUTES) {
    animateCount(saved.count);
    return;
  }

  fetch(config.url + "/rest/v1/rpc/increment_daily_page_view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.anonKey,
      "Authorization": "Bearer " + config.anonKey
    },
    body: "{}"
  })
    .then(async function (response) {
      if (!response.ok) throw new Error("Sayaç yanıt vermedi: " + response.status);
      return response.json();
    })
    .then(function (count) {
      const numericCount = Number(count);
      animateCount(numericCount);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          date: today,
          count: numericCount,
          lastCountedAt: Date.now()
        }));
      } catch (error) {
        console.warn("Sayaç tarayıcı kaydı yapılamadı:", error);
      }
    })
    .catch(function (error) {
      console.error("Günlük ziyaretçi sayacı çalışmadı:", error);
      display.textContent = "—";
    });
})();
