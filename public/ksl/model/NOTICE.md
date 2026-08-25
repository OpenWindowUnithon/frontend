# 모델 출처

`model.json` / weight shard는 [legatalee/Korean-Sign-Language-Translation](https://github.com/legatalee/Korean-Sign-Language-Translation)의
`Recognition/model1/my_model.h5`(MIT License, Copyright (c) 2025 Jimin Lee)를
`tensorflowjs_converter`로 TF.js Layers 포맷으로 변환한 결과물이다.

- 원본 저장소: https://github.com/legatalee/Korean-Sign-Language-Translation
- 라이선스: MIT
- 입력 shape: `(30, 150)` — pose 6개 landmark(x,y,z,visibility) + 양손 각 21개 landmark(x,y,z)
- 출력: 12 클래스 (0=no-action, 1~11=오늘/날씨/좋다/맛있다/식사/감사/안녕/소개/나/만나다/반갑다)
- 변환 명령: `tensorflowjs_converter --input_format=keras my_model.h5 <out>`

라벨 index 매핑은 `Recognition/model1/MP_Data/<라벨>/`의 실제 landmark 샘플을 원본
h5 모델에 넣어 재검증했다 (`../fixtures/siksa.json` 참고).
