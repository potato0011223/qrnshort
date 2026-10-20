# 과제 2 — QRnShort

교안 5주차 URL2QR과 6주차 QRnShort의 연결 구조를 반영한 정적 웹사이트입니다. 프레임워크·빌드·API 키 설치 없이 배포합니다.

## 주요 파일
- index.html: QR코드 / URL단축 선택 메인 화면
- url2qr/index.html: URL·텍스트·Wi-Fi·명함 QR 생성, PNG/JPG 저장, 이미지 복사, 스캔
- urlShort/index.html: URL 입력 → OpenAPI 단축 → 읽기 전용 결과 → 복사·QR 생성 연결
- common.js: HTTP URL 검증, 외부 단축 요청, 테마, 저장·백업 검증
- app.js: 두 기능 화면의 이벤트 처리, QR 인코딩·보관함·스캐너
- style.css, improvements.css: 기존 테마 및 독립 화면·반응형 보완
- assets/ 및 url2qr/*.min.js: 이미지와 내장 라이브러리

## API 동작
기본 URL 단축은 https://da.gd/s?url=... 에 fetch로 요청합니다. 실제 단축 주소만 결과로 표시합니다.
맞춤 코드를 입력하면 is.gd 공식 JSONP API를 사용합니다. 규칙은 영문·숫자·밑줄 5~30자이며 서비스 전체에서 중복될 수 있습니다.
원본 주소는 URLSearchParams로 한 번만 인코딩하며, 읽은 값을 다시 디코딩하지 않습니다.
기본 단축 서비스: https://da.gd/ / 공식 소스: https://github.com/dagd/dagd
맞춤 단축 문서: https://is.gd/apishorteningreference.php

외부 API의 장애·할당량·네트워크 차단에 따라 단축 생성이 실패할 수 있습니다. 이 경우 긴 주소를 단축 주소처럼 표시하지 않습니다.
2026-10-20 점검에서는 da.gd 발급과 원본으로의 리디렉션을 확인했습니다. is.gd는 일시적 서버 오류 후 다른 요청에서는 정상 응답하여, 기본값은 da.gd로 정했습니다.

## 저장 및 스캔
보관함·테마는 브라우저 로컬 저장소를 사용합니다. 전 세계 클릭 통계나 자동 동기화 기능은 제공하지 않습니다.
기록을 삭제해도 외부 서비스가 발급한 단축 주소는 폐기되지 않습니다. JSON 백업으로 기록을 다른 브라우저에 옮길 수 있습니다.
카메라는 HTTPS(GitHub Pages) 또는 localhost에서 사용하고 권한을 허용해야 합니다. 이미지 파일 스캔도 가능합니다.
Wi-Fi 비밀번호의 공백과 예약 문자를 보존합니다. 로고 선택 시 복원력 H를 적용합니다. 너무 긴 데이터는 크기를 늘리거나 내용을 줄여야 합니다.

## 실행·배포
로컬: 이 폴더에서 python -m http.server 8000 → http://localhost:8000/
배포: 이 폴더의 내용물을 GitHub 저장소 최상위에 올립니다. url2qr, urlShort, assets 폴더와 common.js/app.js/CSS를 모두 포함하세요.
Settings → Pages → Deploy from a branch → main / (root) → Save.
생성된 /저장소명/ 주소에서 메인·QR·단축 화면을 각각 확인하세요.

## 내장 라이브러리
QRCode.js (davidshimjs, MIT) / jsQR (cozmo, Apache-2.0).
QRCode.js 바이트 인코더의 혼합 한글·ASCII 처리 문제를 TextEncoder UTF-8 방식으로 수정했습니다.
원본: https://github.com/davidshimjs/qrcodejs / https://github.com/cozmo/jsQR
