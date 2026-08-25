// Icons/descriptions for a starter KSL vocabulary -- purely a display/onboarding aid (the
// vocabulary guide, and metadata for a recognized word if it happens to match one of these
// names). Recognition itself is DTW-only now: every word, including these, has to actually be
// recorded by the signer via the "고급: 나만의 수어 단어 등록" flow before it's recognized.
export const KSL_WORD_METADATA: Record<string, { icon: string; description: string }> = {
	오늘: { icon: "📅", description: "양손을 가슴 앞에서 아래로 가볍게 내리는 수어" },
	날씨: { icon: "☀️", description: "손을 펴서 뺨이나 가슴 쪽에서 흔드는 수어" },
	좋다: { icon: "👍", description: "엄지손가락을 세워 긍정과 만족을 나타내는 수어" },
	맛있다: { icon: "😋", description: "손끝을 뺨이나 턱에 대고 톡톡 치는 수어" },
	식사: { icon: "🍚", description: "손을 모아 입 쪽으로 가져가는 식사 수어" },
	감사: { icon: "🙏", description: "왼손 등 위에 오른손을 얹어 톡톡 두드리는 수어" },
	안녕: { icon: "👋", description: "손과 팔을 들어 반갑게 인사하는 수어" },
	소개: { icon: "💁‍♂️", description: "손바닥을 위로 하여 부드럽게 펼치는 수어" },
	나: { icon: "🙋", description: "검지손가락으로 자신의 가슴 중앙을 가리키는 수어" },
	만나다: { icon: "👥", description: "양손을 가슴 중앙으로 모아 마주보는 수어" },
	반갑다: { icon: "😊", description: "양 손바닥으로 가슴을 가볍게 쓸어내리는 수어" },
};
