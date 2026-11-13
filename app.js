/* Gezi Haritası — Sero & Gorki */
(() => {
  const CFG = window.GEZI_CONFIG;
  const sb = supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  const $ = (s) => document.querySelector(s);

  const COLORS = {
    serhan: "#1d3f8f", goknur: "#d9a21b", together: "#c8372d",
    wish: "#b39ddb", home: "#2f9e64", lived: "#f08c00", land: "#e9e2db",
  };
  const LEGEND = [
    ["Sero", COLORS.serhan], ["Gorki", COLORS.goknur], ["Birlikte", COLORS.together],
    ["İkimiz de (ayrı)", "url(#stripes)"], ["İstek", COLORS.wish], ["Yaşıyoruz", COLORS.home],
    ["Yaşadık", COLORS.lived, true],
  ];
  const EXTRA_NAMES = { "CY-N": "Kuzey Kıbrıs", "SO-SL": "Somaliland", XK: "Kosova" };
  let trNames;
  try { trNames = new Intl.DisplayNames(["tr"], { type: "region" }); } catch { trNames = null; }
  const nameOf = (a2, en) => EXTRA_NAMES[a2] || (trNames && a2 && a2.length === 2 ? trNames.of(a2) : null) || en;

  const state = {
    mode: "countries", countries: new Map(), cities: [], trips: [], photos: [],
    session: null, selected: null, features: [], k: 1,
  };

  // ---------- Harita ----------
  const svg = d3.select("#map");
  const defs = svg.append("defs");
  const pat = defs.append("pattern").attr("id", "stripes").attr("patternUnits", "userSpaceOnUse")
    .attr("width", 2).attr("height", 2).attr("patternTransform", "rotate(45)");
  pat.append("rect").attr("width", 2).attr("height", 2).attr("fill", COLORS.serhan);
  pat.append("rect").attr("width", 1).attr("height", 2).attr("fill", COLORS.goknur);
  const g = svg.append("g");
  const gCountries = g.append("g");
  const gCities = g.append("g");
  let projection, path, zoom;

  function fillFor(code) {
    const c = state.countries.get(code);
    if (state.mode === "cities" || !c) return COLORS.land;
    if (c.home === "lives") return COLORS.home;
    if (c.together) return COLORS.together;
    if (c.serhan && c.goknur) return "url(#stripes)";
    if (c.serhan) return COLORS.serhan;
    if (c.goknur) return COLORS.goknur;
    if (c.home === "lived") return COLORS.lived;
    if (c.wish) return COLORS.wish;
    return COLORS.land;
  }
  function cityFill(c) {
    if (c.home === "lives") return COLORS.home;
    if (c.home === "lived") return COLORS.lived;
    if (c.together || (c.serhan && c.goknur)) return COLORS.together;
    if (c.serhan) return COLORS.serhan;
    if (c.goknur) return COLORS.goknur;
    if (c.wish) return COLORS.wish;
    return "#888";
  }

  async function initMap() {
    const topo = await (await fetch("data/world.json")).json();
    const fc = topojson.feature(topo, topo.objects.countries);
    state.features = fc.features.filter((f) => f.properties.a2 !== "AQ");
    const { width, height } = svg.node().getBoundingClientRect();
    projection = d3.geoNaturalEarth1().fitExtent([[4, 4], [width - 4, height - 4]], { type: "FeatureCollection", features: state.features });
    path = d3.geoPath(projection);
    gCountries.selectAll("path").data(state.features).join("path")
      .attr("class", "country").attr("d", path)
      .on("click", (ev, f) => { if (f.properties.a2) openCountry(f.properties.a2); });
    zoom = d3.zoom().scaleExtent([1, 60]).on("zoom", (ev) => {
      g.attr("transform", ev.transform); state.k = ev.transform.k; sizeCities();
    });
    svg.call(zoom).on("dblclick.zoom", null);
    const dl = $("#countrylist");
    dl.innerHTML = state.features.filter((f) => f.properties.a2)
      .map((f) => nameOf(f.properties.a2, f.properties.en)).sort((a, b) => a.localeCompare(b, "tr"))
      .map((n) => `<option value="${esc(n)}">`).join("");
    $("#loading").hidden = true;
  }

  function render() {
    gCountries.selectAll("path")
      .attr("fill", (f) => fillFor(f.properties.a2))
      .classed("lived", (f) => state.mode === "countries" && state.countries.get(f.properties.a2)?.home === "lived")
      .classed("sel", (f) => f.properties.a2 && f.properties.a2 === state.selected);
    const cities = state.mode === "cities" ? state.cities : [];
    gCities.selectAll("circle").data(cities, (d) => d.id).join("circle")
      .attr("class", "city")
      .attr("cx", (d) => projection([d.lon, d.lat])[0]).attr("cy", (d) => projection([d.lon, d.lat])[1])
      .attr("fill", cityFill)
      .on("click", (ev, d) => openCountry(d.country_code))
      .append("title").text((d) => d.name);
    sizeCities();
    renderStats();
  }
  function sizeCities() { gCities.selectAll("circle").attr("r", 7 / state.k); }

  function renderStats() {
    let visited = 0, together = 0;
    state.countries.forEach((c) => {
      if (c.code.includes("-")) return; // Kuzey Kıbrıs gibi tanınmayan bölgeler sayılmaz
      if (c.serhan || c.goknur || c.together || c.home) visited++;
      if (c.together) together++;
    });
    $("#statCountries").textContent = visited;
    $("#statPercent").textContent = "%" + Math.round((visited / CFG.totalCountries) * 100);
    $("#statTogether").textContent = together;
    $("#statCities").textContent = state.cities.filter((c) => c.serhan || c.goknur || c.together || c.home).length;
  }

  function renderLegend() {
    const sw = `<svg width="0" height="0" style="position:absolute"></svg>`;
    $("#legend").innerHTML = sw + LEGEND.map(([n, c, outline]) => {
      const style = c.startsWith("url")
        ? `background:repeating-linear-gradient(45deg,${COLORS.serhan} 0 3px,${COLORS.goknur} 3px 6px)`
        : outline ? `border:3px solid ${c};background:${COLORS.land}` : `background:${c}`;
      return `<span><i style="${style}"></i>${n}</span>`;
    }).join("");
  }

  // Denizaşırı topraklar (ör. Fransız Guyanası) yakınlaştırmayı bozmasın diye en büyük parçayı al
  function mainland(f) {
    if (f.geometry.type !== "MultiPolygon") return f;
    let best = null, area = -1;
    for (const coords of f.geometry.coordinates) {
      const part = { type: "Feature", geometry: { type: "Polygon", coordinates: coords } };
      const a = path.area(part); if (a > area) { area = a; best = part; }
    }
    return best;
  }
  function zoomToCode(code) {
    const f = state.features.find((x) => x.properties.a2 === code);
    if (!f) return;
    const [[x0, y0], [x1, y1]] = path.bounds(mainland(f));
    const { width, height } = svg.node().getBoundingClientRect();
    const k = Math.min(20, 0.6 / Math.max((x1 - x0) / width, (y1 - y0) / height));
    svg.transition().duration(600).call(zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 3).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }
  function zoomToVisited() {
    const codes = [...state.countries.values()].filter((c) => c.serhan || c.goknur || c.together || c.home || c.wish).map((c) => c.code);
    const fs = state.features.filter((f) => codes.includes(f.properties.a2) && f.properties.a2 !== "RU").map(mainland);
    if (!fs.length) return;
    const [[x0, y0], [x1, y1]] = path.bounds({ type: "FeatureCollection", features: fs });
    const { width, height } = svg.node().getBoundingClientRect();
    const k = Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height));
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }

  // ---------- Veri ----------
  async function loadData() {
    const [c, ci, t, p] = await Promise.all([
      sb.from("countries").select("*"), sb.from("cities").select("*"),
      sb.from("trips").select("*").order("start_date", { ascending: false, nullsFirst: false }),
      sb.from("photos").select("*").order("created_at"),
    ]);
    for (const r of [c, ci, t, p]) if (r.error) throw r.error;
    state.countries = new Map(c.data.map((r) => [r.code, r]));
    state.cities = ci.data; state.trips = t.data; state.photos = p.data;
  }

  // ---------- Ülke kartı ----------
  const editing = () => !!state.session;
  function openCountry(code) {
    state.selected = code;
    const f = state.features.find((x) => x.properties.a2 === code);
    $("#cName").textContent = nameOf(code, f?.properties.en || code);
    const c = state.countries.get(code) || {};
    const badges = [];
    if (c.home === "lives") badges.push(["Yaşıyoruz", COLORS.home]);
    if (c.home === "lived") badges.push(["Yaşadık", COLORS.lived]);
    if (c.together) badges.push(["Birlikte", COLORS.together]);
    if (c.serhan) badges.push(["Sero", COLORS.serhan]);
    if (c.goknur) badges.push(["Gorki", COLORS.goknur]);
    if (c.wish) badges.push(["İstek", COLORS.wish]);
    $("#cBadges").innerHTML = badges.length ? badges.map(([n, col]) => `<span class="badge" style="background:${col}">${n}</span>`).join("") : `<span class="muted">Henüz gidilmedi</span>`;
    const ed = $("#cEdit"); ed.hidden = !editing();
    ed.querySelectorAll("[data-f]").forEach((el) => {
      const k = el.dataset.f;
      if (el.type === "checkbox") el.checked = !!c[k]; else el.value = c[k] || "";
    });
    renderTrips();
    const cities = state.cities.filter((x) => x.country_code === code);
    $("#cCitiesTitle").hidden = !cities.length;
    $("#cCities").innerHTML = cities.map((x) => `<span class="chip" style="border-left:4px solid ${cityFill(x)}">${esc(x.name)}</span>`).join("");
    $("#addTripBtn").hidden = !editing(); $("#tripForm").hidden = true;
    $("#sheet").hidden = false; $("#sheet").scrollTop = 0;
    render();
  }
  function closeSheet() { $("#sheet").hidden = true; state.selected = null; render(); }

  function photoUrl(p) { return sb.storage.from("photos").getPublicUrl(p.path).data.publicUrl; }
  function fmtDate(d) { return d ? new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  const WHO = { together: "Birlikte", serhan: "Sero", goknur: "Gorki" };

  function renderTrips() {
    const trips = state.trips.filter((t) => t.country_code === state.selected);
    if (!trips.length) { $("#cTrips").innerHTML = `<p class="muted">Bu ülkeye henüz gezi eklenmedi.</p>`; return; }
    $("#cTrips").innerHTML = trips.map((t) => {
      const ph = state.photos.filter((p) => p.trip_id === t.id);
      const dates = [fmtDate(t.start_date), fmtDate(t.end_date)].filter(Boolean).join(" – ");
      return `<div class="trip" data-id="${t.id}">
        <div class="t">${esc(t.title || "Gezi")}</div>
        <div class="d">${esc(WHO[t.who] || "")}${dates ? " · " + dates : ""}</div>
        ${t.note ? `<div class="n">${esc(t.note)}</div>` : ""}
        <div class="photos">${ph.map((p) => `<div class="ph"><img loading="lazy" src="${photoUrl(p)}" data-full="${photoUrl(p)}">${editing() ? `<button class="del" data-photo="${p.id}" aria-label="Fotoğrafı sil">✕</button>` : ""}</div>`).join("")}</div>
        ${editing() ? `<div class="acts">
          <label class="small primary" style="cursor:pointer">📷 Fotoğraf ekle<input type="file" accept="image/*" multiple hidden data-upload="${t.id}"></label>
          <button class="small" data-deltrip="${t.id}">Geziyi sil</button></div>` : ""}
      </div>`;
    }).join("");
  }

  async function saveStatus() {
    const code = state.selected;
    const row = { code, updated_at: new Date().toISOString() };
    $("#cEdit").querySelectorAll("[data-f]").forEach((el) => {
      row[el.dataset.f] = el.type === "checkbox" ? el.checked : (el.value || null);
    });
    const { data, error } = await sb.from("countries").upsert(row).select().single();
    if (error) return toast(errMsg(error));
    state.countries.set(code, data); openCountry(code);
  }

  async function addTrip(ev) {
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(ev.target));
    for (const k of Object.keys(fd)) if (fd[k] === "") fd[k] = null;
    fd.country_code = state.selected;
    const { data, error } = await sb.from("trips").insert(fd).select().single();
    if (error) return toast(errMsg(error));
    state.trips.unshift(data); ev.target.reset(); openCountry(state.selected);
    toast("Gezi eklendi. Şimdi fotoğraf ekleyebilirsiniz.");
  }

  async function shrink(file) {
    try {
      const bmp = await createImageBitmap(file);
      const max = 2048, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      return await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    } catch { return file; }
  }

  async function uploadPhotos(tripId, files) {
    let done = 0;
    for (const file of files) {
      toast(`Yükleniyor ${done + 1}/${files.length}…`, 60000);
      const blob = await shrink(file);
      const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
      const pathName = `${state.selected}/${tripId}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from("photos").upload(pathName, blob, { contentType: blob.type || "image/jpeg" });
      if (up.error) { toast(errMsg(up.error)); return; }
      const { data, error } = await sb.from("photos").insert({ trip_id: tripId, path: pathName }).select().single();
      if (error) { toast(errMsg(error)); return; }
      state.photos.push(data); done++;
    }
    toast(`${done} fotoğraf eklendi`); renderTrips();
  }

  async function deletePhoto(id) {
    const p = state.photos.find((x) => x.id === id);
    if (!p || !confirm("Bu fotoğraf silinsin mi?")) return;
    await sb.storage.from("photos").remove([p.path]);
    const { error } = await sb.from("photos").delete().eq("id", id);
    if (error) return toast(errMsg(error));
    state.photos = state.photos.filter((x) => x.id !== id); renderTrips();
  }
  async function deleteTrip(id) {
    if (!confirm("Bu gezi ve fotoğrafları silinsin mi?")) return;
    const paths = state.photos.filter((p) => p.trip_id === id).map((p) => p.path);
    if (paths.length) await sb.storage.from("photos").remove(paths);
    const { error } = await sb.from("trips").delete().eq("id", id);
    if (error) return toast(errMsg(error));
    state.trips = state.trips.filter((t) => t.id !== id);
    state.photos = state.photos.filter((p) => p.trip_id !== id); renderTrips();
  }

  // ---------- Giriş ----------
  async function refreshSession() {
    const { data } = await sb.auth.getSession();
    state.session = data.session;
    $("#loginBtn").classList.toggle("on", !!state.session);
    $("#loginBtn").title = state.session ? "Çıkış yap" : "Düzenlemek için giriş";
  }
  async function login(signup) {
    const fd = Object.fromEntries(new FormData($("#loginForm")));
    if (!fd.email || !fd.password) { $("#loginMsg").textContent = "E-posta ve şifre gerekli."; return; }
    const fn = signup ? sb.auth.signUp.bind(sb.auth) : sb.auth.signInWithPassword.bind(sb.auth);
    const { error, data } = await fn({ email: fd.email, password: fd.password });
    if (error) { $("#loginMsg").textContent = errMsg(error); return; }
    if (signup && !data.session) { $("#loginMsg").textContent = "Hesap oluşturuldu. E-postanıza gelen bağlantıyla onaylayın, sonra giriş yapın."; return; }
    $("#loginDlg").close(); await refreshSession();
    toast("Giriş yapıldı. Ülkeye dokunup düzenleyebilirsiniz.");
    if (state.selected) openCountry(state.selected);
  }

  // ---------- Yardımcılar ----------
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function errMsg(e) {
    const m = e?.message || String(e);
    if (/row-level security|violates|permission|Unauthorized|403/i.test(m)) return "Bu hesabın düzenleme yetkisi yok.";
    if (/Invalid login/i.test(m)) return "E-posta ya da şifre hatalı.";
    return m;
  }
  let toastT;
  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms);
  }

  // ---------- Olaylar ----------
  function setMode(m) {
    state.mode = m;
    $("#modeCountries").classList.toggle("on", m === "countries");
    $("#modeCities").classList.toggle("on", m === "cities");
    render();
  }
  $("#modeCountries").onclick = () => setMode("countries");
  $("#modeCities").onclick = () => setMode("cities");
  $("#sheetClose").onclick = closeSheet;
  $("#cEdit").addEventListener("change", saveStatus);
  $("#addTripBtn").onclick = () => { $("#tripForm").hidden = false; $("#addTripBtn").hidden = true; };
  $("#tripCancel").onclick = () => { $("#tripForm").hidden = true; $("#addTripBtn").hidden = false; };
  $("#tripForm").addEventListener("submit", addTrip);
  $("#cTrips").addEventListener("change", (e) => {
    const id = e.target.dataset.upload;
    if (id && e.target.files.length) uploadPhotos(Number(id), [...e.target.files]);
  });
  $("#cTrips").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.photo) return deletePhoto(Number(t.dataset.photo));
    if (t.dataset.deltrip) return deleteTrip(Number(t.dataset.deltrip));
    if (t.dataset.full) { const lb = $("#lightbox"); lb.querySelector("img").src = t.dataset.full; lb.hidden = false; }
  });
  $("#lightbox").onclick = () => ($("#lightbox").hidden = true);
  $("#loginBtn").onclick = async () => {
    if (state.session) {
      if (!confirm("Çıkış yapılsın mı?")) return;
      await sb.auth.signOut(); await refreshSession(); if (state.selected) openCountry(state.selected); return;
    }
    $("#loginMsg").textContent = ""; $("#loginDlg").showModal();
  };
  $("#loginForm").addEventListener("submit", (e) => { e.preventDefault(); login(false); });
  $("#signupBtn").onclick = () => login(true);
  $("#loginCancel").onclick = () => $("#loginDlg").close();
  $("#search").addEventListener("change", (e) => {
    const q = e.target.value.trim().toLocaleLowerCase("tr");
    const f = state.features.find((x) => x.properties.a2 && nameOf(x.properties.a2, x.properties.en).toLocaleLowerCase("tr") === q)
      || state.features.find((x) => x.properties.a2 && nameOf(x.properties.a2, x.properties.en).toLocaleLowerCase("tr").startsWith(q));
    if (f) { zoomToCode(f.properties.a2); openCountry(f.properties.a2); e.target.blur(); }
  });
  $("#shareBtn").onclick = async () => {
    const url = location.href.split("#")[0];
    if (navigator.share) { try { await navigator.share({ title: "Gezi Haritamız", url }); } catch {} }
    else { await navigator.clipboard.writeText(url); toast("Bağlantı kopyalandı"); }
  };

  // ---------- Başlat ----------
  (async () => {
    renderLegend();
    try {
      await Promise.all([initMap(), loadData(), refreshSession()]);
      render(); zoomToVisited();
    } catch (e) {
      console.error(e); $("#loading").hidden = false; $("#loading").textContent = "Yüklenemedi: " + errMsg(e);
    }
    sb.auth.onAuthStateChange(() => refreshSession());
  })();
})();
