/* 원클릭 팔레트 교체 — 화면은 <link id="tokens" href="tokens.css"> 하나만 바꾼다.
   캔버스가 postMessage({type:'hd-palette', slug})를 보내거나, 마지막 선택(localStorage)·?p= 를 따른다. */
(function () {
  var KEY = 'hd-palette';
  function apply(slug) {
    var l = document.getElementById('tokens'); if (!l || !slug || !/^[a-z0-9-]+$/i.test(slug)) return;   // ?p= 로 들어온 값은 이름 글자만 받는다
    var base = l.getAttribute('data-base') || l.getAttribute('href'); l.setAttribute('data-base', base);
    var next = base.replace(/tokens(-[^/]*)?\.css$/, 'tokens-' + slug + '.css');
    if (l.getAttribute('href') !== next) l.setAttribute('href', next);                                  // 같은 파일이면 다시 받지 않는다
  }
  var s = new URLSearchParams(location.search).get('p');
  try { s = s || localStorage.getItem(KEY); } catch (e) {}
  if (s) apply(s);
  addEventListener('message', function (e) { if (e.data && e.data.type === 'hd-palette') apply(e.data.slug); });
})();
