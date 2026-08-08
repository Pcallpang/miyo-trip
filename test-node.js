// 순수 함수 테스트를 Node에서 실행한다. 브라우저 API는 최소 스텁으로 대체.
var fs = require("fs");

var mem = {};
// __failWrites 가 true면 setItem이 조용히 no-op(쓴 척만 함)한다 — 예외를 던지지 않는
// 프라이빗 모드/용량 초과류의 "silent no-op" 실패를 흉내내기 위함. 다른 모든 동작은 그대로.
// __writeSizeLimit(바이트, -1이면 무제한)이 설정돼 있으면 그 값을 넘는 쓰기만 no-op한다 —
// saveTrip처럼 큰 본체 쓰기와 작은 인덱스 쓰기를 함께 하는 코드에서, 실제 용량 초과처럼
// "큰 쓰기만 실패하고 작은 쓰기는 성공"하는 상황을 흉내내기 위함(모든 쓰기를 실패시키는
// __failWrites만으로는 본체/인덱스 분리 문제를 드러낼 수 없다).
var failWrites = false;
var writeSizeLimit = -1;
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) {
    if (failWrites) return;
    if (writeSizeLimit >= 0 && String(v).length > writeSizeLimit) return;
    mem[k] = String(v);
  },
  removeItem: function (k) { delete mem[k]; },
  key: function (i) { return Object.keys(mem)[i]; },
  get length() { return Object.keys(mem).length; }
};
// 렌더 함수(renderTabs/renderTimeline 등)는 document.getElementById(id)로 렌더 대상을
// 찾는다. 기본은 기존과 동일하게 null(등록되지 않은 id는 그대로 null) — 순수 함수만
// 테스트하던 기존 단언에 영향이 없다. 속성 컨텍스트를 검증하는 단언은 호출 직전에
// __setDomTarget(id)로 그 id 전용의 새 가짜 엘리먼트를 만들어 쓴다. 매번 새로 만들어
// 끼워 넣으므로 이전 단언이 같은 id를 썼어도 상태가 새지 않고, 단언 실행 순서도
// 결과에 영향을 주지 않는다.
var domTargets = {};
function makeFakeElement(id) {
  var html = "";
  return {
    id: id,
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    addEventListener: function () {},
    scrollIntoView: function () {}
  };
}
global.__setDomTarget = function (id) {
  var el = makeFakeElement(id);
  domTargets[id] = el;
  return el;
};
global.document = {
  addEventListener: function () {},
  getElementById: function (id) {
    return Object.prototype.hasOwnProperty.call(domTargets, id) ? domTargets[id] : null;
  }
};
global.window = global;
// app.js는 로드 시점에 window.addEventListener("hashchange", ...)를 건다. Node의 global에는
// 없으므로 no-op으로 채운다. location은 라우터가 읽고 쓰는 해시만 흉내낸다.
global.addEventListener = function () {};
global.location = { hash: "" };
global.__resetStorage = function () { mem = {}; failWrites = false; writeSizeLimit = -1; global.__alerts = []; };
global.__setWritesFail = function (v) { failWrites = v; };
global.__setWriteSizeLimit = function (n) { writeSizeLimit = n; };
// alert()는 브라우저 전용이라 Node에는 없다 — afterItemEdit(views.js)이 실패 시 이걸
// 직접 부르므로, 호출을 그냥 삼키는 대신 기록해 두어 테스트에서 확인할 수 있게 한다.
global.__alerts = [];
global.alert = function (msg) { global.__alerts.push(msg); };

var failed = 0, out = [];
global.eq = function (name, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { out.push("PASS " + name); return; }
  failed++;
  out.push("FAIL " + name + "\n  got : " + JSON.stringify(got) + "\n  want: " + JSON.stringify(want));
};

// 로드 순서 = index.html의 script 순서
// forEach 콜백 안에서 direct eval을 쓰면 함수 선언이 콜백 스코프에 묶여
// 반복이 끝나면 사라지므로, 모듈 최상위에서 for 루프로 실행한다.
var files = ["sample-trip.js", "store.js", "schema.js", "remote.js", "views.js", "editor.js", "app.js", "tests.js"];
for (var i = 0; i < files.length; i++) {
  eval(fs.readFileSync(files[i], "utf8"));
}

console.log(out.join("\n"));
console.log(failed ? failed + "개 실패" : out.length + "개 전부 통과");
process.exit(failed ? 1 : 0);
