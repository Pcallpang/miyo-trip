// 서비스워커 등록. 원래 index.html 안에 인라인 <script>로 있었는데 밖으로 뺐다 —
// Vercel에서 CSP를 script-src 'self'로 거는데, 인라인 스크립트를 남겨 두면
// 'unsafe-inline'을 열어 줘야 하고 그러면 CSP를 거는 의미가 거의 없어진다.
//
// file://로 연 단일 파일(trip.html)에는 이 파일이 없다. 그쪽은 bundle.py가
// 따로 만들고 서비스워커도 쓰지 않는다.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
