import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const CATS = ["echecs", "calisthenics", "anglais", "sport", "meditation", "marcher", "manger"];
const COLORS = {
  echecs: "#0B6623", calisthenics: "#7B2CBF", anglais: "#1E88E5",
  sport: "#FB8C00", meditation: "#757575", marcher: "#7B4F2E", manger: "#C0392B",
};
const LABELS = {
  echecs: "Échecs", calisthenics: "Calisthenics", anglais: "Anglais",
  sport: "Sport", meditation: "Méditation", marcher: "Marcher", manger: "Manger / Boire",
};

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayKey() {
  const n = new Date();
  return dateKey(n.getFullYear(), n.getMonth(), n.getDate());
}
function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isFuture(k) { return k > todayKey(); }
function isToday(k) { return k === todayKey(); }

function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function weekKeyFromYM(year, month, day) {
  return weekKey(new Date(year, month, day));
}
function mondayOfWeek(wk) {
  const [y, w] = wk.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (w - 1) * 7);
  return monday;
}
function weekLabel(wk) {
  const monday = mondayOfWeek(wk);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

const MONTH_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAY_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

export default function App() {
  const [data, setData] = useState({});
  const [weekData, setWeekData] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("calendar");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [panel, setPanel] = useState(null);
  const [panelDone, setPanelDone] = useState({});
  const [panelPlanned, setPanelPlanned] = useState({});
  const [panelNote, setPanelNote] = useState("");
  const [panelCatNotes, setPanelCatNotes] = useState({});
  const [panelCatNotesOpen, setPanelCatNotesOpen] = useState(null);
  const [filters, setFilters] = useState(new Set(CATS));
  const [weekPanel, setWeekPanel] = useState(null);
  const [weekPanelText, setWeekPanelText] = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const [periodMode, setPeriodMode] = useState("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [showBilan, setShowBilan] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const { data: row } = await supabase
          .from("calendrier_data")
          .select("days, weeks")
          .eq("user_id", "kyrian")
          .single();
        if (row) {
          setData(row.days || {});
          setWeekData(row.weeks || {});
        }
      } catch (e) {}
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    async function save() {
      await supabase
        .from("calendrier_data")
        .update({ days: data, weeks: weekData })
        .eq("user_id", "kyrian");
    }
    save();
  }, [data, weekData, loaded]);

  function openPanel(k) {
    const d = data[k] || {};
    const doneSet = new Set(d.done || []);
    const plannedSet = new Set(d.planned || []);
    const done = {}, planned = {};
    CATS.forEach(c => { done[c] = doneSet.has(c); planned[c] = plannedSet.has(c); });
    setPanelDone(done);
    setPanelPlanned(planned);
    setPanelNote(d.note || "");
    setPanelCatNotes(d.catNotes || {});
    setPanelCatNotesOpen(null);
    setPanel(k);
  }

  function savePanel() {
    const done = CATS.filter(c => panelDone[c]);
    const planned = isFuture(panel) ? CATS.filter(c => panelPlanned[c]) : [];
    const note = panelNote.trim();
    const catNotes = {};
    done.forEach(c => { if (panelCatNotes[c]?.trim()) catNotes[c] = panelCatNotes[c].trim(); });
    setData(prev => {
      const next = { ...prev };
      if (!done.length && !planned.length && !note && !Object.keys(catNotes).length)
        delete next[panel];
      else next[panel] = { done, planned, note, catNotes };
      return next;
    });
    setPanel(null);
  }

  function navigate(dir) {
    if (view === "heatmap") { setViewYear(y => y + dir); return; }
    if (periodMode === "week") {
      const anchor = new Date(viewYear, viewMonth, 1);
      anchor.setDate(anchor.getDate() + dir * 7);
      setViewYear(anchor.getFullYear());
      setViewMonth(anchor.getMonth());
      return;
    }
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  }

  function searchDate(e) {
    if (e.key !== "Enter") return;
    const val = searchQuery.trim();
    const parts = val.split("/");
    if (parts.length !== 3) return;
    const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return;
    setViewYear(y); setViewMonth(m);
    setView("calendar");
    setPeriodMode("month");
    setSearchQuery("");
    setTimeout(() => openPanel(dateKey(y, m, d)), 80);
  }

  function toggleFilter(cat) {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function openWeekPanel(wk) {
    setWeekPanelText(weekData[wk]?.bilan || "");
    setWeekPanel(wk);
  }

  function saveWeekPanel() {
    const text = weekPanelText.trim();
    setWeekData(prev => {
      const next = { ...prev };
      if (!text) delete next[weekPanel];
      else next[weekPanel] = { bilan: text };
      return next;
    });
    setWeekPanel(null);
  }

  function toggleWeekExpand(wk) {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(wk)) next.delete(wk); else next.add(wk);
      return next;
    });
  }

  if (!loaded) return (
    <div style={{ background: "#0a0a0b", color: "#555", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 13 }}>
      Chargement…
    </div>
  );

  const sidebarInner = (closeFn) => (
    <>
      <div style={{ padding: "22px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Objectifs</div>
        <div style={{ fontSize: 9, color: "#444", marginTop: 2, letterSpacing: "0.06em" }}>Suivi personnel</div>
      </div>
      <nav style={{ padding: "10px 0" }}>
        {[
          { id: "calendar", label: "Calendrier", icon: "▦" },
          { id: "heatmap", label: "Vue annuelle", icon: "◫" },
          { id: "stats", label: "Statistiques", icon: "∿" },
          { id: "history", label: "Historique", icon: "◷" },
          { id: "bilans", label: "Bilan Semaine", icon: "◈" },
        ].map(({ id, label, icon }) => (
          <div key={id} onClick={() => { setView(id); if (closeFn) closeFn(); }} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 18px", fontSize: 11, cursor: "pointer",
            color: view === id ? "#f0f0f0" : "#666",
            background: view === id ? "#18181c" : "transparent",
            borderLeft: `2px solid ${view === id ? "#fff" : "transparent"}`,
            letterSpacing: "0.03em", transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 13 }}>{icon}</span>{label}
          </div>
        ))}
      </nav>
      <div style={{ padding: "16px 18px 6px" }}>
        <div style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "#333", marginBottom: 8 }}>Catégories</div>
      </div>
      {CATS.map(cat => (
        <div key={cat} onClick={() => toggleFilter(cat)} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 18px", fontSize: 11, cursor: "pointer",
          color: filters.has(cat) ? "#ccc" : "#3a3a3a",
          transition: "color 0.15s",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[cat], opacity: filters.has(cat) ? 1 : 0.2, flexShrink: 0, transition: "opacity 0.15s" }}></span>
          {LABELS[cat]}
        </div>
      ))}
      <div style={{ marginTop: "auto", padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => {
          const blob = new Blob([JSON.stringify({ days: data, weeks: weekData }, null, 2)], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `objectifs_${todayKey()}.json`; a.click();
        }} style={btnSmall}>↓ Exporter JSON</button>
        <label style={{ ...btnSmall, cursor: "pointer" }}>
          ↑ Importer JSON
          <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
              try {
                const imp = JSON.parse(ev.target.result);
                if (imp.days) { setData(prev => ({ ...prev, ...imp.days })); setWeekData(prev => ({ ...prev, ...(imp.weeks || {}) })); }
                else setData(prev => ({ ...prev, ...imp }));
              } catch {}
            };
            reader.readAsText(file);
          }} />
        </label>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0b", color: "#f0f0f0", fontFamily: "'DM Mono', 'Courier New', monospace", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        textarea, input { font-family: 'DM Mono', monospace; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade { animation: fadeUp 0.2s ease; }
        .week-bilan-text { white-space: pre-wrap; font-size: 11px; color: #888; line-height: 1.7; }
      `}</style>

      {/* ── Sidebar PC ── */}
      {!isMobile && (
        <aside style={{ width: 200, minWidth: 200, background: "#111114", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", padding: 0, overflowY: "auto" }}>
          {sidebarInner(null)}
        </aside>
      )}

      {/* ── Sidebar Mobile Overlay ── */}
      {isMobile && sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} />
          <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#111114", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", zIndex: 201, overflowY: "auto" }}>
            {sidebarInner(() => setSidebarOpen(false))}
          </aside>
        </>
      )}

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Topbar ── */}
        <div style={{
          padding: isMobile ? "10px 12px" : "16px 28px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", background: "#0a0a0b",
          flexShrink: 0, gap: isMobile ? 6 : 12,
        }}>

          {/* Burger mobile */}
          {isMobile && (
            <button onClick={() => setSidebarOpen(o => !o)} style={{
              background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
              color: "#888", cursor: "pointer", fontSize: 16, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>☰</button>
          )}

          {/* Left: nav + title + Aujourd'hui */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 5 : 10, flex: 1, minWidth: 0 }}>
            {(view === "calendar" || view === "heatmap") && <>
              <button onClick={() => navigate(-1)} style={btnNav}>‹</button>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 13 : 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {view === "heatmap"
                  ? viewYear
                  : periodMode === "month"
                    ? `${MONTH_FR[viewMonth]} ${viewYear}`
                    : `Sem. ${mondayOfWeek(weekKey(new Date(viewYear, viewMonth, 1))).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
              </span>
              <button onClick={() => navigate(1)} style={btnNav}>›</button>
            </>}
            {view === "stats" && <span style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 13 : 17, fontWeight: 700 }}>Statistiques</span>}
            {view === "history" && <span style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 13 : 17, fontWeight: 700 }}>Historique</span>}
            {view === "bilans" && <span style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 13 : 17, fontWeight: 700 }}>Bilan Semaine</span>}
            {view === "calendar" && (
              <button onClick={() => { const n = new Date(); setViewYear(n.getFullYear()); setViewMonth(n.getMonth()); setPeriodMode("month"); }} style={btnToday}>
                {isMobile ? "Auj." : "Aujourd'hui"}
              </button>
            )}
          </div>

          {/* Right: search + period toggle + bilan */}
          {view === "calendar" && (
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8, flexShrink: 0 }}>
              {!isMobile && (
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#333", pointerEvents: "none" }}>⌕</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={searchDate}
                    placeholder="JJ/MM/AAAA"
                    style={{
                      background: "#18181c", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6,
                      padding: "5px 10px 5px 24px", fontSize: 10, color: "#888", outline: "none",
                      width: 120, letterSpacing: "0.03em", transition: "border-color 0.15s",
                    }}
                    onFocus={e => e.target.style.borderColor = "rgba(255,255,255,0.18)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.07)"}
                  />
                </div>
              )}
              <div style={{ display: "flex", background: "#18181c", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, overflow: "hidden" }}>
                {["month", "week"].map(p => (
                  <button key={p} onClick={() => setPeriodMode(p)} style={{
                    padding: isMobile ? "5px 7px" : "5px 12px", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
                    background: periodMode === p ? "#2a2a2e" : "transparent",
                    color: periodMode === p ? "#ccc" : "#444",
                    border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  }}>{p === "month" ? "Mois" : "Sem."}</button>
                ))}
              </div>
              <button onClick={() => setShowBilan(b => !b)} style={{
                display: "flex", alignItems: "center", gap: isMobile ? 3 : 6,
                padding: isMobile ? "5px 7px" : "5px 12px", fontSize: isMobile ? 9 : 10, letterSpacing: "0.06em",
                fontFamily: "inherit", cursor: "pointer", borderRadius: 6, flexShrink: 0,
                border: showBilan ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.07)",
                background: showBilan ? "#fff" : "#18181c",
                color: showBilan ? "#000" : "#444",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 11 }}>{showBilan ? "●" : "○"}</span>{!isMobile && " Bilan"}
              </button>
            </div>
          )}
        </div>

        <div className="fade" key={view + periodMode + viewMonth + viewYear} style={{ flex: 1, overflowY: "auto", padding: isMobile ? "10px 8px 40px" : "22px 28px 40px" }}>
          {view === "calendar" && <CalendarView data={data} weekData={weekData} viewYear={viewYear} viewMonth={viewMonth} periodMode={periodMode} filters={filters} openPanel={openPanel} openWeekPanel={openWeekPanel} toggleWeekExpand={toggleWeekExpand} expandedWeeks={expandedWeeks} showBilan={showBilan} isMobile={isMobile} />}
          {view === "heatmap" && <HeatmapView data={data} viewYear={viewYear} filters={filters} openPanel={openPanel} />}
          {view === "stats" && <StatsView data={data} filters={filters} />}
          {view === "history" && <HistoryView data={data} filters={filters} openPanel={openPanel} />}
          {view === "bilans" && <BilanView weekData={weekData} openWeekPanel={openWeekPanel} />}
        </div>
      </div>

      {/* ── Day Panel ── */}
      {panel && (
        <div onClick={e => { if (e.target === e.currentTarget) setPanel(null); }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, width: 420, maxWidth: "94vw", padding: 28, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
            <button onClick={() => setPanel(null)} style={{ position: "absolute", top: 14, right: 14, background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "50%", width: 26, height: 26, color: "#888", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 20, textTransform: "capitalize" }}>
              {parseKey(panel).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={sectionTitle}>Réalisé ce jour</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATS.map(cat => (
                  <div key={cat} onClick={() => setPanelDone(p => ({ ...p, [cat]: !p[cat] }))} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 100, fontSize: 10,
                    letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
                    border: panelDone[cat] ? `1px solid ${COLORS[cat]}88` : "1px solid rgba(255,255,255,0.08)",
                    background: panelDone[cat] ? `${COLORS[cat]}22` : "#18181c",
                    color: panelDone[cat] ? COLORS[cat] : "#555",
                    transition: "all 0.15s",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[cat] }}></span>
                    {LABELS[cat]}
                  </div>
                ))}
              </div>
            </div>
            {CATS.some(c => panelDone[c]) && (
              <div style={{ marginBottom: 20 }}>
                <div style={sectionTitle}>Notes par objectif</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {CATS.filter(c => panelDone[c]).map(cat => (
                    <div key={cat}>
                      <div onClick={() => setPanelCatNotesOpen(prev => prev === cat ? null : cat)} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "7px 10px", borderRadius: 7, cursor: "pointer",
                        background: panelCatNotesOpen === cat ? "#18181c" : "transparent",
                        border: `1px solid ${panelCatNotesOpen === cat ? "rgba(255,255,255,0.08)" : "transparent"}`,
                        transition: "all 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, color: panelCatNotes[cat]?.trim() ? "#ccc" : "#555", letterSpacing: "0.04em" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[cat] }}></span>
                          {LABELS[cat]}
                          {panelCatNotes[cat]?.trim() && <span style={{ fontSize: 8, color: COLORS[cat], opacity: 0.7 }}>● note</span>}
                        </div>
                        <span style={{ fontSize: 9, color: "#444" }}>{panelCatNotesOpen === cat ? "▲" : "▼"}</span>
                      </div>
                      {panelCatNotesOpen === cat && (
                        <textarea autoFocus value={panelCatNotes[cat] || ""} onChange={e => setPanelCatNotes(p => ({ ...p, [cat]: e.target.value }))} placeholder={`Note pour ${LABELS[cat]}…`} style={{
                          width: "100%", background: "#0a0a0b", border: "1px solid rgba(255,255,255,0.06)",
                          borderTop: "none", borderRadius: "0 0 7px 7px", color: "#f0f0f0",
                          fontSize: 11, padding: "10px 12px", resize: "vertical", minHeight: 64, outline: "none", lineHeight: 1.6,
                        }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isFuture(panel) && (
              <div style={{ marginBottom: 20 }}>
                <div style={sectionTitle}>Planifier (futur)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATS.map(cat => (
                    <div key={cat} onClick={() => setPanelPlanned(p => ({ ...p, [cat]: !p[cat] }))} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 100, fontSize: 10,
                      letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
                      border: panelPlanned[cat] ? `1px solid ${COLORS[cat]}55` : "1px solid rgba(255,255,255,0.06)",
                      background: panelPlanned[cat] ? `${COLORS[cat]}14` : "#18181c",
                      color: panelPlanned[cat] ? `${COLORS[cat]}aa` : "#444",
                      transition: "all 0.15s",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[cat], opacity: 0.5 }}></span>
                      {LABELS[cat]}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div style={sectionTitle}>Note globale 🔒</div>
              <textarea value={panelNote} onChange={e => setPanelNote(e.target.value)} placeholder="Note de la journée…" style={{
                width: "100%", background: "#18181c", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, color: "#f0f0f0", fontSize: 12, padding: "10px 12px",
                resize: "vertical", minHeight: 72, outline: "none", lineHeight: 1.6,
              }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={savePanel} style={{ flex: 1, padding: "10px", background: "#fff", color: "#000", border: "none", borderRadius: 8, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                Enregistrer
              </button>
              <button onClick={() => setPanel(null)} style={{ padding: "10px 16px", background: "#18181c", color: "#888", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Week Bilan Panel ── */}
      {weekPanel && (
        <div onClick={e => { if (e.target === e.currentTarget) setWeekPanel(null); }} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, width: 480, maxWidth: "94vw", padding: 28, position: "relative" }}>
            <button onClick={() => setWeekPanel(null)} style={{ position: "absolute", top: 14, right: 14, background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "50%", width: 26, height: 26, color: "#888", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Bilan Semaine</div>
            <div style={{ fontSize: 10, color: "#444", marginBottom: 20, letterSpacing: "0.03em" }}>{weekLabel(weekPanel)}</div>
            <textarea autoFocus value={weekPanelText} onChange={e => setWeekPanelText(e.target.value)}
              placeholder={"Points forts, points faibles, difficultés rencontrées,\nobjectifs de la semaine suivante, réflexions personnelles…"}
              style={{ width: "100%", background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#f0f0f0", fontSize: 12, padding: "14px", resize: "vertical", minHeight: 200, outline: "none", lineHeight: 1.8 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={saveWeekPanel} style={{ flex: 1, padding: "10px", background: "#fff", color: "#000", border: "none", borderRadius: 8, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                Enregistrer
              </button>
              <button onClick={() => setWeekPanel(null)} style={{ padding: "10px 16px", background: "#18181c", color: "#888", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ data, weekData, viewYear, viewMonth, periodMode, filters, openPanel, openWeekPanel, toggleWeekExpand, expandedWeeks, showBilan, isMobile }) {
  if (periodMode === "week") {
    const anchor = new Date(viewYear, viewMonth, 1);
    const dow = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1;
    const monday = new Date(anchor); monday.setDate(anchor.getDate() - dow);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      return { date: d, key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()) };
    });
    const wk = weekKey(monday);
    const hasBilan = !!weekData[wk]?.bilan;
    const isExpanded = expandedWeeks.has(wk);
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 2 : 4, marginBottom: 6 }}>
          {DAY_FR.map(d => <div key={d} style={{ fontSize: 9, textAlign: "center", color: "#333", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 2 : 4 }}>
          {days.map(({ date, key: k }) => {
            const dayData = data[k] || {};
            const future = isFuture(k);
            const tod = isToday(k);
            const shown = future ? (dayData.planned || []).filter(c => filters.has(c)) : (dayData.done || []).filter(c => filters.has(c));
            const hasCatNotes = dayData.catNotes && Object.keys(dayData.catNotes).length > 0;
            return (
              <div key={k} onClick={() => openPanel(k)} style={{
                background: tod ? "#18181c" : "#111114",
                border: `1px solid ${tod ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8, minHeight: isMobile ? 80 : 140, padding: isMobile ? "6px 4px" : "10px 10px 8px",
                cursor: "pointer", transition: "border-color 0.15s", position: "relative",
              }}>
                {(dayData.note || hasCatNotes) && <span style={{ position: "absolute", top: 5, right: 5, width: 4, height: 4, borderRadius: "50%", background: "#444" }}></span>}
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: isMobile ? 11 : 10, color: tod ? "#fff" : "#555", fontWeight: tod ? 600 : 400 }}>{date.getDate()}</span>
                  {!isMobile && <span style={{ fontSize: 8, color: "#2a2a2a", marginLeft: 4 }}>{date.toLocaleDateString("fr-FR", { month: "short" })}</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  {shown.map(c => <span key={c} style={{ display: "block", height: isMobile ? 3 : 5, width: isMobile ? 12 : 22, borderRadius: 2, background: COLORS[c], opacity: future ? 0.35 : 0.85 }}></span>)}
                </div>
                {!isMobile && shown.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    {shown.map(c => <span key={c} style={{ fontSize: 8, color: COLORS[c], opacity: future ? 0.5 : 0.75, letterSpacing: "0.04em" }}>{LABELS[c]}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {showBilan && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <div onClick={() => toggleWeekExpand(wk)} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 7,
              padding: "5px 10px", borderRadius: 6, cursor: "pointer",
              background: hasBilan ? "rgba(255,255,255,0.03)" : "transparent",
              border: `1px solid ${hasBilan ? "rgba(255,255,255,0.07)" : "transparent"}`,
            }}>
              <span style={{ fontSize: 8, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase" }}>Bilan</span>
              {hasBilan && <span style={{ fontSize: 8, color: "#555" }}>{isExpanded ? "▲" : "▼"}</span>}
              {!hasBilan && <span style={{ fontSize: 8, color: "#2a2a2a" }}>—</span>}
            </div>
            <div onClick={() => openWeekPanel(wk)} style={{ padding: "4px 10px", fontSize: 8, color: "#333", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 5, border: "1px solid rgba(255,255,255,0.05)" }}>
              {hasBilan ? "Modifier" : "+ Écrire"}
            </div>
          </div>
        )}
        {showBilan && isExpanded && hasBilan && (
          <div style={{ margin: "3px 0 6px", padding: "10px 12px", background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7 }}>
            <p className="week-bilan-text">{weekData[wk].bilan}</p>
          </div>
        )}
      </div>
    );
  }

  const first = new Date(viewYear, viewMonth, 1);
  let startDow = first.getDay() - 1; if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) {
    const d = prevDays - startDow + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ key: dateKey(y, m, d), day: d, dim: true, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(viewYear, viewMonth, d), day: d, dim: false, other: false });
  }
  const remain = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= remain; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ key: dateKey(y, m, d), day: d, dim: true, other: true });
  }
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 2 : 4, marginBottom: 6 }}>
        {DAY_FR.map(d => <div key={d} style={{ fontSize: 9, textAlign: "center", color: "#333", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 2 : 4 }}>
        {rows.map((row, ri) => {
          const midCell = row.find(c => !c.other) || row[3];
          const wk = weekKeyFromYM(...midCell.key.split("-").map((v, i) => i === 1 ? Number(v) - 1 : Number(v)));
          const hasBilan = !!weekData[wk]?.bilan;
          const isExpanded = expandedWeeks.has(wk);
          return (
            <div key={ri} style={{ marginBottom: showBilan ? (isMobile ? 2 : 4) : 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 2 : 4 }}>
                {row.map(({ key: k, day, dim, other }) => {
                  const dayData = data[k] || {};
                  const future = isFuture(k);
                  const tod = isToday(k);
                  const shown = future
                    ? (dayData.planned || []).filter(c => filters.has(c))
                    : (dayData.done || []).filter(c => filters.has(c));
                  const hasCatNotes = dayData.catNotes && Object.keys(dayData.catNotes).length > 0;
                  return (
                    <div key={k} onClick={() => !other && openPanel(k)} style={{
                      background: tod ? "#18181c" : "#111114",
                      border: `1px solid ${tod ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: isMobile ? 5 : 8,
                      minHeight: isMobile ? 42 : 76,
                      padding: isMobile ? "4px 3px" : "7px 7px 6px",
                      cursor: other ? "default" : "pointer", opacity: dim ? 0.3 : 1,
                      transition: "border-color 0.15s", position: "relative",
                    }}
                    onMouseEnter={e => { if (!other) e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
                    onMouseLeave={e => { if (!other) e.currentTarget.style.borderColor = tod ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"; }}
                    >
                      {(dayData.note || hasCatNotes) && <span style={{ position: "absolute", top: 4, right: 4, width: 3, height: 3, borderRadius: "50%", background: "#444" }}></span>}
                      <span style={{ fontSize: isMobile ? 11 : 10, color: tod ? "#fff" : "#555", display: "block", marginBottom: isMobile ? 2 : 5, fontWeight: tod ? 600 : 400 }}>{day}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                        {shown.map(c => (
                          <span key={c} style={{ display: "block", height: isMobile ? 3 : 4, width: isMobile ? 8 : 18, borderRadius: 2, background: COLORS[c], opacity: future ? 0.35 : 0.85 }}></span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {showBilan && (
                <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <div onClick={() => toggleWeekExpand(wk)} style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                    background: hasBilan ? "rgba(255,255,255,0.03)" : "transparent",
                    border: `1px solid ${hasBilan ? "rgba(255,255,255,0.07)" : "transparent"}`,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 8, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase" }}>Bilan</span>
                    {hasBilan && <span style={{ fontSize: 8, color: "#555" }}>{isExpanded ? "▲" : "▼"}</span>}
                    {!hasBilan && <span style={{ fontSize: 8, color: "#2a2a2a" }}>—</span>}
                  </div>
                  <div onClick={() => openWeekPanel(wk)} style={{ padding: "4px 10px", fontSize: 8, color: "#333", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 5, border: "1px solid rgba(255,255,255,0.05)", background: "transparent", transition: "all 0.15s" }}>
                    {hasBilan ? "Modifier" : "+ Écrire"}
                  </div>
                </div>
              )}
              {showBilan && isExpanded && hasBilan && (
                <div style={{ margin: "3px 0 2px", padding: "10px 12px", background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7 }}>
                  <p className="week-bilan-text">{weekData[wk].bilan}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapView({ data, viewYear, filters, openPanel }) {
  const jan1 = new Date(viewYear, 0, 1);
  const startDow = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1;
  const startDate = new Date(jan1); startDate.setDate(1 - startDow);
  const weeks = [];
  let d = new Date(startDate);
  for (let w = 0; w < 53; w++) {
    const week = [];
    for (let day = 0; day < 7; day++) {
      const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const inYear = d.getFullYear() === viewYear;
      const done = ((data[k] || {}).done || []).filter(c => filters.has(c));
      week.push({ k, inYear, count: done.length, topCat: done[done.length - 1], date: new Date(d) });
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  }
  return (
    <div>
      <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 3 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {week.map(({ k, inYear, count, topCat, date }) => (
                <div key={k} onClick={() => inYear && !isFuture(k) && openPanel(k)}
                  title={`${date.toLocaleDateString("fr-FR")} — ${count} activité${count > 1 ? "s" : ""}`}
                  style={{
                    width: 13, height: 13, borderRadius: 2, cursor: inYear && !isFuture(k) ? "pointer" : "default",
                    background: (!inYear || isFuture(k) || count === 0) ? "#18181c" : COLORS[topCat],
                    opacity: (!inYear || isFuture(k)) ? 0.3 : count === 0 ? 1 : Math.min(0.35 + count * 0.22, 1),
                    transition: "opacity 0.1s",
                  }}
                  onMouseEnter={e => { if (inYear) e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={e => { if (inYear) e.currentTarget.style.opacity = (!inYear || isFuture(k) || count === 0) ? "1" : String(Math.min(0.35 + count * 0.22, 1)); }}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
          {CATS.filter(c => filters.has(c)).map(c => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#444" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[c], display: "inline-block" }}></span>
              {LABELS[c]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsView({ data, filters }) {
  const pastKeys = Object.keys(data).filter(k => !isFuture(k)).sort();
  const totals = {}, streakCur = {}, streakBest = {};
  CATS.forEach(c => { totals[c] = 0; streakCur[c] = 0; streakBest[c] = 0; });
  pastKeys.forEach(k => { (data[k].done || []).forEach(c => { if (CATS.includes(c)) totals[c]++; }); });
  CATS.forEach(cat => {
    let cur = 0, best = 0, prev = null;
    pastKeys.forEach(k => {
      const done = data[k].done || [];
      if (done.includes(cat)) {
        if (prev) { const diff = (parseKey(k) - parseKey(prev)) / 86400000; cur = diff === 1 ? cur + 1 : 1; } else cur = 1;
        if (cur > best) best = cur;
      } else cur = 0;
      prev = k;
    });
    streakCur[cat] = cur; streakBest[cat] = best;
  });
  const now = new Date(); const months = []; let maxVal = 1;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const cats = {}; CATS.forEach(c => cats[c] = 0);
    Object.keys(data).forEach(k => {
      const kd = parseKey(k);
      if (kd.getFullYear() === y && kd.getMonth() === m)
        (data[k].done || []).forEach(c => { if (CATS.includes(c)) cats[c]++; });
    });
    const total = CATS.reduce((s, c) => s + cats[c], 0);
    if (total > maxVal) maxVal = total;
    months.push({ label: d.toLocaleDateString("fr-FR", { month: "short" }), cats, total });
  }
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
        {CATS.filter(c => filters.has(c)).map(cat => (
          <div key={cat} style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[cat] }}></span>
              {LABELS[cat]}
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 700, color: COLORS[cat], lineHeight: 1 }}>{totals[cat]}</div>
            <div style={{ fontSize: 9, color: "#333", marginTop: 6, marginBottom: 12 }}>jours réalisés</div>
            <div style={{ display: "flex", gap: 16 }}>
              {[["Série actuelle", streakCur[cat]], ["Meilleure série", streakBest[cat]]].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700 }}>{val}</div>
                  <div style={{ fontSize: 8, color: "#333", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 8, fontSize: 9, color: "#333", letterSpacing: "0.1em", textTransform: "uppercase" }}>Activité par mois</div>
      <div style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
          {months.map((mo, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 1, borderRadius: "3px 3px 0 0", overflow: "hidden", height: `${(mo.total / maxVal) * 90}px` }}>
                {CATS.filter(c => filters.has(c) && mo.cats[c] > 0).map(c => (
                  <div key={c} style={{ width: "100%", flex: mo.cats[c], background: COLORS[c] }}></div>
                ))}
              </div>
              <span style={{ fontSize: 7, color: "#333" }}>{mo.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryView({ data, filters, openPanel }) {
  const past = Object.keys(data).filter(k => !isFuture(k) && ((data[k].done || []).length > 0 || data[k].note)).sort().reverse();
  const future = Object.keys(data).filter(k => isFuture(k) && (data[k].planned || []).length > 0).sort();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {future.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Activités planifiées</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {future.map(k => <HistoryItem key={k} k={k} data={data} filters={filters} openPanel={openPanel} type="future" />)}
          </div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Historique</div>
        {!past.length && <div style={{ color: "#333", fontSize: 12, padding: "20px 0" }}>Aucune activité enregistrée.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {past.map(k => <HistoryItem key={k} k={k} data={data} filters={filters} openPanel={openPanel} type="past" />)}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ k, data, filters, openPanel, type }) {
  const dayData = data[k] || {};
  const cats = (type === "future" ? (dayData.planned || []) : (dayData.done || [])).filter(c => filters.has(c));
  const d = parseKey(k);
  const hasCatNotes = dayData.catNotes && Object.keys(dayData.catNotes).length > 0;
  return (
    <div onClick={() => openPanel(k)} style={{
      background: "#111114", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
      padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
      cursor: "pointer", transition: "border-color 0.15s",
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
    >
      <div>
        <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>
          {d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        {(dayData.note || hasCatNotes) && <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>🔒 Notes privées</div>}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {cats.map(c => (
          <span key={c} style={{ fontSize: 8, padding: "3px 8px", borderRadius: 100, background: `${COLORS[c]}18`, color: COLORS[c], border: `1px solid ${COLORS[c]}33`, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {LABELS[c]}
          </span>
        ))}
      </div>
    </div>
  );
}

function BilanView({ weekData, openWeekPanel }) {
  const now = new Date();
  const seen = new Set(); const uniqueWeeks = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i * 7);
    const wk = weekKey(d); if (!seen.has(wk)) { seen.add(wk); uniqueWeeks.push(wk); }
  }
  Object.keys(weekData).sort().reverse().forEach(w => { if (!seen.has(w)) { seen.add(w); uniqueWeeks.unshift(w); } });
  const currentWk = weekKey(now);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
      {uniqueWeeks.map(wk => <BilanCard key={wk} wk={wk} bilan={weekData[wk]?.bilan} isCurrent={wk === currentWk} openWeekPanel={openWeekPanel} />)}
    </div>
  );
}

function BilanCard({ wk, bilan, isCurrent, openWeekPanel }) {
  const [open, setOpen] = useState(isCurrent);
  return (
    <div style={{ background: "#111114", border: `1px solid ${isCurrent ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isCurrent && <span style={{ fontSize: 7, padding: "2px 7px", borderRadius: 100, background: "rgba(255,255,255,0.07)", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>En cours</span>}
          <span style={{ fontSize: 11, color: "#888" }}>{weekLabel(wk)}</span>
          {!bilan && <span style={{ fontSize: 9, color: "#2a2a2a" }}>— vide</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span onClick={e => { e.stopPropagation(); openWeekPanel(wk); }}
            style={{ fontSize: 8, color: "#333", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#333"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          >{bilan ? "Modifier" : "+ Écrire"}</span>
          {bilan && <span style={{ fontSize: 9, color: "#333" }}>{open ? "▲" : "▼"}</span>}
        </div>
      </div>
      {open && bilan && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 12 }}></div>
          <p className="week-bilan-text">{bilan}</p>
        </div>
      )}
    </div>
  );
}

const btnSmall = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "7px 10px", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase",
  background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
  color: "#555", cursor: "pointer", fontFamily: "inherit",
};
const btnNav = {
  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
  background: "#111114", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
  color: "#666", cursor: "pointer", fontSize: 16, fontFamily: "inherit",
};
const btnToday = {
  padding: "5px 12px", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
  background: "#111114", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  color: "#666", cursor: "pointer", fontFamily: "inherit",
};
const sectionTitle = {
  fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "#444", marginBottom: 10,
};