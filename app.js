/* Gezi Haritası — Sero & Gorki · dönen dünya + gezi hikâyesi */
(() => {
  const CFG = window.GEZI_CONFIG;
  const sb = supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  const $ = (s) => document.querySelector(s);
  const on = (s, ev, fn) => { const el = $(s); if (el) el.addEventListener(ev, fn); };

  const COLORS = { serhan: "#3b82f6", goknur: "#f5b301", together: "#ff4d6d", wish: "#a78bfa", home: "#22c55e", lived: "#fb923c", land: "#21456b", sea: "#0e3b66" };
  const LEGEND = [["Sero", COLORS.serhan], ["Gorki", COLORS.goknur], ["Birlikte", COLORS.together], ["İkimiz de", "linear-gradient(90deg,#3b82f6 50%,#f5b301 50%)"], ["İstek", COLORS.wish], ["Ev", COLORS.home], ["Yaşadık", COLORS.lived]];
  const HOME = [28.9784, 41.0082]; // İstanbul
  const EXTRA_NAMES = { "CY-N": "Kuzey Kıbrıs", "SO-SL": "Somaliland", XK: "Kosova" };
  let trNames; try { trNames = new Intl.DisplayNames(["tr"], { type: "region" }); } catch { trNames = null; }
  const nameOf = (a2, en) => EXTRA_NAMES[a2] || (trNames && a2 && a2.length === 2 ? trNames.of(a2) : null) || en || a2;
  const flagUrl = (a2) => `flags/${(a2 === "CY-N" ? "cy" : a2 === "SO-SL" ? "so" : a2).toLowerCase()}.svg`;
  const WHO = { together: "Sero & Gorki", serhan: "Sero", goknur: "Gorki" };
  const isVideo = (p) => /\.(mp4|mov|webm|m4v)$/i.test(p);

  const state = { mode: "countries", countries: new Map(), cities: [], trips: [], photos: [], session: null, features: [], byCode: new Map(), selected: null, playing: false };
  const visited = (c) => c && (c.serhan || c.goknur || c.together || c.home);

  // ---------- Yıldızlar ----------
  function drawStars() {
    const cv = $("#stars"), dpr = devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const x = cv.getContext("2d"); x.scale(dpr, dpr);
    for (let i = 0; i < 160; i++) {
      x.globalAlpha = Math.random() * 0.8 + 0.1; x.fillStyle = "#fff";
      x.beginPath(); x.arc(Math.random() * innerWidth, Math.random() * innerHeight, Math.random() * 1.3, 0, 7); x.fill();
    }
  }

  // ---------- Dünya ----------
  const svg = d3.select("#globe");
  const defs = svg.append("defs");
  const glow = defs.append("radialGradient").attr("id", "glow");
  glow.append("stop").attr("offset", "82%").attr("stop-color", "#4cc9f0").attr("stop-opacity", 0.35);
  glow.append("stop").attr("offset", "100%").attr("stop-color", "#4cc9f0").attr("stop-opacity", 0);
  const both = defs.append("linearGradient").attr("id", "bothStroke");
  both.append("stop").attr("offset", "50%").attr("stop-color", COLORS.serhan);
  both.append("stop").attr("offset", "50%").attr("stop-color", COLORS.goknur);
  const gGlow = svg.append("circle").attr("fill", "url(#glow)");
  const gSphere = svg.append("path").attr("fill", COLORS.sea);
  const gGrat = svg.append("path").attr("fill", "none").attr("stroke", "rgba(255,255,255,.07)");
  const gCountries = svg.append("g");
  const gArcs = svg.append("g");
  const gCities = svg.append("g");
  const gBadges = svg.append("g").attr("class", "badges");
  const gHome = svg.append("circle").attr("class", "homeDot").attr("r", 6);
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.6);
  const path = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();
  let W, H, baseScale, zoomK = 1, lastInteract = 0, spinning = true;

  function layout() {
    W = innerWidth; H = innerHeight;
    baseScale = Math.min(W * 0.46, H * 0.3);
    projection.translate([W / 2, H * 0.47]).scale(baseScale * zoomK);
    gGlow.attr("cx", W / 2).attr("cy", H * 0.47);
    redraw();
  }

  function strokeFor(c) {
    if (!c) return "rgba(255,255,255,.12)";
    if (c.together) return COLORS.together;
    if (c.serhan && c.goknur) return "url(#bothStroke)";
    if (c.serhan) return COLORS.serhan;
    if (c.goknur) return COLORS.goknur;
    if (c.home === "lives") return COLORS.home;
    if (c.home === "lived") return COLORS.lived;
    if (c.wish) return COLORS.wish;
    return "rgba(255,255,255,.12)";
  }
  function fillFor(code) {
    const c = state.countries.get(code);
    if (state.mode === "cities") return visited(c) ? "#14304f" : "#0d1f38";
    if (visited(c)) return `url(#flag-${code})`;
    if (c?.wish) return "#4b4f8f";
    return COLORS.land;
  }
  function ensureFlagPattern(code) {
    const id = "flag-" + code;
    if (document.getElementById(id)) return;
    defs.append("pattern").attr("id", id).attr("patternContentUnits", "objectBoundingBox").attr("width", 1).attr("height", 1)
      .append("image").attr("href", flagUrl(code)).attr("width", 1).attr("height", 1).attr("preserveAspectRatio", "xMidYMid slice");
  }

  function paintCountries() {
    state.countries.forEach((c, code) => { if (visited(c)) ensureFlagPattern(code); });
    gCountries.selectAll("path.overseas").attr("fill", COLORS.land).attr("stroke", "rgba(255,255,255,.12)").attr("stroke-width", 0.5);
    gCountries.selectAll("path.country")
      .attr("fill", (f) => fillFor(f.properties.a2))
      .attr("stroke", (f) => strokeFor(state.countries.get(f.properties.a2)))
      .attr("stroke-width", (f) => { const c = state.countries.get(f.properties.a2); return visited(c) || c?.wish ? 1.8 : 0.5; })
      .attr("stroke-dasharray", (f) => { const c = state.countries.get(f.properties.a2); return c?.wish && !visited(c) ? "4 3" : null; })
      .classed("sel", (f) => f.properties.a2 === state.selected);
    const arcs = state.mode === "countries"
      ? [...state.countries.values()].filter((c) => (c.serhan || c.goknur || c.together) && c.code !== "TR" && state.byCode.get(c.code)).map((c) => ({ code: c.code, to: centroidOf(c.code), color: c.together ? COLORS.together : c.serhan && c.goknur ? "#a3e635" : c.serhan ? COLORS.serhan : COLORS.goknur }))
      : [];
    gArcs.selectAll("path").data(arcs, (d) => d.code).join("path").attr("class", "arc").attr("stroke", (d) => d.color)
      .style("filter", (d) => `drop-shadow(0 0 3px ${d.color})`);
    renderCities();
    renderBadges();
    redraw();
  }

  // ---------- Sero & Gorki portre rozetleri ----------
  const badgeKind = (c) => c.together ? "birlikte" : c.serhan && c.goknur ? "ikimiz-ayri" : c.serhan ? "sero" : c.goknur ? "gorki" : null;
  const BADGE_COLOR = { sero: COLORS.serhan, gorki: COLORS.goknur, "ikimiz-ayri": "url(#bothStroke)", birlikte: COLORS.together };
  const areaCache = new Map();
  const areaOf = (code) => { if (!areaCache.has(code)) { const f = state.byCode.get(code); areaCache.set(code, f ? d3.geoArea(mainland(f)) : 0); } return areaCache.get(code); };
  function renderBadges() {
    const list = state.mode === "countries"
      ? [...state.countries.values()].filter((c) => !c.home && badgeKind(c) && state.byCode.get(c.code))
          .map((c) => ({ code: c.code, kind: badgeKind(c), at: centroidOf(c.code), area: areaOf(c.code) }))
          .sort((a, b) => b.area - a.area)
      : [];
    gBadges.selectAll("g.badge").data(list, (d) => d.code + d.kind).join((en) => {
      const g = en.append("g").attr("class", "badge").on("click", (ev, d) => openCountry(d.code));
      appendBadge(g);
      return g;
    }).order();
  }
  // Rozetleri yerleştir: öncelikli olan önce; çakışan rozet küçük renkli noktaya döner, yaklaştırınca açılır
  const badgeSize = () => Math.min(16 + zoomK * 8, 46);
  function layoutBadges(sel, center, posOf, placeOrder, prio) {
    const bs = badgeSize(), gap = bs * 0.92, placed = [];
    let reorder = false;
    sel.nodes().sort((a, b) => placeOrder(a.__data__, b.__data__)).forEach(function (el) { (function (d) {
      const p = posOf(d), vis = d3.geoDistance(p, center) < 1.45;
      this.style.display = vis ? "" : "none";
      if (!vis) return;
      const [x, y] = projection(p);
      const full = !placed.some(([px, py]) => Math.hypot(px - x, py - y) < gap);
      if (full) { placed.push([x, y]); if (d.photo) placed.push([x, y - bs / 2 - 36], [x, y - bs / 2 - 18], [x, y - bs / 2 - 62]); } // balon da yer kaplar
      this.setAttribute("transform", `translate(${x},${y})`);
      if (this.classList.contains("mini") === full) { this.classList.toggle("mini", !full); d.full = full; reorder = true; }
      const img = this.querySelector("image.av");
      img.setAttribute("x", -bs / 2); img.setAttribute("y", -bs / 2); img.setAttribute("width", bs); img.setAttribute("height", bs);
      this.querySelector(".bhit").setAttribute("r", full ? bs / 2 : 10);
      const bal = this.querySelector(".bal"); if (bal) bal.setAttribute("transform", `translate(0,${-bs / 2 + 2})`);
      const nm = this.querySelector(".cityName"); if (nm) nm.setAttribute("y", bal ? -bs / 2 - 64 + 2 : bs / 2 + 13);
    }).call(el, el.__data__); });
    if (reorder) sel.sort((a, b) => (a.full ? 1 : 0) - (b.full ? 1 : 0) || prio(a, b)); // tam rozetler üstte
    return placed;
  }
  function appendBadge(g) {
    g.append("circle").attr("class", "bdot").attr("r", 4.5).attr("fill", (d) => BADGE_COLOR[d.kind]).attr("stroke", "#fff").attr("stroke-width", 1.5);
    g.append("image").attr("class", "av").attr("href", (d) => `avatars/${d.kind}.svg?v=8`);
    g.append("circle").attr("class", "bhit").attr("fill", "transparent");
  }

  // ---------- Şehirler: gece ışıkları + fotoğraf balonları ----------
  const cityGlow = defs.append("filter").attr("id", "cityGlow").attr("x", "-200%").attr("y", "-200%").attr("width", "500%").attr("height", "500%");
  cityGlow.append("feGaussianBlur").attr("stdDeviation", 3.5);
  const cityColor = (d) => d.home === "lives" ? COLORS.home : d.home === "lived" ? COLORS.lived : d.wish ? COLORS.wish : "#ffd27a";
  const whoColor = (d) => d.together || (d.serhan && d.goknur) ? COLORS.together : d.serhan ? COLORS.serhan : d.goknur ? COLORS.goknur : cityColor(d);
  function cityPhoto(c) {
    const n = c.name.toLocaleLowerCase("tr");
    const trips = state.trips.filter((t) => t.country_code === c.country_code &&
      ((t.city && t.city.toLocaleLowerCase("tr") === n) || (t.title || "").toLocaleLowerCase("tr").includes(n) || (t.note || "").toLocaleLowerCase("tr").includes(n)));
    for (const t of trips) { const p = state.photos.find((x) => x.trip_id === t.id && !isVideo(x.path)); if (p) return p; }
    return null;
  }
  function renderCities() {
    const nightMode = state.mode === "cities";
    const cities = state.cities.map((c) => ({ ...c, photo: nightMode ? cityPhoto(c) : null, mini: !nightMode, kind: nightMode ? badgeKind(c) : null }));
    gCities.classed("mini", !nightMode);
    gSphere.attr("fill", state.mode === "cities" ? "#081a33" : COLORS.sea);
    gHome.attr("visibility", state.mode === "cities" ? "hidden" : null);
    const g = gCities.selectAll("g.city").data(cities, (d) => d.id + (d.photo ? "p" + d.photo.id : "") + (d.mini ? "m" : "") + (d.kind || ""))
      .join((enter) => {
        const e = enter.append("g").attr("class", (d) => "city" + (d.kind ? " badge pbadge" : d.wish ? " wishc" : " light"));
        e.each(function (d) {
          const el = d3.select(this);
          if (d.mini) {
            el.append("circle").attr("r", 3).attr("fill", "#fff").attr("stroke", whoColor(d)).attr("stroke-width", 1.5);
            el.append("text").attr("class", "cityName").attr("x", 6).attr("y", 4).text(d.name);
          } else if (d.kind) {
            // portre rozeti; fotoğrafı varsa üstünde fotoğraf balonu
            if (d.photo) {
              const pid = "cp-" + d.id, b = el.append("g").attr("class", "bal balloon");
              b.append("clipPath").attr("id", pid).append("circle").attr("cy", -38).attr("r", 18);
              b.append("line").attr("y1", 0).attr("y2", -17).attr("stroke", "#fff").attr("stroke-width", 1.5);
              b.append("circle").attr("cy", -38).attr("r", 21).attr("fill", whoColor(d));
              b.append("image").attr("href", mediaUrl(d.photo)).attr("x", -18).attr("y", -56).attr("width", 36).attr("height", 36).attr("preserveAspectRatio", "xMidYMid slice").attr("clip-path", `url(#${pid})`);
            }
            appendBadge(el);
            el.append("text").attr("class", "cityName" + (d.photo ? " always" : "")).attr("text-anchor", "middle").text(d.name);
            return;
          } else if (d.wish && !d.home) {
            el.append("circle").attr("class", "pulse").attr("r", 5).attr("fill", "none").attr("stroke", COLORS.wish).attr("stroke-width", 1.5);
            el.append("circle").attr("r", 4.5).attr("fill", "rgba(167,139,250,.25)").attr("stroke", COLORS.wish).attr("stroke-width", 1.5).attr("stroke-dasharray", "2 2");
            el.append("text").attr("class", "cityName").attr("x", 8).attr("y", 4).text(d.name);
          } else {
            el.append("circle").attr("r", 8).attr("fill", cityColor(d)).attr("filter", "url(#cityGlow)").attr("class", "glow");
            el.append("circle").attr("r", 2.6).attr("fill", "#fff");
            el.append("text").attr("class", "cityName").attr("x", 8).attr("y", 4).text(d.name);
          }
          el.append("circle").attr("r", 14).attr("cy", d.photo ? -30 : 0).attr("fill", "transparent"); // dokunma alanı
        });
        return e;
      })
      .on("click", (ev, d) => openCountry(d.country_code));
    g.sort(cityDraw);
  }
  // öncelik: fotoğraflı > ev > birlikte > diğerleri
  const cityRank = (d) => (d.photo ? 8 : 0) + (d.home ? 4 : 0) + (d.together ? 2 : 0) + (d.kind ? 1 : 0);
  const cityPrio = (a, b) => cityRank(b) - cityRank(a);
  const cityDraw = (a, b) => cityRank(a) - cityRank(b); // önemli olan en üstte çizilir

  function redraw() {
    gSphere.attr("d", path({ type: "Sphere" }));
    gGrat.attr("d", path(graticule));
    gGlow.attr("r", projection.scale() * 1.13);
    $(".hero").style.opacity = zoomK > 1.6 ? 0 : 1;
    gCountries.selectAll("path").attr("d", path);
    gArcs.selectAll("path").attr("d", (d) => path(arcLine(d.to)));
    const center = projection.invert([W / 2, H * 0.47]);
    gCities.classed("labels", zoomK >= (state.mode === "cities" ? 2.2 : 3.2)).classed("hide", state.mode !== "cities" && zoomK < 2.4).classed("wishNames", zoomK >= 3.6).selectAll("g.city:not(.pbadge)").each(function (d) {
      const vis = d3.geoDistance([d.lon, d.lat], center) < 1.5;
      const [x, y] = projection([d.lon, d.lat]);
      this.setAttribute("transform", `translate(${x},${y})`);
      this.style.display = vis ? "" : "none";
    });
    layoutBadges(gBadges.selectAll("g.badge"), center, (d) => d.at, (a, b) => b.area - a.area, (a, b) => b.area - a.area);
    layoutBadges(gCities.selectAll("g.pbadge"), center, (d) => [d.lon, d.lat], cityPrio, cityDraw);
    const hv = d3.geoDistance(HOME, center) < 1.5, [hx, hy] = projection(HOME);
    gHome.attr("cx", hx).attr("cy", hy).attr("display", hv ? null : "none");
  }

  // Büyük daire yerine biraz yükselen yay: ara noktaları interpolasyonla üret
  function arcLine(to) {
    const ip = d3.geoInterpolate(HOME, to), pts = [];
    for (let i = 0; i <= 24; i++) pts.push(ip(i / 24));
    return { type: "LineString", coordinates: pts };
  }

  function mainland(f) {
    if (f.geometry.type !== "MultiPolygon") return f;
    let best = f, area = -1;
    for (const coords of f.geometry.coordinates) {
      const part = { type: "Feature", geometry: { type: "Polygon", coordinates: coords } };
      const a = d3.geoArea(part); if (a > area) { area = a; best = part; }
    }
    return best;
  }
  // Denizaşırı parçaları (ör. Fransız Guyanası, Svalbard, Hawaii) ana ülkeden ayır: boyanmaz, tıklanmaz.
  // Ana parçaya (ya da ona bağlı parçalara) 500 km'den yakın adalar ülkeye dahil kalır.
  function splitOverseas(f) {
    if (f.geometry.type !== "MultiPolygon") return [f, null];
    const parts = f.geometry.coordinates;
    const areas = parts.map((c) => d3.geoArea({ type: "Polygon", coordinates: c }));
    const main = areas.indexOf(Math.max(...areas)), kept = new Set([main]), th = 500 / 6371;
    const near = (a, b) => { for (const p of parts[a][0]) for (const q of parts[b][0]) if (d3.geoDistance(p, q) < th) return true; return false; };
    let changed = true;
    while (changed) { changed = false; for (let i = 0; i < parts.length; i++) if (!kept.has(i)) for (const k of kept) if (near(i, k)) { kept.add(i); changed = true; break; } }
    if (f.properties.a2 === "US") parts.forEach((c, i) => { const [lon, lat] = d3.geoCentroid({ type: "Polygon", coordinates: c }); if (lon < -130 && lat > 50) kept.add(i); }); // Alaska eyalet
    if (kept.size === parts.length) return [f, null];
    const keep = parts.filter((_, i) => kept.has(i)), rest = parts.filter((_, i) => !kept.has(i));
    return [
      { type: "Feature", properties: f.properties, geometry: { type: "MultiPolygon", coordinates: keep } },
      { type: "Feature", properties: { a2: f.properties.a2, overseas: true }, geometry: { type: "MultiPolygon", coordinates: rest } },
    ];
  }

  const centroidCache = new Map();
  function centroidOf(code) {
    if (!centroidCache.has(code)) { const f = state.byCode.get(code); centroidCache.set(code, f ? d3.geoCentroid(mainland(f)) : HOME); }
    return centroidCache.get(code);
  }

  // Sürükle = döndür, iki parmak / tekerlek = yakınlaştır
  function setupInteraction() {
    let prev;
    const zoom = d3.zoom().scaleExtent([0.8, 8])
      .on("start", (ev) => { stopSpin(); prev = ev.transform; })
      .on("zoom", (ev) => {
        const t = ev.transform;
        if (Math.abs(t.k - prev.k) > 1e-6) {
          // tekerlek / iki parmak: yalnızca yakınlaştır, döndürme
          zoomK = t.k; projection.scale(baseScale * zoomK);
        } else {
          const k = 0.25 / zoomK, r = projection.rotate();
          projection.rotate([r[0] + (t.x - prev.x) * k, Math.max(-85, Math.min(85, r[1] - (t.y - prev.y) * k)), r[2]]);
        }
        prev = t; redraw();
      })
      .on("end", () => { lastInteract = Date.now(); });
    svg.call(zoom).on("dblclick.zoom", null);
    state.zoom = zoom;
  }
  function stopSpin() { spinning = false; lastInteract = Date.now(); }

  d3.timer((elapsed) => {
    if (!spinning && !state.playing && $("#story").hidden && $("#sheet").hidden && Date.now() - lastInteract > 6000) spinning = true;
    if (spinning && !flying) { const r = projection.rotate(); projection.rotate([r[0] + 0.12, r[1], r[2]]); redraw(); }
  });

  let flying = false;
  function flyTo(code, ms = 1400) {
    const f = state.byCode.get(code); if (!f) return Promise.resolve();
    stopSpin(); flying = true;
    const [lon, lat] = centroidOf(code);
    const m = mainland(f), b = d3.geoBounds(m);
    const span = Math.max(Math.abs(b[1][0] - b[0][0]), Math.abs(b[1][1] - b[0][1]), 1);
    const targetK = Math.max(1, Math.min(6, 40 / span));
    const r0 = projection.rotate(), r1 = [-lon, -lat * 0.85, 0];
    // en kısa yönden dön
    while (r1[0] - r0[0] > 180) r1[0] -= 360; while (r1[0] - r0[0] < -180) r1[0] += 360;
    const ir = d3.interpolate(r0, r1), k0 = zoomK;
    return new Promise((res) => {
      d3.transition().duration(ms).ease(d3.easeCubicInOut).tween("fly", () => (t) => {
        projection.rotate(ir(t));
        // önce biraz uzaklaş, sonra yaklaş (uçuş hissi)
        zoomK = k0 + (targetK - k0) * t - Math.sin(Math.PI * t) * 0.35 * Math.min(k0, targetK);
        projection.scale(baseScale * Math.max(0.7, zoomK)); redraw();
      }).on("end", () => {
        flying = false; zoomK = targetK;
        svg.call(state.zoom.transform, d3.zoomIdentity.scale(zoomK)); res();
      });
    });
  }
  function flyHome(ms = 1000) {
    const r0 = projection.rotate(), r1 = [-25, -38, 0], ir = d3.interpolate(r0, r1), k0 = zoomK;
    d3.transition().duration(ms).ease(d3.easeCubicInOut).tween("home", () => (t) => {
      projection.rotate(ir(t)); zoomK = k0 + (1 - k0) * t; projection.scale(baseScale * zoomK); redraw();
    }).on("end", () => svg.call(state.zoom.transform, d3.zoomIdentity));
  }

  async function initGlobe() {
    const topo = await (await fetch("data/world110.json")).json();
    const all = topojson.feature(topo, topo.objects.countries).features.filter((f) => f.properties.a2 && f.properties.a2 !== "AQ");
    const overseas = [];
    state.features = all.map((f) => { const [m, o] = splitOverseas(f); if (o) overseas.push(o); return m; });
    state.features.forEach((f) => state.byCode.set(f.properties.a2, f));
    gCountries.selectAll("path").data([...overseas, ...state.features]).join("path")
      .attr("class", (f) => f.properties.overseas ? "overseas" : "country")
      .on("click", (ev, f) => { if (!f.properties.overseas) openCountry(f.properties.a2); });
    projection.rotate([-25, -38, 0]);
    layout(); setupInteraction();
    $("#countrylist").innerHTML = state.features.map((f) => nameOf(f.properties.a2, f.properties.en))
      .sort((a, b) => a.localeCompare(b, "tr")).map((n) => `<option value="${esc(n)}">`).join("");
  }

  // ---------- Üst bilgi, bayrak şeridi, lejant ----------
  function countUp(el, to, prefix = "") {
    const from = Number(el.dataset.v || 0); el.dataset.v = to;
    d3.select(el).transition().duration(1200).ease(d3.easeCubicOut)
      .tween("t", () => { const i = d3.interpolateNumber(from, to); return (t) => (el.textContent = prefix + Math.round(i(t))); });
  }
  function renderStats() {
    let v = 0, tog = 0;
    state.countries.forEach((c) => { if (c.code.includes("-")) return; if (visited(c)) v++; if (c.together) tog++; });
    countUp($("#statCountries"), v);
    countUp($("#statPercent"), Math.round((v / CFG.totalCountries) * 100), "%");
    countUp($("#statTogether"), tog);
    countUp($("#statCities"), state.cities.filter((c) => c.serhan || c.goknur || c.together || c.home).length);
  }
  function lastTripDate(code) {
    const t = state.trips.filter((x) => x.country_code === code && x.start_date).map((x) => x.start_date).sort().pop();
    return t || "";
  }
  function renderFlagStrip() {
    const list = [...state.countries.values()].filter((c) => visited(c) && state.byCode.get(c.code) && !c.code.includes("-"))
      .sort((a, b) => (lastTripDate(b.code).localeCompare(lastTripDate(a.code))) || nameOf(a.code).localeCompare(nameOf(b.code), "tr"));
    $("#flagstrip").innerHTML = list.map((c, i) => {
      const col = strokeFor(c).startsWith("url") ? COLORS.serhan : strokeFor(c);
      return `<button data-code="${c.code}" title="${esc(nameOf(c.code))}" style="background-image:url(${flagUrl(c.code)});border-color:${col};animation-delay:${i * 40}ms"></button>`;
    }).join("");
  }
  function renderLegend() {
    $("#legend").innerHTML = LEGEND.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("");
  }
  function renderAll() { paintCountries(); renderStats(); renderFlagStrip(); }

  // ---------- Veri ----------
  async function loadData() {
    const [c, ci, t, p] = await Promise.all([
      sb.from("countries").select("*"), sb.from("cities").select("*"),
      sb.from("trips").select("*").order("start_date", { ascending: true, nullsFirst: false }),
      sb.from("photos").select("*").order("created_at"),
    ]);
    for (const r of [c, ci, t, p]) if (r.error) throw r.error;
    state.countries = new Map(c.data.map((r) => [r.code, r]));
    state.cities = ci.data; state.trips = t.data; state.photos = p.data;
  }
  const mediaUrl = (p) => sb.storage.from("photos").getPublicUrl(p.path).data.publicUrl;

  // ---------- Gezi hikâyesi ----------
  let story = null, storyTimer = null;
  const STORY_MS = 6500;

  async function openCountry(code, opts = {}) {
    if (!code) return;
    state.selected = code; paintCountries();
    await flyTo(code, opts.flyMs || 1200);
    showStory(code, 0, opts);
  }

  function storyPages(code) {
    const trips = state.trips.filter((t) => t.country_code === code);
    return trips.length ? trips.map((t) => ({ trip: t })) : [{ trip: null }];
  }

  function showStory(code, idx = 0, opts = {}) {
    const pages = storyPages(code);
    story = { code, idx: Math.max(0, Math.min(idx, pages.length - 1)), pages, opts };
    $("#story").hidden = false;
    renderStoryPage();
  }

  function renderStoryPage() {
    clearTimeout(storyTimer);
    const { code, idx, pages } = story;
    const c = state.countries.get(code) || {};
    const trip = pages[idx].trip;
    const media = trip ? state.photos.filter((p) => p.trip_id === trip.id) : [];
    const name = nameOf(code, state.byCode.get(code)?.properties.en);
    // arka plan: ilk video/fotoğraf, yoksa bulanık bayrak
    const bg = $("#stBg"); const first = media[0];
    bg.innerHTML = first
      ? isVideo(first.path) ? `<video src="${mediaUrl(first)}" autoplay muted loop playsinline></video>` : `<img src="${mediaUrl(first)}" alt="">`
      : `<div class="flagbg" style="background-image:url(${flagUrl(code)})"></div>`;
    // ilerleme çubukları
    $("#stBars").innerHTML = pages.map((_, i) => `<div class="${i < idx ? "done" : i === idx ? "run" : ""}" style="--dur:${STORY_MS}ms"><i></i></div>`).join("");
    // damga
    const col = strokeFor(c).startsWith("url") ? COLORS.together : strokeFor(c).startsWith("rgba") ? COLORS.wish : strokeFor(c);
    const d = trip?.start_date ? new Date(trip.start_date + "T00:00:00") : null;
    const dateTxt = d ? `${String(d.getDate()).padStart(2, "0")} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}` : c.home === "lives" ? "EVİMİZ" : c.home === "lived" ? "YAŞADIK" : visited(c) ? "GİDİLDİ" : c.wish ? "BİR GÜN" : "";
    const whoTxt = trip ? WHO[trip.who] : c.together ? WHO.together : c.serhan && c.goknur ? "SERO · GORKI" : c.serhan ? "SERO" : c.goknur ? "GORKI" : "";
    const st = $("#stStamp");
    st.style.setProperty("--c", col);
    st.innerHTML = `<div><img src="${flagUrl(code)}" alt=""><div class="n">${esc(name.toLocaleUpperCase("tr"))}</div><div class="d">${dateTxt}</div><div class="w">${esc((whoTxt || "").toLocaleUpperCase("tr"))}</div></div>`;
    st.style.animation = "none"; void st.offsetWidth; st.style.animation = "";
    // metin
    const km = Math.round(d3.geoDistance(HOME, centroidOf(code)) * 6371);
    $("#stRoute").textContent = code === "TR" ? "🏠 Evimiz" : `✈ İstanbul → ${name} · ${km.toLocaleString("tr-TR")} km`;
    $("#stTitle").textContent = trip?.title || (visited(c) ? name : c.wish ? `${name} sırada` : name);
    const statusLine = [c.together && "Birlikte gittik", c.serhan && !c.together && "Sero gitti", c.goknur && !c.together && "Gorki gitti", c.home === "lives" && "Burada yaşıyoruz", c.home === "lived" && "Bir dönem burada yaşadık", c.wish && "Gitmek istiyoruz"].filter(Boolean).join(" · ");
    $("#stNote").textContent = trip?.note || (trip ? "" : statusLine + (state.session ? "\nDüzenle'ye basıp gezi, not ve fotoğraf ekleyebilirsiniz." : ""));
    const cities = state.cities.filter((x) => x.country_code === code && !x.wish).map((x) => x.name);
    if (!trip && cities.length) $("#stNote").textContent += `\n📍 ${cities.join(", ")}`;
    $("#stThumbs").innerHTML = media.map((p, i) => `<div class="th" data-i="${i}">${isVideo(p.path) ? `<video src="${mediaUrl(p)}#t=0.5" muted playsinline preload="metadata"></video><span class="v">▶</span>` : `<img src="${mediaUrl(p)}" loading="lazy" alt="">`}</div>`).join("");
    $("#stEdit").hidden = !state.session || state.playing;
    $("#stPlayStop").hidden = !state.playing;
    // gezinin içindeki fotoğraflar arasında arka planı döndür
    if (media.length > 1 && !isVideo(media[0].path)) cycleBg(media.filter((m) => !isVideo(m.path)));
    storyTimer = setTimeout(nextPage, STORY_MS);
  }
  let bgCycle;
  function cycleBg(imgs) {
    clearInterval(bgCycle); let i = 0;
    bgCycle = setInterval(() => {
      i = (i + 1) % imgs.length;
      const im = new Image(); im.src = mediaUrl(imgs[i]); im.alt = ""; im.style.opacity = 0; im.style.transition = "opacity .8s";
      $("#stBg").appendChild(im); requestAnimationFrame(() => (im.style.opacity = 1));
      const all = $("#stBg").querySelectorAll("img"); if (all.length > 2) all[0].remove();
    }, Math.max(1800, STORY_MS / imgs.length));
  }
  function nextPage() {
    if (!story) return;
    if (story.idx < story.pages.length - 1) { story.idx++; renderStoryPage(); return; }
    if (state.playing) { playNext(); return; }
    clearTimeout(storyTimer); // son sayfada bekle
    $("#stBars").querySelectorAll("div").forEach((d) => (d.className = "done"));
  }
  function prevPage() { if (story && story.idx > 0) { story.idx--; renderStoryPage(); } }
  function closeStory() {
    clearTimeout(storyTimer); clearInterval(bgCycle);
    $("#story").hidden = true; $("#stBg").innerHTML = ""; story = null;
    if (state.playing) stopPlay();
    state.selected = null; paintCountries(); lastInteract = Date.now();
    if (!state.playing) flyHome(900);
  }

  // ---------- Oynat: tüm geziler sırayla ----------
  let playQueue = [];
  function buildQueue() {
    const dated = state.trips.filter((t) => state.byCode.get(t.country_code)).slice()
      .sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999"));
    const q = []; const seen = new Set();
    for (const t of dated) { if (!seen.has(t.country_code)) { q.push(t.country_code); seen.add(t.country_code); } }
    // gezisi girilmemiş gidilen ülkeleri de ekle
    [...state.countries.values()].filter((c) => (c.serhan || c.goknur || c.together) && !seen.has(c.code) && state.byCode.get(c.code) && !c.code.includes("-"))
      .sort((a, b) => centroidOf(a.code)[0] - centroidOf(b.code)[0]).forEach((c) => q.push(c.code));
    return q;
  }
  function startPlay() {
    playQueue = buildQueue();
    if (!playQueue.length) return toast("Oynatılacak gezi yok");
    state.playing = true; $("#playBtn").textContent = "■ Durdur";
    playNext();
  }
  async function playNext() {
    if (!state.playing) return;
    const code = playQueue.shift();
    if (!code) { stopPlay(); closeStory(); flyHome(); toast("Gezilerin sonu ✈"); return; }
    $("#story").hidden = true; clearTimeout(storyTimer);
    state.selected = code; paintCountries();
    await flyTo(code, 1600);
    if (!state.playing) return;
    showStory(code, 0, { playing: true });
  }
  function stopPlay() { state.playing = false; $("#playBtn").textContent = "▶ Oynat"; $("#stPlayStop").hidden = true; }

  // ---------- Düzenleme paneli ----------
  function openSheet() {
    const code = story?.code; if (!code) return;
    clearTimeout(storyTimer);
    $("#cName").textContent = nameOf(code, state.byCode.get(code)?.properties.en);
    const c = state.countries.get(code) || {};
    $("#cEdit").querySelectorAll("[data-f]").forEach((el) => { const k = el.dataset.f; if (el.type === "checkbox") el.checked = !!c[k]; else el.value = c[k] || ""; });
    renderTrips(); $("#tripForm").hidden = true; $("#addTripBtn").hidden = false;
    $("#sheet").hidden = false; $("#sheet").scrollTop = 0;
  }
  function closeSheet() {
    $("#sheet").hidden = true;
    if (story) showStory(story.code, story.idx);
  }
  function renderTrips() {
    const code = story.code, trips = state.trips.filter((t) => t.country_code === code);
    $("#cTrips").innerHTML = trips.length ? trips.map((t) => {
      const md = state.photos.filter((p) => p.trip_id === t.id);
      const dates = [fmtDate(t.start_date), fmtDate(t.end_date)].filter(Boolean).join(" – ");
      return `<div class="trip"><div class="t">${esc(t.title || "Gezi")}</div><div class="d">${esc(WHO[t.who] || "")}${dates ? " · " + dates : ""}</div>
        ${t.note ? `<div style="margin:6px 0;white-space:pre-wrap">${esc(t.note)}</div>` : ""}
        <div class="media">${md.map((p) => `<div class="m">${isVideo(p.path) ? `<video src="${mediaUrl(p)}#t=0.5" muted playsinline preload="metadata"></video>` : `<img src="${mediaUrl(p)}" loading="lazy">`}<button class="del" data-photo="${p.id}" aria-label="Sil">✕</button></div>`).join("")}</div>
        <div class="acts"><label class="small primary" style="color:#fff">📷 Fotoğraf / video ekle<input type="file" accept="image/*,video/*" multiple hidden data-upload="${t.id}"></label>
        <button class="small" data-deltrip="${t.id}">Geziyi sil</button></div></div>`;
    }).join("") : `<p class="muted">Henüz gezi yok. Bir gezi ekleyip fotoğraf ve video yükleyin.</p>`;
  }
  const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";

  async function saveStatus() {
    const code = story.code, row = { code, updated_at: new Date().toISOString() };
    $("#cEdit").querySelectorAll("[data-f]").forEach((el) => { row[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value || null; });
    const { data, error } = await sb.from("countries").upsert(row).select().single();
    if (error) return toast(errMsg(error));
    state.countries.set(code, data); renderAll(); toast("Kaydedildi");
  }
  async function addTrip(ev) {
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(ev.target));
    for (const k of Object.keys(fd)) if (fd[k] === "") fd[k] = null;
    fd.country_code = story.code;
    const { data, error } = await sb.from("trips").insert(fd).select().single();
    if (error) return toast(errMsg(error));
    state.trips.push(data); ev.target.reset(); $("#tripForm").hidden = true; $("#addTripBtn").hidden = false;
    renderTrips(); renderFlagStrip(); toast("Gezi eklendi, şimdi fotoğraf ekleyebilirsiniz");
  }
  async function shrink(file) {
    if (file.type.startsWith("video/")) return file;
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      return await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    } catch { return file; }
  }
  async function uploadMedia(tripId, files) {
    let done = 0;
    for (const file of files) {
      if (file.type.startsWith("video/") && file.size > 50 * 1024 * 1024) { toast("Video 50 MB'tan büyük, atlandı"); continue; }
      toast(`Yükleniyor ${done + 1}/${files.length}…`, 120000);
      const blob = await shrink(file);
      const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase();
      const p = `${story.code}/${tripId}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from("photos").upload(p, blob, { contentType: blob.type || file.type });
      if (up.error) { toast(errMsg(up.error)); return; }
      const { data, error } = await sb.from("photos").insert({ trip_id: tripId, path: p }).select().single();
      if (error) { toast(errMsg(error)); return; }
      state.photos.push(data); done++;
    }
    toast(`${done} dosya eklendi`); renderTrips();
  }
  async function deletePhoto(id) {
    const p = state.photos.find((x) => x.id === id);
    if (!p || !confirm("Bu dosya silinsin mi?")) return;
    await sb.storage.from("photos").remove([p.path]);
    const { error } = await sb.from("photos").delete().eq("id", id);
    if (error) return toast(errMsg(error));
    state.photos = state.photos.filter((x) => x.id !== id); renderTrips();
  }
  async function deleteTrip(id) {
    if (!confirm("Bu gezi ve tüm fotoğrafları silinsin mi?")) return;
    const paths = state.photos.filter((p) => p.trip_id === id).map((p) => p.path);
    if (paths.length) await sb.storage.from("photos").remove(paths);
    const { error } = await sb.from("trips").delete().eq("id", id);
    if (error) return toast(errMsg(error));
    state.trips = state.trips.filter((t) => t.id !== id); state.photos = state.photos.filter((p) => p.trip_id !== id);
    renderTrips(); renderFlagStrip();
  }

  // ---------- Giriş ----------
  async function refreshSession() {
    const { data } = await sb.auth.getSession();
    state.session = data.session;
    $("#loginBtn").classList.toggle("on", !!state.session);
  }
  async function login() {
    const fd = Object.fromEntries(new FormData($("#loginForm")));
    const { error } = await sb.auth.signInWithPassword({ email: fd.email, password: fd.password });
    if (error) { $("#loginMsg").textContent = errMsg(error); return; }
    $("#loginDlg").close(); await refreshSession();
    toast("Giriş yapıldı. Bir ülkeye dokunup Düzenle'ye basın.");
  }

  // ---------- Yardımcılar ----------
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function errMsg(e) {
    const m = e?.message || String(e);
    if (/row-level security|violates|permission|Unauthorized|403/i.test(m)) return "Bu hesabın düzenleme yetkisi yok.";
    if (/Invalid login/i.test(m)) return "E-posta ya da şifre hatalı.";
    if (/Email not confirmed/i.test(m)) return "Hesap henüz onaylanmadı.";
    if (/only request this after/i.test(m)) return "Çok hızlı denendi, yarım dakika sonra tekrar deneyin.";
    if (/mime type|not supported/i.test(m)) return "Bu dosya türü desteklenmiyor.";
    if (/exceeded the maximum|too large/i.test(m)) return "Dosya çok büyük.";
    return m;
  }
  let toastT;
  function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }
  function showLightbox(p) {
    $("#lbMedia").innerHTML = isVideo(p.path) ? `<video src="${mediaUrl(p)}" controls autoplay playsinline></video>` : `<img src="${mediaUrl(p)}" alt="">`;
    $("#lightbox").hidden = false; clearTimeout(storyTimer);
  }

  // ---------- Olaylar ----------
  function setMode(m) { state.mode = m; $("#modeCountries").classList.toggle("on", m === "countries"); $("#modeCities").classList.toggle("on", m === "cities"); paintCountries(); }
  on("#modeCountries", "click", () => setMode("countries"));
  on("#modeCities", "click", () => setMode("cities"));
  on("#playBtn", "click", () => (state.playing ? (stopPlay(), closeStory()) : startPlay()));
  on("#stPlayStop", "click", () => { stopPlay(); closeStory(); });
  on("#stClose", "click", closeStory);
  on("#stNext", "click", nextPage);
  on("#stPrev", "click", prevPage);
  on("#stEdit", "click", openSheet);
  on("#stThumbs", "click", (e) => { const th = e.target.closest(".th"); if (!th || !story) return; const trip = story.pages[story.idx].trip; const md = state.photos.filter((p) => p.trip_id === trip?.id); if (md[th.dataset.i]) showLightbox(md[th.dataset.i]); });
  on("#flagstrip", "click", (e) => { const b = e.target.closest("button[data-code]"); if (b) openCountry(b.dataset.code); });
  on("#sheetClose", "click", closeSheet);
  on("#cEdit", "change", saveStatus);
  on("#addTripBtn", "click", () => { $("#tripForm").hidden = false; $("#addTripBtn").hidden = true; });
  on("#tripCancel", "click", () => { $("#tripForm").hidden = true; $("#addTripBtn").hidden = false; });
  on("#tripForm", "submit", addTrip);
  on("#cTrips", "change", (e) => { const id = e.target.dataset.upload; if (id && e.target.files.length) uploadMedia(Number(id), [...e.target.files]); });
  on("#cTrips", "click", (e) => { const t = e.target; if (t.dataset.photo) deletePhoto(Number(t.dataset.photo)); if (t.dataset.deltrip) deleteTrip(Number(t.dataset.deltrip)); });
  on("#lightbox", "click", () => { $("#lightbox").hidden = true; $("#lbMedia").innerHTML = ""; if (story) storyTimer = setTimeout(nextPage, 2500); });
  on("#loginBtn", "click", async () => {
    if (state.session) { if (confirm("Çıkış yapılsın mı?")) { await sb.auth.signOut(); await refreshSession(); } return; }
    $("#loginMsg").textContent = ""; $("#loginDlg").showModal();
  });
  on("#loginForm", "submit", (e) => { e.preventDefault(); login(); });
  on("#loginCancel", "click", () => $("#loginDlg").close());
  on("#search", "change", (e) => {
    const q = e.target.value.trim().toLocaleLowerCase("tr"); if (!q) return;
    const f = state.features.find((x) => nameOf(x.properties.a2, x.properties.en).toLocaleLowerCase("tr") === q)
      || state.features.find((x) => nameOf(x.properties.a2, x.properties.en).toLocaleLowerCase("tr").startsWith(q));
    if (f) { e.target.value = ""; e.target.blur(); openCountry(f.properties.a2); }
  });
  on("#shareBtn", "click", async () => {
    const url = location.href.split("#")[0];
    if (navigator.share) { try { await navigator.share({ title: "Sero & Gorki · Gezi Haritası", url }); } catch {} }
    else { try { await navigator.clipboard.writeText(url); toast("Bağlantı kopyalandı"); } catch { toast(url, 6000); } }
  });
  addEventListener("resize", () => { drawStars(); layout(); });

  // ---------- Başlat ----------
  (async () => {
    drawStars(); renderLegend();
    try {
      await Promise.all([initGlobe(), loadData(), refreshSession()]);
      $("#loading").hidden = true;
      renderAll();
    } catch (e) {
      console.error(e); $("#loading").textContent = "Yüklenemedi: " + errMsg(e);
    }
    sb.auth.onAuthStateChange(() => refreshSession());
  })();
})();
