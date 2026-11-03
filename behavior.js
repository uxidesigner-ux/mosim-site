/* 모심 프로토타입 동작 — 모든 화면이 같이 쓴다.
   - 칩·세그먼트·스위치·체크·별점 고르기, 입력 칸 수정 (화면마다 이름으로 기억)
   - 목록 검색·걸러 보기
   - 하단 버튼을 누를 때 입력 검사 (오류는 같은 칸에 경고 아이콘 + 문구, 칸의 설명으로 이어 읽힘)
   - 화면 사이 이어지는 값 (어머니 동의 → 동의 완료, 도우미 연장 요청 → 보호자 승인 화면,
     도우미 귀가 기록의 전달사항 → 보호자 동행 기록, 도우미 단계 기록 → 보호자 진행 화면 …)
   상태는 이 브라우저의 localStorage에만 남고 12시간 뒤 지워진다. 다른 탭에서 바뀌면 그 값을 쓰는 화면을 다시 그린다.
   앱 첫 화면의 '데모 처음으로'나 주소 끝 ?reset=1 로 지운다. */
(function () {
  "use strict";
  var PAGE = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  var BASE = PAGE.replace(/--(error|done)$/, "");
  var K = "mosim:", TTL = 12 * 36e5;
  var CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PHONE = matchMedia("(pointer: coarse)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* 저장: 값마다 저장 시각을 붙여 두고, 12시간 지난 값과 예전 형식 값은 버린다 */
  function fresh(raw) { try { var o = JSON.parse(raw); return o && typeof o === "object" && "v" in o && Date.now() - o.at < TTL ? o : null; } catch (e) { return null; } }
  function raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function keys() { var a = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(K) === 0) a.push(k); } } catch (e) {} return a; }
  var used = {};   // 이 화면이 읽은 값 — 다른 탭에서 바뀌면 다시 그린다
  function load(k, d) { used[k] = true; var o = fresh(raw(K + k)); return o ? o.v : d; }
  function save(k, v) { try { localStorage.setItem(K + k, JSON.stringify({ v: v, at: Date.now() })); } catch (e) {} }
  var RESET = /[?&]reset=1/.test(location.search);
  keys().forEach(function (k) { if (RESET || !fresh(raw(k))) try { localStorage.removeItem(k); } catch (e) {} });
  if (RESET) history.replaceState(null, "", location.pathname + location.hash);

  /* 알림 한 줄 — 글자 수에 맞춰 3~7초 동안 보인다 */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, Math.min(7000, Math.max(3000, 1500 + msg.length * 60)));
  }
  function reveal(el) { el.scrollIntoView({ block: "center", behavior: CALM ? "auto" : "smooth" }); }

  /* 입력 칸 찾기·값·오류 */
  function txt(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  function field(label) { return $$(".field").filter(function (f) { var l = $(".label", f); return l && txt(l).indexOf(label) === 0; })[0]; }
  function input(f) { return f && $("input.input, textarea.input", f); }
  function val(label) { var i = input(field(label)); return i ? i.value.trim() : ""; }
  // 오류 문구를 입력 칸의 설명으로 잇는다 — 포커스가 칸에 가면 화면낭독기가 이름·오류·문구를 같이 읽는다
  var errN = 0;
  function linkMsg(i, m) {
    if (!m.id) m.id = (i.id || "f" + (++errN)) + "-err";
    i.setAttribute("aria-invalid", "true"); i.setAttribute("aria-describedby", m.id);
  }
  function setError(f, msg) {
    if (!f) return;
    f.classList.add("is-error");
    var i = input(f), m = $(".field-msg", f);
    if (!m) { m = document.createElement("p"); m.className = "field-msg"; f.appendChild(m); }
    m.innerHTML = WARN; m.appendChild(document.createTextNode(msg));
    if (i) { linkMsg(i, m); i.focus({ preventScroll: true }); }
    else m.setAttribute("role", "alert");          // 옮겨 갈 칸이 없으면 바로 읽어 준다
    reveal(f);
  }
  function clearError(f) {
    if (!f || !f.classList.contains("is-error")) return;
    f.classList.remove("is-error");
    var i = input(f); if (i) { i.removeAttribute("aria-invalid"); i.removeAttribute("aria-describedby"); }
    var m = $(".field-msg", f); if (m) m.remove();
  }
  // 오류 상태로 그려 둔 화면(--error)도 같은 방식으로 잇는다
  $$(".field.is-error").forEach(function (f) { var i = input(f), m = $(".field-msg", f); if (i && m) linkMsg(i, m); });
  document.addEventListener("input", function (e) { var f = e.target.closest && e.target.closest(".field"); if (f) clearError(f); });

  /* 시각 읽기: "오전 9시 30분" · "오후 12시" · "10:00" · "12:00 → 12:30"(마지막 값)
     오전/오후 없이 1~7시로 적으면(“1시”, “1:00”) 병원·동행 시간대라 기준 시각(after)보다 이를 때 오후로 본다 */
  function minutes(s, after) {
    s = (s || "").split("→").pop().trim();
    var t, ampm = /오[전후]/.test(s), m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) t = +m[1] * 60 + +m[2];
    else {
      m = s.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/);
      if (!m) return null;
      var h = +m[2] % 12; if (m[1] === "오후" || (!m[1] && +m[2] === 12)) h += 12;
      t = h * 60 + (+m[3] || 0);
    }
    if (!ampm && after != null && t >= 60 && t < 8 * 60 && t < after) t += 720;
    return t;
  }
  // 시각 고르기 칸(type=time)은 24시간 값이라 그대로, 글자 칸은 오전/오후를 짐작해 읽는다
  function timeOf(label, after) { var i = input(field(label)); return !i ? null : i.type === "time" ? minutes(i.value) : minutes(i.value, after); }
  function hhmm(t) { return ("0" + Math.floor(t / 60)).slice(-2) + ":" + ("0" + (t % 60)).slice(-2); }
  function korTime(s) { var t = minutes(s), h = Math.floor(t / 60), m = t % 60; return (h < 12 ? "오전 " : "오후 ") + (h % 12 || 12) + "시" + (m ? " " + m + "분" : ""); }
  function later(s, min) { return hhmm(minutes(s) + min); }
  function won(n) { return n.toLocaleString("ko-KR") + "원"; }

  /* 시나리오 시계 — 화면의 날짜·시각은 사실 표(11월 5일 동행) 기준이라, 기록 시각도 기기 시계 대신 이 표를 따른다 */
  var SCENE = [["진료 대기", "10:15"], ["진료 시작", "10:38"], ["진료 종료", "11:04"], ["수납", "11:12"], ["약국", "11:31"], ["귀가 출발", "11:52"], ["귀가 완료", "12:24"]];
  var TITLE = ["진료 대기 중 · 노원 바른정형외과의원", "진료 중 · 노원 바른정형외과의원", "진료 마침 · 노원 바른정형외과의원", "수납 중 · 노원 바른정형외과의원", "약국 · 상계 미소약국", "귀가 중 · 댁으로 가는 길", "댁에 도착했어요"];
  function stepIdx(name) { for (var i = SCENE.length - 1; i >= 0; i--) if ((name || "").indexOf(SCENE[i][0]) === 0) return i; return -1; }
  function sceneNow() { var st = load("steps", []), l = st[st.length - 1]; return l ? l.time : SCENE[0][1]; }

  /* ── 1. 고르는 조작: 칩 · 세그먼트 · 스위치 · 체크 · 별점 · 입력 (화면마다 기억)
     순서가 아니라 이름(묶음 이름 + 항목 글자)으로 기억해서, 마크업에 칸이 끼어들어도 엉뚱한 칸에 들어가지 않는다 ── */
  var MEM = "ui2:" + PAGE, mem = load(MEM, {}), memTimer = 0, seen = {};
  function flushMem() { clearTimeout(memTimer); memTimer = 0; save(MEM, mem); }
  function remember(key, v, soon) { mem[key] = v; if (soon) { clearTimeout(memTimer); memTimer = setTimeout(flushMem, 400); } else flushMem(); }
  addEventListener("pagehide", function () { if (memTimer) flushMem(); });
  function uniq(k) { seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? k + "#" + seen[k] : k; }
  function nameOf(el) { var f = el.closest(".field"), b = el.closest(".block"); return txt(f && $(".label", f)) || txt(b && $(".h2", b)); }

  // 하나만 고르는 묶음: Tab은 고른 항목 하나에만 서고, 방향키로 옮기며 고른다
  function radioKeys(items) {
    var sync = function () {
      var on = items.filter(function (o) { return o.getAttribute("aria-checked") === "true"; })[0] || items.filter(function (o) { return !o.disabled; })[0];
      items.forEach(function (o) { o.tabIndex = o === on ? 0 : -1; });
    };
    items.forEach(function (it) {
      it.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return;
        e.preventDefault();
        var live = items.filter(function (o) { return !o.disabled; }), n = live[(live.indexOf(it) + d + live.length) % live.length];
        n.focus(); n.click();
      });
    });
    sync(); return sync;
  }

  // 같은 부모 아래 여러 줄로 나뉜 칩은 한 묶음이다
  var groups = [];
  $$(".chips").forEach(function (c) { if (groups.indexOf(c.parentElement) < 0) groups.push(c.parentElement); });
  groups.forEach(function (group, gi) {
    var rows = $$(":scope > .chips", group), chips = $$(":scope > .chips .chip", group);
    if (!chips.length) return;
    var role = chips[0].getAttribute("role");
    var multi = role ? role === "checkbox" : chips.filter(function (c) { return c.classList.contains("is-selected"); }).length > 1;
    var gname = rows[0].getAttribute("aria-label") || nameOf(group) || "고르기 " + (gi + 1), gkey = "chip:" + uniq(gname) + ":";
    group.dataset.multi = multi ? "1" : "";
    rows.forEach(function (r) { r.setAttribute("role", multi ? "group" : "radiogroup"); if (!r.hasAttribute("aria-label")) r.setAttribute("aria-label", gname); });
    var mark = function () { chips.forEach(function (o) { o.setAttribute("aria-checked", o.classList.contains("is-selected") ? "true" : "false"); }); };
    chips.forEach(function (c) {
      c.type = "button"; c.setAttribute("role", multi ? "checkbox" : "radio"); c.removeAttribute("aria-pressed");
      var saved = mem[gkey + txt(c)];
      if (saved !== undefined) c.classList.toggle("is-selected", saved);
    });
    mark();
    var sync = multi ? function () {} : radioKeys(chips);
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        if (multi) c.classList.toggle("is-selected");
        else chips.forEach(function (o) { o.classList.toggle("is-selected", o === c); });
        mark(); sync();
        chips.forEach(function (o) { mem[gkey + txt(o)] = o.classList.contains("is-selected"); }); flushMem();
        c.dispatchEvent(new CustomEvent("pick", { bubbles: true }));
      });
    });
  });

  $$(".seg").forEach(function (seg) {
    var items = $$(".seg-item", seg), key = "seg:" + uniq(seg.getAttribute("aria-label") || nameOf(seg) || "고르기");
    var pick = function (it) { items.forEach(function (o) { var on = o === it; o.classList.toggle("is-selected", on); o.setAttribute("aria-checked", on ? "true" : "false"); }); };
    var saved = items.filter(function (o) { return txt(o) === mem[key]; })[0];
    if (saved && !saved.disabled) pick(saved);
    var sync = radioKeys(items);
    items.forEach(function (it) {
      it.type = "button";
      it.addEventListener("click", function () { if (it.disabled) return; pick(it); sync(); remember(key, txt(it)); });
    });
  });

  $$(".switch, .check").forEach(function (b) {
    var row = b.closest(".row"), key = "tog:" + uniq(b.getAttribute("aria-label") || txt(row && $(".row-title", row)) || nameOf(b) || "켜기");
    b.type = "button";
    if (mem[key] !== undefined) b.setAttribute("aria-checked", mem[key] ? "true" : "false");
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-checked") !== "true";
      b.setAttribute("aria-checked", on ? "true" : "false"); remember(key, on);
      b.dispatchEvent(new CustomEvent("toggle", { bubbles: true }));
    });
  });

  $$(".rating.is-input").forEach(function (r) {
    var stars = $$("button", r), key = "rate:" + uniq(r.getAttribute("aria-label") || "별점");
    var set = function (n) { stars.forEach(function (s, i) { s.classList.toggle("is-on", i < n); s.setAttribute("aria-checked", i === n - 1 ? "true" : "false"); }); r.dataset.value = n; };
    set(mem[key] !== undefined ? mem[key] : stars.filter(function (s) { return s.classList.contains("is-on"); }).length);
    stars.forEach(function (s, i) { s.type = "button"; s.addEventListener("click", function () { set(i + 1); remember(key, i + 1); }); });
  });

  // 입력은 글자마다 저장하지 않고, 멈춘 뒤 한 번(0.4초) — 화면을 떠날 때는 바로 저장한다
  $$("input.input, textarea.input").forEach(function (i) {
    if (i.readOnly) return;                                    // 자동 계산 칸은 기억하지 않는다
    var key = "in:" + uniq(nameOf(i) || i.id || "칸");
    if (mem[key] !== undefined && mem[key] !== i.value) {
      i.value = mem[key];
      // 오류 상태로 그려 둔 칸이라도, 고쳐 둔 값을 되살렸다면 오류 표시를 거둔다(버튼을 누르면 다시 검사)
      if (i.value === mem[key]) clearError(i.closest(".field"));
    }
    i.addEventListener("input", function () { remember(key, i.value, true); });
  });

  /* ── 2. 목록 검색 · 걸러 보기 (목록이 짧아 글자마다 바로 거른다) ── */
  var search = $('.search input[type="search"]');
  if (search) {
    var block = search.closest(".block") || document;
    var rows = $$(".row", block);
    var chipsBox = $(".chips", block);
    var RULE = { "이번 주": function (t) { var m = t.match(/11\/(\d+)/); return m && +m[1] <= 7; }, "대중교통": /마을버스|대중교통|버스/, "접수까지": /접수/ };
    var empty = document.createElement("div"); empty.className = "empty"; empty.hidden = true; empty.setAttribute("role", "status"); empty.textContent = "맞는 도움요청이 없어요. 걸러 보기를 바꿔 보세요.";
    block.appendChild(empty);
    var apply = function () {
      var q = search.value.trim(), on = chipsBox && $(".chip.is-selected", chipsBox), key = on ? txt(on) : "전체", shown = 0;
      rows.forEach(function (r) {
        var t = r.textContent.replace(/\s+/g, " "), rule = RULE[key];
        var ok = (!q || t.indexOf(q) >= 0) && (!rule || (typeof rule === "function" ? rule(t) : rule.test(t)));
        r.hidden = !ok; if (ok) shown++;
      });
      empty.hidden = shown > 0;
    };
    search.addEventListener("input", apply);
    if (chipsBox) chipsBox.addEventListener("pick", apply);
    apply();
  }

  /* ── 3. 하단 버튼을 누를 때 입력 검사 ── */
  var RULES = {
    "parent-info": function () {
      var f = field("현장 연락");
      if ((val("현장 연락").match(/\d/g) || []).length < 9) return setError(f, "어머니께 연락할 번호가 있어야 도우미가 만날 수 있어요"), false;
      save("parent", { walk: val("보행"), talk: val("의사소통"), help: val("이동 보조"), phone: val("현장 연락") });
      return true;
    },
    "request-new": function () {
      var need = [["날짜", "날짜를 적어 주세요"], ["만남 시각", "만날 시각을 골라 주세요"], ["만남 장소", "만날 곳을 적어 주세요"], ["병원", "병원 이름을 적어 주세요"], ["진료 예약 시각", "진료 예약 시각을 골라 주세요"]];
      for (var i = 0; i < need.length; i++) if (!val(need[i][0])) return setError(field(need[i][0]), need[i][1]), false;
      var meet = timeOf("만남 시각"), appt = timeOf("진료 예약 시각", meet);
      if (meet == null) return setError(field("만남 시각"), "‘오전 9시 30분’처럼 적어 주세요"), false;
      if (appt == null) return setError(field("진료 예약 시각"), "‘오전 10시’처럼 적어 주세요"), false;
      if (appt <= meet) return setError(field("진료 예약 시각"), "진료 예약이 만남 시각보다 빨라요"), false;
      if (!$$(".check").some(function (c) { return c.getAttribute("aria-checked") === "true"; })) return toast("부탁할 도움을 하나 이상 골라 주세요"), false;
      save("request", { date: val("날짜"), meet: hhmm(meet), place: val("만남 장소"), hospital: val("병원"), appt: hhmm(appt) });
      return true;
    },
    "helper-change": function () {
      var t = timeOf("귀가 예상", 720);
      if (t == null) return setError(field("귀가 예상"), "돌아올 시각을 골라 주세요"), false;
      if (t <= 12 * 60) return setError(field("귀가 예상"), "원래 귀가 12:00보다 늦은 시각을 골라 주세요"), false;
      var reason = $(".chip.is-selected"); var ext = Math.ceil((t - 720) / 30) * 30;
      // 요청마다 새 id — 보호자 승인은 이 id에만 붙는다(지난 요청의 승인이 새 요청에 보이지 않게)
      save("extension", { id: Date.now(), reason: reason ? txt(reason) : "", memo: val("메모"), until: hhmm(t), minutes: ext, cost: ext / 30 * 9000, at: later(sceneNow(), 5) });
      return true;
    },
    "dispute": function () {
      if (!val("기억하는 내용")) return setError(field("기억하는 내용"), "어떻게 기억하시는지 한 줄만 적어 주세요"), false;
      var c = $(".chip.is-selected"); save("dispute", { what: c ? txt(c) : "", memo: val("기억하는 내용") });
      return true;
    },
    "review": function () {
      var r = $(".rating.is-input"), text = val("공개 후기");
      if (r && !(+r.dataset.value > 0)) return toast("별점을 하나 이상 골라 주세요"), false;
      if (!text) return setError(field("공개 후기"), "다음 보호자에게 남길 한마디를 적어 주세요"), false;
      // 주소(○동·○호·아파트·번지)와 건강 정보 — "4호선"처럼 지하철 노선은 주소가 아니다
      if (/\d+\s*동|아파트|번지|\d+\s*호(?!선)|주사|진단|병명|처방/.test(text)) return setError(field("공개 후기"), "공개 후기에는 주소·건강 정보를 쓸 수 없어요"), false;
      save("review", { stars: +(r ? r.dataset.value : 5), text: text });
      return true;
    },
    "helper-join": function () {
      if (!val("이름")) return setError(field("이름"), "이름을 적어 주세요"), false;
      if (!val("사는 곳")) return setError(field("사는 곳"), "사는 동네를 적어 주세요"), false;
      var missing = $$('input[type="file"]').filter(function (i) { return !i.files || !i.files.length; })[0];
      if (missing) { toast("자격증 사진을 한 장 올려 주세요"); reveal(missing.closest(".row, .field")); missing.focus({ preventScroll: true }); return false; }
      return true;
    },
    "parent-consent": function () {
      save("consent", $$(".seg").map(function (s) { return $$(".seg-item", s).findIndex(function (x) { return x.classList.contains("is-selected"); }); }));
      return true;
    },
    "booking-cancel": function () { var c = $(".chip.is-selected"); save("cancel", c ? txt(c) : ""); return true; },
    "change-request": function () { var e = load("extension", null); save("approved", { id: e ? e.id : 0, at: later(e ? e.at : "10:20", 6) }); return true; },
    "helper-finish": function () {
      save("share", $$(".row").filter(function (r) { var s = $(".switch", r); return s && s.getAttribute("aria-checked") === "true"; })
        .map(function (r) { return { title: txt($(".row-title", r)), sub: txt($(".row-sub", r)) }; }));
      return true;
    }
  };
  var cta = $$(".cta .btn:not(.is-done)").pop();   // 위험한 확인(취소 등)은 회색 버튼이라 주 버튼만 찾지 않는다
  if (cta && RULES[BASE]) cta.addEventListener("click", function (e) { if (memTimer) flushMem(); if (!RULES[BASE]()) e.preventDefault(); });

  /* ── 4. 화면별 동작 ── */
  // 도우미 연장 요청: 귀가 예상을 고치면 추가 시간·비용이 바로 계산된다
  var ex = load("extension", null);
  if (BASE === "helper-change") {
    var upd = function () {
      var t = timeOf("귀가 예상", 720), fT = input(field("추가 시간")), fC = input(field("추가 비용"));
      if (!fT || !fC) return;
      if (t == null || t <= 720) { fT.value = "—"; fC.value = "—"; return; }
      var ext = Math.ceil((t - 720) / 30) * 30; fT.value = ext + "분"; fC.value = won(ext / 30 * 9000) + " (예시 요율)";
    };
    var g = input(field("귀가 예상"));
    // 보낸 요청 화면은 보낸 그대로 보여 준다
    if (PAGE === "helper-change--done" && ex) {
      var fm = input(field("메모")); if (fm) fm.value = ex.memo;
      if (g) g.value = ex.until;
      $$(".chip").forEach(function (c) { var on = txt(c) === ex.reason; c.classList.toggle("is-selected", on); c.setAttribute("aria-checked", on ? "true" : "false"); });
    }
    if (g) { g.addEventListener("input", upd); upd(); }
  }
  // 보호자 연장 승인: 도우미가 보낸 요청을 그대로 보여 준다
  if (ex && BASE === "change-request") {
    var title = $(".hero .title"), lead = $(".hero .lead");
    if (title) title.textContent = (ex.reason || "진료 대기 길어짐") + " · " + ex.minutes + "분 늘어나요";
    if (lead) lead.textContent = "귀가 예상 12:00 → " + ex.until;
    $$(".row").forEach(function (r) {
      var t = txt($(".row-title", r)), tr = $(".row-trail", r), rt = $(".row-title", r);
      if (rt && /님이 \d+:\d+에 보냈어요/.test(t)) rt.textContent = t.replace(/\d+:\d+/, ex.at);
      if (!tr) return;
      if (t.indexOf("추가 시간") === 0) tr.textContent = ex.minutes + "분";
      if (t.indexOf("추가 비용") === 0) tr.textContent = won(ex.cost);
    });
  }
  // 승인은 지금 연장 요청의 id와 같을 때만 '승인했어요'로 본다
  var ap = load("approved", null), apNow = ex && ap && ap.id === ex.id ? ap.at : null;
  if (PAGE === "change-request--done") { var d = $(".done"); if (d && apNow) d.textContent = apNow + " 승인했어요 — 귀가 예상 " + ex.until; }
  if (PAGE === "helper-change--done") { var d2 = $(".done"); if (d2 && ex) d2.textContent = ex.at + " 보냈어요 — " + (apNow ? apNow + " 김수진 님이 승인했어요" : "보호자 승인을 기다려요"); }

  // 어머니 동의: 고른 값이 동의 완료 화면과 보호자 확인 화면에 그대로
  var consent = load("consent", null);
  if (consent && PAGE === "parent-consent--done") $$(".seg").forEach(function (s, i) { var it = $$(".seg-item", s)[consent[i]]; if (it) it.click(); });
  if (consent && (BASE === "confirm")) $$(".row-sub").forEach(function (p) { if (p.textContent.indexOf("휴대폰 위치") >= 0) p.textContent = p.textContent.replace(/내 휴대폰 위치는? ?보내지 않아요|내 휴대폰 위치도 보내요/, consent[2] === 0 ? "내 휴대폰 위치도 보내요" : "내 휴대폰 위치는 보내지 않아요"); });

  // 취소 사유 · 후기 · 다시 확인 내용이 다음 화면에
  var cancel = load("cancel", null);
  if (cancel && PAGE === "booking-cancel-done") $$(".row-sub").forEach(function (p) { if (p.textContent.indexOf("사유") === 0) p.textContent = "사유 · " + cancel; });
  var rv = load("review", null);
  if (rv && PAGE === "review--done") { var pub = input(field("공개 후기")); if (pub) pub.value = rv.text; var rr = $(".rating"); if (rr) $$("button, svg", rr).forEach(function (s, i) { s.classList.toggle("is-on", i < rv.stars); }); }

  // 도우미 귀가 기록에서 켠 전달사항만 보호자 동행 기록에
  var share = load("share", null);
  if (share && BASE === "report") {
    var head = $$(".block .h2").filter(function (h) { return h.textContent.indexOf("어머니가 전해 주신 것") >= 0; })[0];
    var blk = head && head.closest(".block"), tmpl = blk && $(".row", blk);
    if (blk && tmpl) {
      $$(".row", blk).forEach(function (r) { r.remove(); });
      share.forEach(function (s) { var r = tmpl.cloneNode(true); $(".row-title", r).textContent = s.title; var sb = $(".row-sub", r); if (sb) sb.textContent = s.sub.replace(/^전하지 않아요 · /, ""); blk.appendChild(r); });
      if (!share.length) { var e = document.createElement("p"); e.className = "block-note"; e.textContent = "이번에는 전해 주신 이야기가 없어요."; blk.appendChild(e); }
    }
  }

  // 도우미 동행 기록: 버튼 한 번에 지금 단계를 기록하고 다음 단계로 (시각은 시나리오 시계)
  if (PAGE === "helper-live") {
    var btn = $$(".block .btn.primary")[0], items = $$(".timeline .tl-item"), sec = btn && btn.parentElement;
    var note = sec && $(":scope > .block-note", sec), h2 = sec && $(".h2", sec), when = sec && $(".lead", sec);
    var saved = load("steps", []);
    var nowIdx = function () { return items.findIndex(function (li) { return li.classList.contains("is-now"); }); };
    var label = function () { var n = items[nowIdx() + 1]; btn.textContent = n ? txt($(".tl-body p", n)) + " 기록" : "귀가 기록 쓰기"; };
    var advance = function (time, silent) {
      var i = nowIdx(); if (i < 0) return;
      var cur = items[i], next = items[i + 1], curName = txt($(".tl-body p", cur)), ci = stepIdx(curName);
      // 지난 단계에는 '시작한' 시각을 남긴다(기록한 시각 → 시나리오 시각 순)
      var began = saved.filter(function (s) { return s.step === curName; })[0];
      cur.classList.remove("is-now"); $(".tl-date", cur).textContent = began ? began.time : ci >= 0 ? SCENE[ci][1] : time;
      if (!next) return;
      next.classList.add("is-now"); $(".tl-date", next).textContent = "지금";
      $$(".tl-body p", next).forEach(function (p, k) { if (k === 0) p.className = ""; });
      var name = txt($(".tl-body p", next)), si = stepIdx(name);
      if (h2 && si >= 0) h2.textContent = TITLE[si];
      if (when) when.textContent = "11월 5일 " + korTime(time);
      if (note && /진료 시작/.test(name)) note.textContent = "녹음 일시중단 · 진료실 안 · " + time + "부터";
      if (note && /수납|진료 종료/.test(name) && /일시중단/.test(note.textContent)) note.textContent = "녹음 중 · " + time + " 다시 시작";
      if (!silent) { saved.push({ step: name, time: time }); save("steps", saved); toast(name + " 단계예요 · 보호자 화면에 " + time + "로 보여요"); }
      label();
    };
    saved.forEach(function (s) { advance(s.time, true); });
    // 연장이 승인됐으면 귀가 예정도 늘어난 시각으로
    var plan = $$(".block-head .block-note").filter(function (s) { return /귀가 예정/.test(s.textContent); })[0];
    if (plan && apNow) plan.textContent = "귀가 예정 " + ex.until + " · 연장 승인";
    // 연타 방지: 한 번 기록하면 잠깐 잠근다. disabled 대신 aria-disabled라 키보드 포커스가 버튼에 남는다
    var busy = false;
    if (btn) { btn.type = "button"; label();
      btn.addEventListener("click", function () {
        if (busy) return;
        busy = true; btn.setAttribute("aria-disabled", "true"); btn.setAttribute("aria-busy", "true");
        setTimeout(function () { busy = false; btn.removeAttribute("aria-disabled"); btn.removeAttribute("aria-busy"); }, 1200);
        var i = nowIdx(), last = i === items.length - 1;
        if (last) { location.href = "helper-finish.html"; return; }
        var name = txt($(".tl-body p", items[i + 1])), si = stepIdx(name);
        advance(si >= 0 ? SCENE[si][1] : later(sceneNow(), 5));
        if (/귀가 완료/.test(name)) setTimeout(function () { location.href = "helper-finish.html"; }, 900);
      }); }
    var photo = $('label.row input[type="file"]');
    if (photo) photo.addEventListener("change", function () { if (photo.files.length) toast("사진 " + photo.files.length + "장을 보냈어요 · 보호자 기록에 보여요"); });
  }

  // 보호자 진행 화면의 연장 줄: 승인한 요청이면 승인 시각, 아직이면 '승인 기다림'으로
  if (ex && BASE.indexOf("live") === 0) $$(".info span").forEach(function (s) {
    var a = $("a", s), lead = s.firstChild;
    if (!a || !lead || lead.nodeType !== 3 || !/바뀜/.test(lead.nodeValue)) return;
    lead.nodeValue = apNow ? "귀가 예상 " + ex.until + "으로 바뀜(승인 완료 " + apNow + ") · " : "연장 요청 · 귀가 예상 12:00 → " + ex.until + " · ";
    a.textContent = apNow ? "연장 내역 보기" : "승인하러 가기";
  });

  // 보호자 진행 화면: 도우미 기록이 이 화면보다 앞서 있으면 제목·단계·위치·녹음 상태를 그 단계로 맞춘다
  // (오류 화면 live--error는 '위치가 끊긴 상태'를 보여 주는 화면이라 그대로 둔다)
  if (PAGE === "live" || PAGE === "live-pharmacy") {
    var st = load("steps", []), lastS = st[st.length - 1], tl = $$(".timeline .tl-item");
    var nowLi = tl.filter(function (li) { return li.classList.contains("is-now"); })[0];
    var at = lastS ? stepIdx(lastS.step) : -1;
    if (at > stepIdx(txt(nowLi && $(".tl-body p", nowLi)))) {
      var eb = $(".hero .eyebrow"), ti = $(".hero .title"), ld = $(".hero .lead");
      if (eb) eb.textContent = "11월 5일 " + korTime(lastS.time);
      if (ti) ti.textContent = TITLE[at];
      if (ld) ld.textContent = lastS.time + " " + SCENE[at][0] + " · 위치 " + lastS.time + " 갱신";
      tl.forEach(function (it) {
        var si = stepIdx(txt($(".tl-body p", it))), rec = si < 0 ? null : st.filter(function (s) { return stepIdx(s.step) === si; })[0], dt = $(".tl-date", it);
        it.classList.toggle("is-now", rec === lastS);
        if (!rec) { if (dt) dt.textContent = dt.textContent.replace(/ · 지금$/, ""); return; }
        dt.textContent = rec.time + (rec === lastS ? " · 지금" : ""); dt.classList.remove("row-sub");
        $$(".tl-body p", it).forEach(function (q) { q.classList.remove("row-sub"); });
      });
      var endRec = st.filter(function (s) { return stepIdx(s.step) === 2; })[0];
      $$(".info span").forEach(function (s) {
        if (/위치 \d+:\d+ 갱신/.test(s.textContent)) s.textContent = s.textContent.replace(/위치 \d+:\d+ 갱신/, "위치 " + lastS.time + " 갱신");
        else if (/^녹음/.test(s.textContent)) s.textContent = at === SCENE.length - 1 ? "녹음 마침 · " + lastS.time : at >= 2 ? "녹음 중 · " + (endRec ? endRec.time : SCENE[2][1]) + " 다시 시작" : "녹음 일시중단 · 진료실 안";
      });
      if (at === SCENE.length - 1) {          // 귀가 완료면 동행 기록으로 이어 준다
        var stage = $(".stage");
        if (stage) {
          var sTitle = $(".row-title", stage), bar = $(".progress", stage);
          if (sTitle) sTitle.textContent = "4/5 동행 끝";
          if (bar) { bar.setAttribute("aria-valuenow", "4"); var seg4 = $$("span", bar)[3]; if (seg4) seg4.classList.add("is-on"); }
          $$(".stage-labels span", stage).forEach(function (s) { s.classList.toggle("is-now", txt(s) === "끝"); });
        }
        var pg = $(".page"), b = document.createElement("p"), a = document.createElement("a");
        b.className = "done"; a.href = "report.html"; a.textContent = lastS.time + " 댁에 도착했어요 · 동행 기록 보기 ›"; b.appendChild(a);
        if (pg) pg.insertBefore(b, pg.firstChild);
      }
    }
  }

  // 사진 올리기: 고른 뒤에도 다시 고를 수 있게 입력은 그대로 두고, 옆에 '올렸어요'만 붙인다
  $$('input[type="file"]').forEach(function (f) {
    if (PAGE === "helper-live") return;
    f.addEventListener("change", function () {
      if (!f.files.length) return;
      var lab = f.closest("label"), box = lab && lab.parentElement, ok = box && $(".file-ok", box);
      if (box && !ok) { ok = document.createElement("span"); ok.className = "file-ok"; ok.innerHTML = CHECK + " 올렸어요"; box.insertBefore(ok, lab); }
      var word = lab && Array.prototype.filter.call(lab.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); })[0];
      if (word) word.nodeValue = "다시 고르기";
      var fe = f.closest(".field.is-error"); if (fe) { fe.classList.remove("is-error"); var m = $(".field-msg", fe); if (m) m.remove(); }
      toast("자격증 사진을 올렸어요");
    });
  });

  // 전화 링크: 휴대폰에서는 바로 걸리고, PC에서는 걸 곳이 없으니 번호만 알려 준다
  if (!PHONE) $$('a[href^="tel:"]').forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); toast("휴대폰에서는 " + a.getAttribute("href").replace("tel:", "") + "로 바로 전화가 걸려요"); }); });

  // 첫 화면: 저장된 데모 값이 있을 때만 '데모 처음으로'를 보여 준다(휴대폰에는 PC 미리보기의 초기화 버튼이 없다)
  if (PAGE === "start") {
    if (RESET) toast("데모를 처음부터 시작해요");
    else if (keys().length) {
      var pgS = $(".page"), box = document.createElement("p"), go = document.createElement("a");
      box.className = "block-note demo-reset"; box.appendChild(document.createTextNode("전에 고른 값과 기록이 남아 있어요"));
      go.className = "btn small secondary"; go.href = "start.html?reset=1"; go.textContent = "데모 처음으로"; box.appendChild(go);
      if (pgS) pgS.appendChild(box);
    }
  }

  // 다른 탭(또는 캔버스의 다른 화면)에서 이 화면이 쓰는 값이 바뀌면 다시 그린다 — 화면별 기억(ui2:)은 제외
  addEventListener("storage", function (e) {
    if (e.key !== null && e.key.indexOf(K) !== 0) return;
    var k = e.key === null ? null : e.key.slice(K.length);
    if (k === null || (used[k] && k.indexOf("ui") !== 0)) { if (memTimer) flushMem(); location.reload(); }
  });
})();
