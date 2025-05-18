# 구현 사항
1. Get, Post, Put, Delete 4가지 RestAPI 함수 구현

2. 백엔드에서 이미지 프로세싱 및 OCR 진행
- 백엔드로 이미지를 전송
- 백엔드에선 이미지를 프로세싱
- 프로세싱한 이미지를  OCR
- 프론트 엔드에 전달 (날짜와 총 금액만)
> 아직 엉성하게 구현되어 있어 최적화 및 재설계 필요

3. 백엔드에서 감정 점수 분석
- 백엔드로 사용자가 입력한 텍스트 전송
- 해당 텍스트의 감정 점수를 계산
- 감정 점수를 프론트엔드에 전달
> 감정에 따른 문구 출력은 아직 방법을 찾지 못함

# 필요 파일
## sever측의 npm 다운 리스트
- canvas
- cors
- express
- jsdom
- tesseract.js

server@1.0.0
├── canvas@3.1.0
├── cors@2.8.5
├── express@5.1.0
├── jsdom@26.1.0
└── tesseract.js@6.0.1

## server에 존재해야 하는 파일
- opencv.js : 이미지 프로세싱을 위해 필요
- analyze.py : 감정 분석을 위해 필요

## 감정 분석을 위한 필요 python 모듈
- `pip install transformers torch`

# 구동 방법
- server에서 node.js 실행
 - `node app.js`