/* 모심 프로토타입 동작 — 모든 화면이 같이 쓴다.
   - 칩·세그먼트·스위치·체크·별점 고르기, 입력 칸 수정 (화면마다 기억)
   - 목록 검색·걸러 보기
   - 하단 버튼을 누를 때 입력 검사 (오류는 같은 칸에 경고 아이콘 + 문구)
   - 화면 사이 이어지는 값 (어머니 동의 → 동의 완료, 도우미 연장 요청 → 보호자 승인 화면,
     도우미 귀가 기록의 전달사항 → 보호자 동행 기록, 도우미 단계 기록 → 보호자 진행 화면 …)
   상태는 이 브라우저의 localStorage에만 남는다. 앱 첫 화면의 '데모 처음으로'로 지운다. */
(function () {
  "use strict";
  var PAGE = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  var BASE = PAGE.replace(/--(error|done)$/, "");
  var K = "mosim:";
  function load(k, d) { try { var v = localStorage.getItem(K + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* 알림 한 줄 */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2200);
  }

  /* 입력 칸 찾기·값·오류 */
  function field(label) { return $$(".field").filter(function (f) { var l = $(".label", f); return l && l.textContent.trim().indexOf(label) === 0; })[0]; }
  function input(f) { return f && $("input.input, textarea.input", f); }
  function val(label) { var i = input(field(label)); return i ? i.value.trim() : ""; }
  function setError(f, msg) {
    if (!f) return;
    f.classList.add("is-error");
    var i = input(f); if (i) i.setAttribute("aria-invalid", "true");
    var m = $(".field-msg", f);
    if (!m) { m = document.createElement("p"); m.className = "field-msg"; f.appendChild(m); }
    m.innerHTML = WARN; m.appendChild(document.createTextNode(msg));
    if (i) i.focus({ preventScroll: true });
    f.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function clearError(f) {
    if (!f || !f.classList.contains("is-error")) return;
    f.classList.remove("is-error");
    var i = input(f); if (i) i.removeAttribute("aria-invalid");
    var m = $(".field-msg", f); if (m) m.remove();
  }
  document.addEventListener("input", function (e) { var f = e.target.closest && e.target.closest(".field"); if (f) clearError(f); });

  /* 시각 읽기: "오전 9시 30분" · "오후 12시" · "10:00" · "12:00 → 12:30"(마지막 값) */
  function minutes(s) {
    s = (s || "").split("→").pop().trim();
    var m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return +m[1] * 60 + +m[2];
    m = s.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/);
    if (!m) return null;
    var h = +m[2] % 12; if (m[1] === "오후" || (!m[1] && +m[2] === 12)) h += 12;
    return h * 60 + (+m[3] || 0);
  }
  function hhmm(t) { return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }
  function won(n) { return n.toLocaleString("ko-KR") + "원"; }
  function clock() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }

  /* ── 1. 고르는 조작: 칩 · 세그먼트 · 스위치 · 체크 · 별점 (화면마다 기억) ── */
  var mem = load("ui:" + PAGE, {});
  function remember(kind, i, v) { mem[kind + i] = v; save("ui:" + PAGE, mem); }

  // 같은 부모 아래 여러 줄로 나뉜 칩은 한 묶음이다
  var groups = [];
  $$(".chips").forEach(function (c) { if (groups.indexOf(c.parentElement) < 0) groups.push(c.parentElement); });
  groups.forEach(function (group, gi) {
    var chips = $$(":scope > .chips .chip", group), multi = chips.filter(function (c) { return c.classList.contains("is-selected"); }).length > 1;
    group.dataset.multi = multi ? "1" : "";
    chips.forEach(function (c, ci) {
      c.type = "button";
      var saved = mem["chip" + gi + "_" + ci];
      if (saved !== undefined) c.classList.toggle("is-selected", saved);
      c.setAttribute("aria-pressed", c.classList.contains("is-selected") ? "true" : "false");
      c.addEventListener("click", function () {
        if (multi) c.classList.toggle("is-selected");
        else chips.forEach(function (o) { o.classList.toggle("is-selected", o === c); });
        chips.forEach(function (o, oi) { o.setAttribute("aria-pressed", o.classList.contains("is-selected") ? "true" : "false"); remember("chip", gi + "_" + oi, o.classList.contains("is-selected")); });
        c.dispatchEvent(new CustomEvent("pick", { bubbles: true }));
      });
    });
  });

  $$(".seg").forEach(function (seg, si) {
    var items = $$(".seg-item", seg);
    var pick = function (it) { items.forEach(function (o) { var on = o === it; o.classList.toggle("is-selected", on); o.setAttribute("aria-checked", on ? "true" : "false"); }); };
    if (mem["seg" + si] !== undefined && items[mem["seg" + si]]) pick(items[mem["seg" + si]]);
    items.forEach(function (it, ii) {
      it.type = "button";
      it.addEventListener("click", function () { if (it.disabled) return; pick(it); remember("seg", si, ii); });
    });
  });

  $$(".switch, .check").forEach(function (b, bi) {
    b.type = "button";
    if (mem["tog" + bi] !== undefined) b.setAttribute("aria-checked", mem["tog" + bi] ? "true" : "false");
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-checked") !== "true";
      b.setAttribute("aria-checked", on ? "true" : "false"); remember("tog", bi, on);
      b.dispatchEvent(new CustomEvent("toggle", { bubbles: true }));
    });
  });

  $$(".rating.is-input").forEach(function (r, ri) {
    var stars = $$("button", r);
    var set = function (n) { stars.forEach(function (s, i) { s.classList.toggle("is-on", i < n); s.setAttribute("aria-checked", i === n - 1 ? "true" : "false"); }); r.dataset.value = n; };
    set(mem["rate" + ri] !== undefined ? mem["rate" + ri] : stars.filter(function (s) { return s.classList.contains("is-on"); }).length);
    stars.forEach(function (s, i) { s.type = "button"; s.addEventListener("click", function () { set(i + 1); remember("rate", ri, i + 1); }); });
  });

  $$("input.input, textarea.input").forEach(function (i, ii) {
    if (mem["in" + ii] !== undefined) i.value = mem["in" + ii];
    i.addEventListener("input", function () { remember("in", ii, i.value); });
  });

  /* ── 2. 목록 검색 · 걸러 보기 ── */
  var search = $('.search input[type="search"]');
  if (search) {
    var block = search.closest(".block") || document;
    var rows = $$(".row", block);
    var chipsBox = $(".chips", block);
    var RULE = { "이번 주": function (t) { var m = t.match(/11\/(\d+)/); return m && +m[1] <= 7; }, "대중교통": /마을버스|대중교통|버스/, "접수까지": /접수/ };
    var empty = document.createElement("div"); empty.className = "empty"; empty.hidden = true; empty.textContent = "맞는 도움요청이 없어요. 걸러 보기를 바꿔 보세요.";
    block.appendChild(empty);
    var apply = function () {
      var q = search.value.trim(), on = chipsBox && $(".chip.is-selected", chipsBox), key = on ? on.textContent.trim() : "전체", shown = 0;
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
      var need = ["날짜", "만남 시각", "만남 장소", "병원", "진료 예약 시각"];
      for (var i = 0; i < need.length; i++) if (!val(need[i])) return setError(field(need[i]), need[i] + "을(를) 적어 주세요"), false;
      var meet = minutes(val("만남 시각")), appt = minutes(val("진료 예약 시각"));
      if (meet == null) return setError(field("만남 시각"), "‘오전 9시 30분’처럼 적어 주세요"), false;
      if (appt == null) return setError(field("진료 예약 시각"), "‘오전 10시’처럼 적어 주세요"), false;
      if (appt <= meet) return setError(field("진료 예약 시각"), "진료 예약이 만남 시각보다 빨라요"), false;
      if (!$$(".check").some(function (c) { return c.getAttribute("aria-checked") === "true"; })) return toast("부탁할 도움을 하나 이상 골라 주세요"), false;
      save("request", { date: val("날짜"), meet: val("만남 시각"), place: val("만남 장소"), hospital: val("병원"), appt: val("진료 예약 시각") });
      return true;
    },
    "helper-change": function () {
      var t = minutes(val("귀가 예상"));
      if (t == null) return setError(field("귀가 예상"), "‘12:00 → 12:30’처럼 적어 주세요"), false;
      if (t <= 12 * 60) return setError(field("귀가 예상"), "원래 귀가 12:00보다 늦은 시각을 골라 주세요"), false;
      var reason = $(".chip.is-selected"); var ext = Math.ceil((t - 720) / 30) * 30;
      save("extension", { reason: reason ? reason.textContent.trim() : "", memo: val("메모"), until: hhmm(t), minutes: ext, cost: ext / 30 * 9000, at: clock() });
      return true;
    },
    "dispute": function () {
      if (!val("기억하는 내용")) return setError(field("기억하는 내용"), "어떻게 기억하시는지 한 줄만 적어 주세요"), false;
      var c = $(".chip.is-selected"); save("dispute", { what: c ? c.textContent.trim() : "", memo: val("기억하는 내용") });
      return true;
    },
    "review": function () {
      var r = $(".rating.is-input"), text = val("공개 후기");
      if (r && !(+r.dataset.value > 0)) return toast("별점을 하나 이상 골라 주세요"), false;
      if (!text) return setError(field("공개 후기"), "다음 보호자에게 남길 한마디를 적어 주세요"), false;
      if (/\d+\s*동|아파트|번지|\d+\s*호|주사|진단|병명|처방/.test(text)) return setError(field("공개 후기"), "공개 후기에는 주소·건강 정보를 쓸 수 없어요"), false;
      save("review", { stars: +(r ? r.dataset.value : 5), text: text });
      return true;
    },
    "helper-join": function () {
      if (!val("이름")) return setError(field("이름"), "이름을 적어 주세요"), false;
      if (!val("사는 곳")) return setError(field("사는 곳"), "사는 동네를 적어 주세요"), false;
      var missing = $$('input[type="file"]').filter(function (i) { return !i.files || !i.files.length; })[0];
      if (missing) { toast("자격증 사진을 한 장 올려 주세요"); missing.closest(".row, .field").scrollIntoView({ block: "center", behavior: "smooth" }); return false; }
      return true;
    },
    "parent-consent": function () {
      save("consent", $$(".seg").map(function (s) { var i = $$(".seg-item", s).findIndex(function (x) { return x.classList.contains("is-selected"); }); return i; }));
      return true;
    },
    "booking-cancel": function () { var c = $(".chip.is-selected"); save("cancel", c ? c.textContent.trim() : ""); return true; },
    "change-request": function () { save("approved", clock()); return true; },
    "helper-finish": function () {
      save("share", $$(".row").filter(function (r) { var s = $(".switch", r); return s && s.getAttribute("aria-checked") === "true"; })
        .map(function (r) { return { title: $(".row-title", r).textContent.trim(), sub: ($(".row-sub", r) || { textContent: "" }).textContent.trim() }; }));
      return true;
    }
  };
  var cta = $$(".cta .btn:not(.is-done)").pop();   // 위험한 확인(취소 등)은 회색 버튼이라 주 버튼만 찾지 않는다
  if (cta && RULES[BASE]) cta.addEventListener("click", function (e) { if (!RULES[BASE]()) e.preventDefault(); });

  /* ── 4. 화면별 동작 ── */
  // 도우미 연장 요청: 귀가 예상을 고치면 추가 시간·비용이 바로 계산된다
  if (BASE === "helper-change") {
    var upd = function () {
      var t = minutes(val("귀가 예상")), fT = input(field("추가 시간")), fC = input(field("추가 비용"));
      if (!fT || !fC) return;
      if (t == null || t <= 720) { fT.value = "—"; fC.value = "—"; return; }
      var ext = Math.ceil((t - 720) / 30) * 30; fT.value = ext + "분"; fC.value = won(ext / 30 * 9000) + " (예시 요율)";
    };
    var g = input(field("귀가 예상")); if (g) g.addEventListener("input", upd);
  }
  // 보호자 연장 승인: 도우미가 보낸 요청을 그대로 보여 준다
  var ex = load("extension", null);
  if (ex && (BASE === "change-request" || BASE === "helper-change")) {
    if (BASE === "change-request") {
      var title = $(".hero .title"), lead = $(".hero .lead");
      if (title) title.textContent = (ex.reason || "진료 대기 길어짐") + " · " + ex.minutes + "분 늘어나요";
      if (lead) lead.textContent = "귀가 예상 12:00 → " + ex.until;
      $$(".row").forEach(function (r) {
        var t = ($(".row-title", r) || {}).textContent || "", tr = $(".row-trail", r);
        if (!tr) return;
        if (t.indexOf("추가 시간") === 0) tr.textContent = ex.minutes + "분";
        if (t.indexOf("추가 비용") === 0) tr.textContent = won(ex.cost);
      });
    }
  }
  if (PAGE === "change-request--done") { var ap = load("approved", null), d = $(".done"); if (ap && d && ex) d.textContent = ap + " 승인했어요 — 귀가 예상 " + ex.until; }
  if (PAGE === "helper-change--done") { var d2 = $(".done"), ap2 = load("approved", null); if (d2 && ex) d2.textContent = ex.at + " 보냈어요 — " + (ap2 ? ap2 + " 김수진 님이 승인했어요" : "보호자 승인을 기다려요"); }

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

  // 도우미 동행 기록: 버튼 한 번에 지금 단계를 기록하고 다음 단계로
  if (PAGE === "helper-live") {
    var btn = $$(".block .btn.primary")[0], items = $$(".timeline .tl-item"), note = btn && btn.parentElement.querySelector(".block-note");
    var saved = load("steps", []);
    var nowIdx = function () { return items.findIndex(function (li) { return li.classList.contains("is-now"); }); };
    var label = function () { var n = items[nowIdx() + 1]; btn.textContent = n ? $(".tl-body p", n).textContent.trim() + " 기록" : "귀가 완료 보내기"; };
    var advance = function (time, silent) {
      var i = nowIdx(); if (i < 0) return;
      var cur = items[i], next = items[i + 1];
      cur.classList.remove("is-now"); $(".tl-date", cur).textContent = time;
      if (!next) return;
      next.classList.add("is-now"); $(".tl-date", next).textContent = "지금";
      $$(".tl-body p", next).forEach(function (p, k) { if (k === 0) p.className = ""; });
      var name = $(".tl-body p", next).textContent.trim();
      if (note && /진료 시작/.test(name)) note.textContent = "녹음 일시중단 · 진료실 안 · " + time + "부터";
      if (note && /수납|진료 종료/.test(name) && /일시중단/.test(note.textContent)) note.textContent = "녹음 중 · " + time + " 다시 시작";
      if (!silent) { saved.push({ step: name, time: time }); save("steps", saved); toast(name + " 단계예요 · 보호자 화면에 " + time + "로 보여요"); }
      label();
    };
    saved.forEach(function (s) { advance(s.time, true); });
    if (btn) { btn.type = "button"; label();
      btn.addEventListener("click", function () {
        var i = nowIdx(), last = i === items.length - 1;
        if (last) { location.href = "helper-finish.html"; return; }
        var cur = $(".tl-body p", items[i + 1]); var name = cur ? cur.textContent.trim() : "";
        advance(clock());
        if (/귀가 완료/.test(name)) setTimeout(function () { location.href = "helper-finish.html"; }, 900);
      }); }
    var photo = $('label.row input[type="file"]');
    if (photo) photo.addEventListener("change", function () { if (photo.files.length) toast("사진 " + photo.files.length + "장을 보냈어요 · 보호자 기록에 보여요"); });
  }
  // 보호자 진행 화면: 도우미가 방금 기록한 단계가 맨 위에
  if (/^live/.test(PAGE)) {
    var st = load("steps", []);
    if (st.length) { var last = st[st.length - 1], b2 = document.createElement("p"); b2.className = "done"; b2.textContent = "도우미 기록 · " + last.time + " " + last.step + " 단계로 넘어갔어요"; var pg = $(".page"); if (pg) pg.insertBefore(b2, pg.firstChild); }
  }

  // 도우미 가입: 자격증 사진을 올리면 그 줄이 '올렸어요'로
  $$('input[type="file"]').forEach(function (f) {
    if (PAGE === "helper-live") return;
    f.addEventListener("change", function () {
      if (!f.files.length) return;
      var row = f.closest(".row"), lab = f.closest("label");
      if (lab) lab.outerHTML = '<span class="row-sub">' + CHECK + " 올렸어요</span>";
      var fe = row && row.closest(".field"); if (fe) clearError(fe);
      var msg = document.querySelector(".field-msg"); if (msg && /자격증/.test(msg.textContent)) msg.remove();
      toast("자격증 사진을 올렸어요");
    });
  });

  // 전화·문자 링크는 PC에서 눌렀을 때 무엇을 하는지 알려 준다
  if (!matchMedia("(pointer: coarse)").matches) $$('a[href^="tel:"]').forEach(function (a) { a.addEventListener("click", function () { toast("휴대폰에서는 " + a.href.replace("tel:", "") + "로 바로 전화가 걸려요"); }); });
})();
