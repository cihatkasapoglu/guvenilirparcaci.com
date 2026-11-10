(function () {
  const config = window.GP_SUPABASE_CONFIG;
  const display = document.querySelector("[data-daily-visitors]");
  if (!config || !display) return;

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
      display.textContent = new Intl.NumberFormat("tr-TR").format(Number(count));
    })
    .catch(function (error) {
      console.error("Günlük ziyaretçi sayacı çalışmadı:", error);
      display.textContent = "—";
    });
})();
