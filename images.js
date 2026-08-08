// 이미지 첨부: 순수 로직 + IndexedDB 저장.
// 이미지는 Trip 객체에 넣지 않는다 — localStorage는 5MB 남짓이라 사진 한 장이면
// 터진다. blob은 IndexedDB에 두고 day.images에는 id만 담는다.
// schema.js 다음에 로드된다.

var _imgSeq = 0;
function newImageId() {
  return "im_" + Date.now().toString(36) + (_imgSeq++).toString(36);
}

// 긴 변을 maxPx에 맞추고 비율을 유지한다. 이미 작으면 그대로 둔다(늘리지 않는다).
function fitSize(w, h, maxPx) {
  var W = Number(w), H = Number(h), M = Number(maxPx);
  if (!isFinite(W) || !isFinite(H) || W <= 0 || H <= 0) return { w: 0, h: 0 };
  var long = Math.max(W, H);
  if (!isFinite(M) || M <= 0 || long <= M) return { w: Math.round(W), h: Math.round(H) };
  var k = M / long;
  return { w: Math.round(W * k), h: Math.round(H * k) };
}

// day.images를 손상된 값에서도 안전하게 다룬다(검증 없이 가져온 JSON 등).
function attachImage(day, id) {
  if (!day) return day;
  if (!Array.isArray(day.images)) day.images = [];
  if (day.images.indexOf(id) === -1) day.images.push(id);
  return day;
}

function detachImage(day, id) {
  if (!day) return day;
  if (!Array.isArray(day.images)) { day.images = []; return day; }
  day.images = day.images.filter(function (x) { return x !== id; });
  return day;
}

// 여행에서 실제로 쓰이는 이미지 id 전부. 일차를 지우거나 기간을 줄였을 때
// 어디에도 안 붙은 blob을 정리하는 데 쓴다.
function usedImageIds(trip) {
  var out = [];
  ((trip && trip.days) || []).forEach(function (d) {
    if (!d || !Array.isArray(d.images)) return;
    d.images.forEach(function (id) { if (out.indexOf(id) === -1) out.push(id); });
  });
  return out;
}

// ---- IndexedDB ----
// Node 테스트 환경과 file://(브라우저에 따라 IndexedDB가 막힌다)에서는 조용히
// 실패한다 — 이미지 첨부만 동작하지 않고 앱의 나머지는 그대로 쓸 수 있어야 한다.

var IMG_DB = "trip-images";
var IMG_STORE = "img";
var _imgDb = null;

function imgAvailable() {
  try { return typeof indexedDB !== "undefined" && !!indexedDB; }
  catch (e) { return false; }
}

function imgOpen() {
  return new Promise(function (resolve, reject) {
    if (!imgAvailable()) { reject(new Error("no-indexeddb")); return; }
    if (_imgDb) { resolve(_imgDb); return; }
    var req = indexedDB.open(IMG_DB, 1);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE);
    };
    req.onsuccess = function () { _imgDb = req.result; resolve(_imgDb); };
    req.onerror = function () { reject(req.error || new Error("idb-open")); };
  });
}

function imgTx(mode, fn) {
  return imgOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(IMG_STORE, mode);
      var store = tx.objectStore(IMG_STORE);
      var out;
      try { out = fn(store); } catch (e) { reject(e); return; }
      tx.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
      tx.onerror = function () { reject(tx.error || new Error("idb-tx")); };
      tx.onabort = function () { reject(tx.error || new Error("idb-abort")); };
    });
  });
}

function imgPut(id, blob) { return imgTx("readwrite", function (s) { return s.put(blob, id); }); }
function imgGet(id) { return imgTx("readonly", function (s) { return s.get(id); }); }
function imgDel(id) { return imgTx("readwrite", function (s) { return s.delete(id); }); }

// 파일을 캔버스로 줄여 JPEG blob으로 만든다. 원본을 그대로 넣으면 사진 한 장이
// 수 MB라 IndexedDB도 금방 커지고, 화면에 그릴 때마다 디코딩 비용이 든다.
var IMG_MAX_PX = 1600;
var IMG_QUALITY = 0.8;

function imgShrink(file) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type || "")) { reject(new Error("not-image")); return; }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var d = fitSize(im.naturalWidth, im.naturalHeight, IMG_MAX_PX);
      var c = document.createElement("canvas");
      c.width = d.w; c.height = d.h;
      c.getContext("2d").drawImage(im, 0, 0, d.w, d.h);
      URL.revokeObjectURL(url);
      c.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error("toBlob"));
      }, "image/jpeg", IMG_QUALITY);
    };
    im.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
    im.src = url;
  });
}

// 오브젝트 URL 캐시. renderTimeline이 화면을 통째로 다시 그리므로, 캐시가 없으면
// 일차를 넘길 때마다 blob을 다시 읽고 디코딩하게 된다.
var _imgUrls = {};

function imgUrl(id) {
  if (_imgUrls[id]) return Promise.resolve(_imgUrls[id]);
  return imgGet(id).then(function (blob) {
    if (!blob) return null;
    _imgUrls[id] = URL.createObjectURL(blob);
    return _imgUrls[id];
  });
}

function imgForget(id) {
  if (_imgUrls[id]) { URL.revokeObjectURL(_imgUrls[id]); delete _imgUrls[id]; }
}

// 어느 일차에도 안 붙은 blob을 지운다. 일차를 지우거나 기간을 줄이면 생긴다.
function imgSweep(trip) {
  if (!imgAvailable()) return Promise.resolve(0);
  var used = usedImageIds(trip);
  return imgTx("readonly", function (s) { return s.getAllKeys(); }).then(function (keys) {
    var dead = (keys || []).filter(function (k) { return used.indexOf(k) === -1; });
    return Promise.all(dead.map(function (k) { imgForget(k); return imgDel(k); }))
      .then(function () { return dead.length; });
  }).catch(function () { return 0; });
}
