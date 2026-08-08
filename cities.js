// 나라별 주요 도시. Open-Meteo 지오코딩은 나라만으로 도시를 나열해 주지 못하므로
// (countryCode 필터도 name 없이는 0건) 여행지로 쓸 만한 도시를 미리 구워 둔다.
// 좌표·시간대·한국어 이름은 같은 지오코딩 API에서 받은 값이라 검색 결과와 일치한다.
// 목록에 없는 도시는 '직접 입력'으로 이름을 적고 검색해서 고르면 된다.
// 생성: scratchpad/gen_cities.py (1회성)
window.CITIES = {
 "JP": [
  {
   "name": "도쿄",
   "lat": 35.6895,
   "lon": 139.69171,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "오사카 시",
   "lat": 34.69379,
   "lon": 135.50107,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "교토 시",
   "lat": 35.02107,
   "lon": 135.75385,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "후쿠오카 시",
   "lat": 33.6,
   "lon": 130.41667,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "삿포로 시",
   "lat": 43.06667,
   "lon": 141.35,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "나고야 시",
   "lat": 35.18147,
   "lon": 136.9064,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "오키나와 시",
   "lat": 26.33583,
   "lon": 127.80139,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "히로시마 시",
   "lat": 34.4,
   "lon": 132.45,
   "tz": "Asia/Tokyo"
  },
  {
   "name": "고베 시",
   "lat": 34.6913,
   "lon": 135.183,
   "tz": "Asia/Tokyo"
  }
 ],
 "KR": [
  {
   "name": "서울특별시",
   "lat": 37.566,
   "lon": 126.9784,
   "tz": "Asia/Seoul"
  },
  {
   "name": "부산광역시",
   "lat": 35.10168,
   "lon": 129.03004,
   "tz": "Asia/Seoul"
  },
  {
   "name": "Jejudo",
   "lat": 33.40167,
   "lon": 126.54611,
   "tz": "Asia/Seoul"
  },
  {
   "name": "인천광역시",
   "lat": 37.45646,
   "lon": 126.70515,
   "tz": "Asia/Seoul"
  },
  {
   "name": "강릉시",
   "lat": 37.75266,
   "lon": 128.87239,
   "tz": "Asia/Seoul"
  },
  {
   "name": "경주시",
   "lat": 35.84278,
   "lon": 129.21167,
   "tz": "Asia/Seoul"
  },
  {
   "name": "여수시",
   "lat": 34.76062,
   "lon": 127.66215,
   "tz": "Asia/Seoul"
  },
  {
   "name": "대구광역시",
   "lat": 35.87028,
   "lon": 128.59111,
   "tz": "Asia/Seoul"
  }
 ],
 "TW": [
  {
   "name": "타이베이",
   "lat": 25.05306,
   "lon": 121.52639,
   "tz": "Asia/Taipei"
  },
  {
   "name": "가오슝 시",
   "lat": 22.61626,
   "lon": 120.31333,
   "tz": "Asia/Taipei"
  },
  {
   "name": "타이중 시",
   "lat": 24.1469,
   "lon": 120.6839,
   "tz": "Asia/Taipei"
  },
  {
   "name": "타이난 시",
   "lat": 22.99083,
   "lon": 120.21333,
   "tz": "Asia/Taipei"
  },
  {
   "name": "화롄 시",
   "lat": 23.97694,
   "lon": 121.60444,
   "tz": "Asia/Taipei"
  }
 ],
 "CN": [
  {
   "name": "베이징",
   "lat": 39.9075,
   "lon": 116.39723,
   "tz": "Asia/Shanghai"
  },
  {
   "name": "상하이",
   "lat": 31.22222,
   "lon": 121.45806,
   "tz": "Asia/Shanghai"
  },
  {
   "name": "주하이 시",
   "lat": 22.27694,
   "lon": 113.56778,
   "tz": "Asia/Shanghai"
  },
  {
   "name": "광저우",
   "lat": 23.11667,
   "lon": 113.25,
   "tz": "Asia/Shanghai"
  },
  {
   "name": "청두 시",
   "lat": 30.66667,
   "lon": 104.06667,
   "tz": "Asia/Shanghai"
  },
  {
   "name": "칭다오 시",
   "lat": 36.06488,
   "lon": 120.38042,
   "tz": "Asia/Shanghai"
  },
  {
   "name": "하얼빈 시",
   "lat": 45.75,
   "lon": 126.65,
   "tz": "Asia/Shanghai"
  }
 ],
 "HK": [
  {
   "name": "홍콩",
   "lat": 22.27832,
   "lon": 114.17469,
   "tz": "Asia/Hong_Kong"
  }
 ],
 "MO": [
  {
   "name": "마카오",
   "lat": 22.20056,
   "lon": 113.54611,
   "tz": "Asia/Macau"
  }
 ],
 "VN": [
  {
   "name": "하노이",
   "lat": 21.0245,
   "lon": 105.84117,
   "tz": "Asia/Bangkok"
  },
  {
   "name": "다낭",
   "lat": 16.06778,
   "lon": 108.22083,
   "tz": "Asia/Ho_Chi_Minh"
  },
  {
   "name": "호치민",
   "lat": 10.82302,
   "lon": 106.62965,
   "tz": "Asia/Ho_Chi_Minh"
  },
  {
   "name": "호이안",
   "lat": 15.87944,
   "lon": 108.335,
   "tz": "Asia/Ho_Chi_Minh"
  },
  {
   "name": "냐짱",
   "lat": 12.24507,
   "lon": 109.19432,
   "tz": "Asia/Ho_Chi_Minh"
  },
  {
   "name": "푸꼭",
   "lat": 10.22409,
   "lon": 103.97156,
   "tz": "Asia/Ho_Chi_Minh"
  },
  {
   "name": "후에",
   "lat": 16.4619,
   "lon": 107.59546,
   "tz": "Asia/Bangkok"
  }
 ],
 "TH": [
  {
   "name": "방콕",
   "lat": 13.75398,
   "lon": 100.50144,
   "tz": "Asia/Bangkok"
  },
  {
   "name": "치앙마이",
   "lat": 18.79038,
   "lon": 98.98468,
   "tz": "Asia/Bangkok"
  },
  {
   "name": "푸켓",
   "lat": 7.89059,
   "lon": 98.3981,
   "tz": "Asia/Bangkok"
  },
  {
   "name": "파타야",
   "lat": 12.93333,
   "lon": 100.88333,
   "tz": "Asia/Bangkok"
  },
  {
   "name": "끄라비",
   "lat": 8.07257,
   "lon": 98.91052,
   "tz": "Asia/Bangkok"
  }
 ],
 "SG": [
  {
   "name": "싱가포르",
   "lat": 1.28967,
   "lon": 103.85007,
   "tz": "Asia/Singapore"
  }
 ],
 "MY": [
  {
   "name": "쿠알라룸푸르",
   "lat": 3.1412,
   "lon": 101.68653,
   "tz": "Asia/Kuala_Lumpur"
  },
  {
   "name": "코타키나발루",
   "lat": 5.9749,
   "lon": 116.0724,
   "tz": "Asia/Kuching"
  },
  {
   "name": "조지타운",
   "lat": 5.41123,
   "lon": 100.33543,
   "tz": "Asia/Kuala_Lumpur"
  },
  {
   "name": "Malacca",
   "lat": 2.196,
   "lon": 102.2405,
   "tz": "Asia/Kuala_Lumpur"
  },
  {
   "name": "Langkawit",
   "lat": 5.68333,
   "lon": 115.93333,
   "tz": "Asia/Kuching"
  }
 ],
 "ID": [
  {
   "name": "덴파사르",
   "lat": -8.65,
   "lon": 115.21667,
   "tz": "Asia/Makassar"
  },
  {
   "name": "자카르타",
   "lat": -6.21462,
   "lon": 106.84513,
   "tz": "Asia/Jakarta"
  },
  {
   "name": "욕야카르타",
   "lat": -7.80139,
   "lon": 110.36472,
   "tz": "Asia/Jakarta"
  },
  {
   "name": "수라바야",
   "lat": -7.24917,
   "lon": 112.75083,
   "tz": "Asia/Jakarta"
  },
  {
   "name": "반둥",
   "lat": -6.92222,
   "lon": 107.60694,
   "tz": "Asia/Jakarta"
  }
 ],
 "PH": [
  {
   "name": "세부",
   "lat": 10.31672,
   "lon": 123.89071,
   "tz": "Asia/Manila"
  },
  {
   "name": "마닐라",
   "lat": 14.6042,
   "lon": 120.9822,
   "tz": "Asia/Manila"
  },
  {
   "name": "Boracay Island",
   "lat": 11.98013,
   "lon": 121.91932,
   "tz": "Asia/Manila"
  },
  {
   "name": "보홀섬",
   "lat": 9.83333,
   "lon": 124.16667,
   "tz": "Asia/Manila"
  },
  {
   "name": "Palawan Island",
   "lat": 9.53153,
   "lon": 118.46149,
   "tz": "Asia/Manila"
  }
 ],
 "KH": [
  {
   "name": "시엠레아프",
   "lat": 13.36179,
   "lon": 103.86056,
   "tz": "Asia/Phnom_Penh"
  },
  {
   "name": "프놈펜",
   "lat": 11.56245,
   "lon": 104.91601,
   "tz": "Asia/Phnom_Penh"
  }
 ],
 "LA": [
  {
   "name": "비엔티안",
   "lat": 17.96667,
   "lon": 102.6,
   "tz": "Asia/Vientiane"
  },
  {
   "name": "루앙프라방",
   "lat": 19.8933,
   "lon": 102.1525,
   "tz": "Asia/Vientiane"
  }
 ],
 "MM": [
  {
   "name": "양곤",
   "lat": 16.80528,
   "lon": 96.15611,
   "tz": "Asia/Yangon"
  },
  {
   "name": "만달레이",
   "lat": 21.97473,
   "lon": 96.08359,
   "tz": "Asia/Yangon"
  }
 ],
 "BN": [
  {
   "name": "반다르스리브가완",
   "lat": 4.89035,
   "lon": 114.94006,
   "tz": "Asia/Brunei"
  }
 ],
 "IN": [
  {
   "name": "뉴델리",
   "lat": 28.62137,
   "lon": 77.2148,
   "tz": "Asia/Kolkata"
  },
  {
   "name": "뭄바이",
   "lat": 19.07283,
   "lon": 72.88261,
   "tz": "Asia/Kolkata"
  },
  {
   "name": "자이푸르",
   "lat": 26.91962,
   "lon": 75.78781,
   "tz": "Asia/Kolkata"
  },
  {
   "name": "바라나시",
   "lat": 25.31668,
   "lon": 83.01041,
   "tz": "Asia/Kolkata"
  },
  {
   "name": "벵갈루루",
   "lat": 12.97194,
   "lon": 77.59369,
   "tz": "Asia/Kolkata"
  }
 ],
 "NP": [
  {
   "name": "카트만두",
   "lat": 27.70169,
   "lon": 85.3206,
   "tz": "Asia/Kathmandu"
  },
  {
   "name": "포카라",
   "lat": 28.26689,
   "lon": 83.96851,
   "tz": "Asia/Kathmandu"
  }
 ],
 "LK": [
  {
   "name": "콜롬보",
   "lat": 6.93548,
   "lon": 79.84868,
   "tz": "Asia/Colombo"
  },
  {
   "name": "캔디",
   "lat": 7.2906,
   "lon": 80.6336,
   "tz": "Asia/Colombo"
  }
 ],
 "MV": [
  {
   "name": "말레",
   "lat": 4.17521,
   "lon": 73.50916,
   "tz": "Indian/Maldives"
  }
 ],
 "KZ": [
  {
   "name": "알마티",
   "lat": 43.25249,
   "lon": 76.9115,
   "tz": "Asia/Almaty"
  },
  {
   "name": "아스타나",
   "lat": 51.1801,
   "lon": 71.44598,
   "tz": "Asia/Almaty"
  }
 ],
 "UZ": [
  {
   "name": "타슈켄트",
   "lat": 41.26465,
   "lon": 69.21627,
   "tz": "Asia/Tashkent"
  },
  {
   "name": "사마르칸트",
   "lat": 39.65456,
   "lon": 66.96445,
   "tz": "Asia/Samarkand"
  }
 ],
 "US": [
  {
   "name": "뉴욕",
   "lat": 40.71427,
   "lon": -74.00597,
   "tz": "America/New_York"
  },
  {
   "name": "로스앤젤레스",
   "lat": 34.05223,
   "lon": -118.24368,
   "tz": "America/Los_Angeles"
  },
  {
   "name": "샌프란시스코",
   "lat": 37.77493,
   "lon": -122.41942,
   "tz": "America/Los_Angeles"
  },
  {
   "name": "라스베이거스",
   "lat": 36.17497,
   "lon": -115.13722,
   "tz": "America/Los_Angeles"
  },
  {
   "name": "시애틀",
   "lat": 47.60621,
   "lon": -122.33207,
   "tz": "America/Los_Angeles"
  },
  {
   "name": "시카고",
   "lat": 41.85003,
   "lon": -87.65005,
   "tz": "America/Chicago"
  },
  {
   "name": "호놀룰루",
   "lat": 21.30694,
   "lon": -157.85834,
   "tz": "Pacific/Honolulu"
  },
  {
   "name": "보스턴",
   "lat": 42.35843,
   "lon": -71.05977,
   "tz": "America/New_York"
  },
  {
   "name": "워싱턴 D.C.",
   "lat": 38.89511,
   "lon": -77.03637,
   "tz": "America/New_York"
  },
  {
   "name": "올랜도",
   "lat": 28.53834,
   "lon": -81.37924,
   "tz": "America/New_York"
  },
  {
   "name": "샌디에고",
   "lat": 32.71571,
   "lon": -117.16472,
   "tz": "America/Los_Angeles"
  }
 ],
 "CA": [
  {
   "name": "Vancouver Island",
   "lat": 49.65064,
   "lon": -125.44939,
   "tz": "America/Vancouver"
  },
  {
   "name": "토론토",
   "lat": 43.70643,
   "lon": -79.39864,
   "tz": "America/Toronto"
  },
  {
   "name": "몬트리올",
   "lat": 45.50884,
   "lon": -73.58781,
   "tz": "America/Toronto"
  },
  {
   "name": "캘거리",
   "lat": 51.05011,
   "lon": -114.08529,
   "tz": "America/Edmonton"
  }
 ],
 "MX": [
  {
   "name": "멕시코시티",
   "lat": 19.42847,
   "lon": -99.12766,
   "tz": "America/Mexico_City"
  },
  {
   "name": "칸쿤",
   "lat": 21.17429,
   "lon": -86.84656,
   "tz": "America/Cancun"
  }
 ],
 "BR": [
  {
   "name": "상파울루",
   "lat": -23.5475,
   "lon": -46.63611,
   "tz": "America/Sao_Paulo"
  },
  {
   "name": "리우데자네이루",
   "lat": -22.90642,
   "lon": -43.18223,
   "tz": "America/Sao_Paulo"
  }
 ],
 "AR": [
  {
   "name": "부에노스아이레스",
   "lat": -34.61315,
   "lon": -58.37723,
   "tz": "America/Argentina/Buenos_Aires"
  }
 ],
 "CL": [
  {
   "name": "산티아고",
   "lat": -33.45694,
   "lon": -70.64827,
   "tz": "America/Santiago"
  }
 ],
 "PE": [
  {
   "name": "리마",
   "lat": -12.04318,
   "lon": -77.02824,
   "tz": "America/Lima"
  },
  {
   "name": "쿠스코",
   "lat": -13.53188,
   "lon": -71.96701,
   "tz": "America/Lima"
  }
 ],
 "GB": [
  {
   "name": "런던",
   "lat": 51.50853,
   "lon": -0.12574,
   "tz": "Europe/London"
  },
  {
   "name": "에든버러",
   "lat": 55.95206,
   "lon": -3.19648,
   "tz": "Europe/London"
  },
  {
   "name": "맨체스터",
   "lat": 53.48095,
   "lon": -2.23743,
   "tz": "Europe/London"
  },
  {
   "name": "리버풀",
   "lat": 53.41058,
   "lon": -2.97794,
   "tz": "Europe/London"
  },
  {
   "name": "옥스퍼드",
   "lat": 51.75222,
   "lon": -1.25596,
   "tz": "Europe/London"
  },
  {
   "name": "바스",
   "lat": 51.3751,
   "lon": -2.36172,
   "tz": "Europe/London"
  }
 ],
 "FR": [
  {
   "name": "파리",
   "lat": 48.85341,
   "lon": 2.3488,
   "tz": "Europe/Paris"
  },
  {
   "name": "니스",
   "lat": 43.70313,
   "lon": 7.26608,
   "tz": "Europe/Paris"
  },
  {
   "name": "리옹",
   "lat": 45.74906,
   "lon": 4.84789,
   "tz": "Europe/Paris"
  },
  {
   "name": "마르세유",
   "lat": 43.29695,
   "lon": 5.38107,
   "tz": "Europe/Paris"
  },
  {
   "name": "스트라스부르",
   "lat": 48.58392,
   "lon": 7.74553,
   "tz": "Europe/Paris"
  },
  {
   "name": "보르도",
   "lat": 44.84124,
   "lon": -0.58046,
   "tz": "Europe/Paris"
  }
 ],
 "DE": [
  {
   "name": "베를린",
   "lat": 52.52437,
   "lon": 13.41053,
   "tz": "Europe/Berlin"
  },
  {
   "name": "뮌헨",
   "lat": 48.13743,
   "lon": 11.57549,
   "tz": "Europe/Berlin"
  },
  {
   "name": "프랑크푸르트",
   "lat": 50.11552,
   "lon": 8.68417,
   "tz": "Europe/Berlin"
  },
  {
   "name": "함부르크",
   "lat": 53.55073,
   "lon": 9.99302,
   "tz": "Europe/Berlin"
  },
  {
   "name": "드레스덴",
   "lat": 51.05089,
   "lon": 13.73832,
   "tz": "Europe/Berlin"
  }
 ],
 "IT": [
  {
   "name": "로마",
   "lat": 41.89193,
   "lon": 12.51133,
   "tz": "Europe/Rome"
  },
  {
   "name": "베니스",
   "lat": 45.43713,
   "lon": 12.33265,
   "tz": "Europe/Rome"
  },
  {
   "name": "피렌체",
   "lat": 43.77925,
   "lon": 11.24626,
   "tz": "Europe/Rome"
  },
  {
   "name": "밀라노",
   "lat": 45.46427,
   "lon": 9.18951,
   "tz": "Europe/Rome"
  },
  {
   "name": "나폴리",
   "lat": 40.85216,
   "lon": 14.26811,
   "tz": "Europe/Rome"
  },
  {
   "name": "볼로냐",
   "lat": 44.49381,
   "lon": 11.33875,
   "tz": "Europe/Rome"
  }
 ],
 "ES": [
  {
   "name": "바르셀로나",
   "lat": 41.38879,
   "lon": 2.15899,
   "tz": "Europe/Madrid"
  },
  {
   "name": "마드리드",
   "lat": 40.4165,
   "lon": -3.70256,
   "tz": "Europe/Madrid"
  },
  {
   "name": "그라나다",
   "lat": 37.18817,
   "lon": -3.60667,
   "tz": "Europe/Madrid"
  },
  {
   "name": "발렌시아",
   "lat": 39.47391,
   "lon": -0.37966,
   "tz": "Europe/Madrid"
  },
  {
   "name": "말라가",
   "lat": 36.72016,
   "lon": -4.42034,
   "tz": "Europe/Madrid"
  }
 ],
 "PT": [
  {
   "name": "리스본",
   "lat": 38.72509,
   "lon": -9.1498,
   "tz": "Europe/Lisbon"
  },
  {
   "name": "Porto",
   "lat": 41.1485,
   "lon": -8.61097,
   "tz": "Europe/Lisbon"
  }
 ],
 "NL": [
  {
   "name": "Amsŭt'erŭdam",
   "lat": 52.37403,
   "lon": 4.88969,
   "tz": "Europe/Amsterdam"
  },
  {
   "name": "로테르담",
   "lat": 51.9225,
   "lon": 4.47917,
   "tz": "Europe/Amsterdam"
  },
  {
   "name": "위트레흐트",
   "lat": 52.09083,
   "lon": 5.12222,
   "tz": "Europe/Amsterdam"
  }
 ],
 "BE": [
  {
   "name": "브뤼셀",
   "lat": 50.85045,
   "lon": 4.34878,
   "tz": "Europe/Brussels"
  },
  {
   "name": "안트베르펜",
   "lat": 51.22047,
   "lon": 4.40026,
   "tz": "Europe/Brussels"
  }
 ],
 "AT": [
  {
   "name": "빈",
   "lat": 48.20849,
   "lon": 16.37208,
   "tz": "Europe/Vienna"
  },
  {
   "name": "잘츠부르크",
   "lat": 47.79941,
   "lon": 13.04399,
   "tz": "Europe/Vienna"
  },
  {
   "name": "인스브루크",
   "lat": 47.26266,
   "lon": 11.39454,
   "tz": "Europe/Vienna"
  },
  {
   "name": "할슈타트",
   "lat": 47.56231,
   "lon": 13.64912,
   "tz": "Europe/Vienna"
  }
 ],
 "CH": [
  {
   "name": "취리히",
   "lat": 47.36667,
   "lon": 8.55,
   "tz": "Europe/Zurich"
  },
  {
   "name": "인터라켄",
   "lat": 46.68387,
   "lon": 7.86638,
   "tz": "Europe/Zurich"
  },
  {
   "name": "체르마트",
   "lat": 46.01998,
   "lon": 7.74863,
   "tz": "Europe/Zurich"
  }
 ],
 "CZ": [
  {
   "name": "프라하",
   "lat": 50.08804,
   "lon": 14.42076,
   "tz": "Europe/Prague"
  },
  {
   "name": "체스키크룸로프",
   "lat": 48.81091,
   "lon": 14.31521,
   "tz": "Europe/Prague"
  }
 ],
 "HU": [
  {
   "name": "부다페스트",
   "lat": 47.49835,
   "lon": 19.04045,
   "tz": "Europe/Budapest"
  }
 ],
 "PL": [
  {
   "name": "바르샤바",
   "lat": 52.22977,
   "lon": 21.01178,
   "tz": "Europe/Warsaw"
  },
  {
   "name": "크라쿠프",
   "lat": 50.06143,
   "lon": 19.93658,
   "tz": "Europe/Warsaw"
  }
 ],
 "GR": [
  {
   "name": "아테네",
   "lat": 37.98376,
   "lon": 23.72784,
   "tz": "Europe/Athens"
  },
  {
   "name": "Santorini Island",
   "lat": 36.40572,
   "lon": 25.45682,
   "tz": "Europe/Athens"
  },
  {
   "name": "Mykonos",
   "lat": 37.44931,
   "lon": 25.38075,
   "tz": "Europe/Athens"
  }
 ],
 "HR": [
  {
   "name": "자그레브",
   "lat": 45.81444,
   "lon": 15.97798,
   "tz": "Europe/Zagreb"
  },
  {
   "name": "Dubrovnik",
   "lat": 42.64125,
   "lon": 18.10909,
   "tz": "Europe/Zagreb"
  },
  {
   "name": "스플리트",
   "lat": 43.50891,
   "lon": 16.43915,
   "tz": "Europe/Zagreb"
  }
 ],
 "IE": [
  {
   "name": "더블린",
   "lat": 53.33306,
   "lon": -6.24889,
   "tz": "Europe/Dublin"
  }
 ],
 "FI": [
  {
   "name": "헬싱키",
   "lat": 60.16952,
   "lon": 24.93545,
   "tz": "Europe/Helsinki"
  },
  {
   "name": "로바니에미",
   "lat": 66.49897,
   "lon": 25.68867,
   "tz": "Europe/Helsinki"
  }
 ],
 "SE": [
  {
   "name": "스톡홀름",
   "lat": 59.32938,
   "lon": 18.06871,
   "tz": "Europe/Stockholm"
  }
 ],
 "NO": [
  {
   "name": "오슬로",
   "lat": 59.91273,
   "lon": 10.74609,
   "tz": "Europe/Oslo"
  },
  {
   "name": "베르겐",
   "lat": 60.39299,
   "lon": 5.32415,
   "tz": "Europe/Oslo"
  },
  {
   "name": "Romssasuolu",
   "lat": 69.66761,
   "lon": 18.9258,
   "tz": "Europe/Oslo"
  }
 ],
 "DK": [
  {
   "name": "코펜하겐",
   "lat": 55.67594,
   "lon": 12.56553,
   "tz": "Europe/Copenhagen"
  }
 ],
 "IS": [
  {
   "name": "레이캬비크",
   "lat": 64.13548,
   "lon": -21.89541,
   "tz": "Atlantic/Reykjavik"
  }
 ],
 "TR": [
  {
   "name": "이스탄불",
   "lat": 41.01384,
   "lon": 28.94966,
   "tz": "Europe/Istanbul"
  },
  {
   "name": "안탈리아",
   "lat": 36.90812,
   "lon": 30.69556,
   "tz": "Europe/Istanbul"
  }
 ],
 "RU": [
  {
   "name": "모스크바",
   "lat": 55.75204,
   "lon": 37.61781,
   "tz": "Europe/Moscow"
  },
  {
   "name": "상트페테르부르크",
   "lat": 59.93863,
   "lon": 30.31413,
   "tz": "Europe/Moscow"
  },
  {
   "name": "블라디보스토크",
   "lat": 43.10562,
   "lon": 131.87354,
   "tz": "Asia/Vladivostok"
  }
 ],
 "AE": [
  {
   "name": "두바이",
   "lat": 25.07725,
   "lon": 55.30927,
   "tz": "Asia/Dubai"
  },
  {
   "name": "아부다비",
   "lat": 24.45118,
   "lon": 54.39696,
   "tz": "Asia/Dubai"
  }
 ],
 "SA": [
  {
   "name": "리야드",
   "lat": 24.68773,
   "lon": 46.72185,
   "tz": "Asia/Riyadh"
  },
  {
   "name": "제다",
   "lat": 21.49012,
   "lon": 39.18624,
   "tz": "Asia/Riyadh"
  }
 ],
 "QA": [
  {
   "name": "도하",
   "lat": 25.28545,
   "lon": 51.53096,
   "tz": "Asia/Qatar"
  }
 ],
 "IL": [
  {
   "name": "예루살렘",
   "lat": 31.76904,
   "lon": 35.21633,
   "tz": "Asia/Jerusalem"
  },
  {
   "name": "텔아비브",
   "lat": 32.08088,
   "lon": 34.78057,
   "tz": "Asia/Jerusalem"
  }
 ],
 "JO": [
  {
   "name": "암만",
   "lat": 31.95522,
   "lon": 35.94503,
   "tz": "Asia/Amman"
  }
 ],
 "EG": [
  {
   "name": "카이로",
   "lat": 30.06263,
   "lon": 31.24967,
   "tz": "Africa/Cairo"
  },
  {
   "name": "룩소르",
   "lat": 25.69893,
   "lon": 32.6421,
   "tz": "Africa/Cairo"
  }
 ],
 "MA": [
  {
   "name": "Marrakesh",
   "lat": 31.63416,
   "lon": -7.99994,
   "tz": "Africa/Casablanca"
  },
  {
   "name": "카사블랑카",
   "lat": 33.58831,
   "lon": -7.61138,
   "tz": "Africa/Casablanca"
  },
  {
   "name": "Fes",
   "lat": 34.03313,
   "lon": -5.00028,
   "tz": "Africa/Casablanca"
  }
 ],
 "ZA": [
  {
   "name": "케이프타운",
   "lat": -33.92584,
   "lon": 18.42322,
   "tz": "Africa/Johannesburg"
  },
  {
   "name": "요하네스버그",
   "lat": -26.20227,
   "lon": 28.04363,
   "tz": "Africa/Johannesburg"
  }
 ],
 "KE": [
  {
   "name": "나이로비",
   "lat": -1.28333,
   "lon": 36.81667,
   "tz": "Africa/Nairobi"
  }
 ],
 "AU": [
  {
   "name": "시드니",
   "lat": -33.86785,
   "lon": 151.20732,
   "tz": "Australia/Sydney"
  },
  {
   "name": "멜버른",
   "lat": -37.814,
   "lon": 144.96332,
   "tz": "Australia/Melbourne"
  },
  {
   "name": "브리즈번",
   "lat": -27.46794,
   "lon": 153.02809,
   "tz": "Australia/Brisbane"
  },
  {
   "name": "Gold Coast",
   "lat": -28.00029,
   "lon": 153.43088,
   "tz": "Australia/Brisbane"
  },
  {
   "name": "퍼스",
   "lat": -31.95224,
   "lon": 115.8614,
   "tz": "Australia/Perth"
  },
  {
   "name": "케언스",
   "lat": -16.92366,
   "lon": 145.76613,
   "tz": "Australia/Brisbane"
  }
 ],
 "NZ": [
  {
   "name": "오클랜드",
   "lat": -36.84853,
   "lon": 174.76349,
   "tz": "Pacific/Auckland"
  },
  {
   "name": "퀸스타운",
   "lat": -45.03023,
   "lon": 168.6627,
   "tz": "Pacific/Auckland"
  },
  {
   "name": "크라이스트처치",
   "lat": -43.53333,
   "lon": 172.63333,
   "tz": "Pacific/Auckland"
  },
  {
   "name": "웰링턴",
   "lat": -41.28664,
   "lon": 174.77557,
   "tz": "Pacific/Auckland"
  }
 ],
 "FJ": [
  {
   "name": "나디",
   "lat": -17.80309,
   "lon": 177.41617,
   "tz": "Pacific/Fiji"
  },
  {
   "name": "수바",
   "lat": -18.13683,
   "lon": 178.42531,
   "tz": "Pacific/Fiji"
  }
 ],
 "GU": [
  {
   "name": "하갓냐",
   "lat": 13.47567,
   "lon": 144.74886,
   "tz": "Pacific/Guam"
  },
  {
   "name": "타무닝",
   "lat": 13.48754,
   "lon": 144.78143,
   "tz": "Pacific/Guam"
  }
 ]
};
