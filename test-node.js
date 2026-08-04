// 순수 함수 테스트를 Node에서 실행한다. 브라우저 API는 최소 스텁으로 대체.
var fs = require("fs");

var mem = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; },
  key: function (i) { return Object.keys(mem)[i]; },
  get length() { return Object.keys(mem).length; }
};
global.document = { addEventListener: function () {}, getElementById: function () { return null; } };
global.window = global;
global.__resetStorage = function () { mem = {}; };

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
var files = ["app.js", "tests.js"];
for (var i = 0; i < files.length; i++) {
  eval(fs.readFileSync(files[i], "utf8"));
}

console.log(out.join("\n"));
console.log(failed ? failed + "개 실패" : out.length + "개 전부 통과");
process.exit(failed ? 1 : 0);
