import { Link } from "@tanstack/react-router";
import {
	Accessibility,
	ArrowLeftRight,
	ArrowRight,
	Briefcase,
	Building2,
	Captions,
	ExternalLink,
	Hand,
	Hospital,
	Landmark,
	Languages,
	MessageSquareText,
	Mic,
	Radio,
	ShieldCheck,
	ShoppingBag,
	Sparkles,
	Wallet,
} from "lucide-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Badge, Card } from "@/shared/ui";

const GITHUB_URL = "https://github.com/OpenWindowUnithon";

const ctaVariants = {
	primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-ring",
	outline:
		"border border-border text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring",
} as const;

const ctaSizes = {
	sm: "px-4 py-2 text-sm",
	md: "px-5 py-2.5 text-sm",
} as const;

function CtaLink({
	to,
	variant = "primary",
	size = "md",
	className,
	children,
}: {
	to: string;
	variant?: keyof typeof ctaVariants;
	size?: keyof typeof ctaSizes;
	className?: string;
	children: ReactNode;
}) {
	return (
		<Link
			to={to}
			className={cn(
				"inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
				ctaVariants[variant],
				ctaSizes[size],
				className,
			)}
		>
			{children}
		</Link>
	);
}

function CtaAnchor({
	variant = "primary",
	size = "md",
	className,
	children,
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
	variant?: keyof typeof ctaVariants;
	size?: keyof typeof ctaSizes;
}) {
	return (
		<a
			className={cn(
				"inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
				ctaVariants[variant],
				ctaSizes[size],
				className,
			)}
			{...props}
		>
			{children}
		</a>
	);
}

const IMPACT_STATS = [
	{ value: "425,224명", label: "등록 청각장애인" },
	{ value: "510,889건", label: "연간 발신 중계" },
	{ value: "약 40명", label: "통신중계사(수어통역사)" },
	{ value: "약 1.28만 건", label: "중계사 1인당 연간 발신 중계" },
] as const;

const NEEDS = [
	{ icon: Hospital, label: "병원 예약·상담" },
	{ icon: Landmark, label: "관공서 민원" },
	{ icon: Wallet, label: "금융업무" },
	{ icon: Briefcase, label: "구직·업무 연락" },
	{ icon: ShoppingBag, label: "주문·예약" },
] as const;

const FLOW_STEPS = [
	{
		icon: MessageSquareText,
		title: "입력 통합",
		desc: "텍스트·음성·수어 중 편한 방식으로 통화 내용을 입력하면 하나의 텍스트 흐름으로 통합",
	},
	{
		icon: Sparkles,
		title: "AI 대화 처리",
		desc: "대화 맥락을 유지하며 상대방에게 전달할 응답을 생성",
	},
	{
		icon: Mic,
		title: "음성 변환 (TTS)",
		desc: "생성된 응답을 자연스러운 음성으로 바꿔 통화 상대방에게 전달",
	},
	{
		icon: Captions,
		title: "실시간 자막 (STT)",
		desc: "상대방의 음성을 실시간 텍스트로 변환해 사용자 화면에 표시",
	},
] as const;

const FEATURES = [
	{
		icon: ArrowLeftRight,
		title: "실시간 TTS·STT 양방향 중계",
		desc: "사용자의 의사는 음성으로, 상대방의 음성은 자막으로 — 끊김 없이 오가는 양방향 통화",
	},
	{
		icon: Languages,
		title: "멀티모달 입출력 통합",
		desc: "문자·음성·수어 중 사용자가 편한 입력 방식을 선택해도 동일한 대화 처리 흐름으로 연결",
	},
	{
		icon: Hand,
		title: "자체 LSTM 수어 인식",
		desc: "손 형태와 움직임의 시계열 특성을 학습한 자체 모델로 연속 수어 동작을 텍스트로 변환",
	},
	{
		icon: ShieldCheck,
		title: "Human Fallback",
		desc: "비정형·고위험·예외 상황은 즉시 통신중계사에게 전환해 안전하게 처리",
	},
] as const;

const COMPARISON_COLUMNS = ["손말이음센터", "소보로", "나루"] as const;

const COMPARISON = [
	{
		label: "핵심 목적",
		values: ["전화 통신중계", "실시간 의사소통 보조", "전화 통신중계 자동화"],
	},
	{
		label: "주요 방식",
		values: [
			"문자·수어 ↔ 사람 중계사 ↔ 음성",
			"음성 → 자막 / 문자 → 음성",
			"문자·음성·수어 → AI 음성 / 상대방 음성 → 자막",
		],
	},
	{
		label: "중계 주체·범위",
		values: [
			"통신중계사가 범용 전화 중계",
			"AI 기반 대면·교육·업무 소통 보조",
			"정형 전화 → AI Agent / 비정형·범용 전화 → 통신중계사",
		],
	},
	{
		label: "핵심 한계",
		values: [
			"사람 중계 의존 → 인력·대기 제약",
			"전화 상대방을 직접 연결하는 범용 중계가 핵심은 아님",
			"초기에는 정형 전화 중심 / 수어·전화망 고도화 필요",
		],
	},
] as const;

const BUSINESS_STEPS = [
	{
		phase: "사전 검증",
		desc: "손말이음센터 대상 MVP 시연, 전화망·보안·운영 요건 확인",
	},
	{
		phase: "유료 PoC",
		desc: "4주간 정형 통화 실증, 300~500만원 · 업무완료율·개입률 검증",
	},
	{
		phase: "정식 계약",
		desc: "연 플랫폼 이용료 2,000만원 + 통화당 1,200원, 접근성 기관으로 확대",
	},
] as const;

const ROADMAP = [
	{
		period: "2026.09 – 2026.12",
		title: "MVP 고도화 및 전화망 연동",
		desc: "실제 전화망 발신 연동, 업무별 Agent 구축, PSTN/SIP 연동",
	},
	{
		period: "2026.09 – 2027.02",
		title: "기관 DB 및 수어 모델 고도화",
		desc: "기관 전화번호·업무 데이터베이스 구축, 수어 인식 정확도 개선",
	},
	{
		period: "2027.01 – 2027.03",
		title: "손말이음센터 PoC",
		desc: "300~500콜 규모 실증, 완료율·사람 개입률·오류 복구율 검증",
	},
	{
		period: "2027.04 – 2028.06",
		title: "정식 계약 및 도입기관 확대",
		desc: "첫 B2B 연간계약 체결, 병원·공공기관·복지기관으로 확장",
	},
] as const;

const TEAM = [
	{ name: "정제훈", role: "대표 · 제품 기획·사업 총괄", dept: "글로벌미디어학부" },
	{ name: "금민우", role: "사업 PM · 시장분석·사업화 전략", dept: "산업정보시스템공학과" },
	{ name: "홍준우", role: "개발리드 · 프론트엔드·실시간 통신", dept: "글로벌미디어학부" },
	{ name: "이서희", role: "AI Engineer · 수어 인식 모델", dept: "컴퓨터학부" },
	{ name: "김예원", role: "BE Engineer · 백엔드", dept: "컴퓨터학부" },
] as const;

function SectionHeading({
	eyebrow,
	title,
	desc,
}: {
	eyebrow: string;
	title: ReactNode;
	desc?: string;
}) {
	return (
		<div className="mx-auto max-w-2xl text-center">
			<p className="text-sm font-semibold tracking-wide text-primary">{eyebrow}</p>
			<h2 className="mt-2 text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
				{title}
			</h2>
			{desc && <p className="mt-3 text-pretty text-muted-foreground">{desc}</p>}
		</div>
	);
}

function Section({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<section className={cn("mx-auto max-w-5xl px-6 py-16 sm:py-20", className)}>{children}</section>
	);
}

function HeroMock() {
	return (
		<div className="relative mx-auto w-full max-w-sm">
			<div className="absolute inset-x-6 top-8 -z-10 h-[90%] rounded-[2.5rem] bg-primary/10 blur-2xl" />
			<div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl ring-1 ring-foreground/5">
				<div className="flex items-center justify-between border-b border-border px-5 py-3">
					<span className="text-xs font-medium text-muted-foreground">010 1234 5678</span>
					<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-naru-connect">
						<span className="size-1.5 rounded-full bg-naru-connect" />
						연결됨
					</span>
				</div>
				<div className="flex flex-col gap-2.5 px-5 py-5">
					<div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm">
						안녕하세요, 유니톤 지점입니다. 무엇을 도와드릴까요?
					</div>
					<div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
						안녕하세요, 오늘 오후 2시 예약 되나요?
					</div>
					<div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm">
						네, 가능하세요. 성함이 어떻게 되세요?
					</div>
				</div>
				<div className="flex items-center gap-2 border-t border-border px-5 py-4">
					<div className="h-9 flex-1 rounded-full bg-muted" />
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
						<ArrowRight className="size-4" />
					</div>
				</div>
			</div>
		</div>
	);
}

export function LandingPage() {
	return (
		<div className="min-h-dvh bg-background text-foreground">
			<header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
					<span className="font-heading text-lg font-extrabold tracking-tight text-primary">
						나루
					</span>
					<nav className="flex items-center gap-2">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							className="hidden items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
						>
							GitHub
							<ExternalLink className="size-3.5" />
						</a>
						<CtaLink to="/" size="sm">
							체험하기
						</CtaLink>
					</nav>
				</div>
			</header>

			{/* Hero */}
			<Section className="grid items-center gap-12 py-20 sm:py-28 md:grid-cols-2">
				<div>
					<Badge variant="secondary" className="gap-1.5">
						<Sparkles className="size-3.5" />
						AI · 머신러닝 · 전화 접근성
					</Badge>
					<h1 className="mt-5 text-balance font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
						수어통역사를 지키는
						<br />
						AI, <span className="text-primary">나루</span>
					</h1>
					<p className="mt-5 text-pretty text-lg text-muted-foreground">
						청각·언어장애인의 문자·음성·수어를 상대방에게 음성으로 전달하고, 상대방의 음성을 실시간
						자막으로 바꾸는 AI 전화 중계 서비스. 반복적인 중계는 AI가, 예외 상황은 사람이 맡습니다.
					</p>
					<div className="mt-8 flex flex-wrap items-center gap-3">
						<CtaLink to="/">
							지금 전화 체험하기
							<ArrowRight className="size-4" />
						</CtaLink>
						<CtaAnchor variant="outline" href={GITHUB_URL} target="_blank" rel="noreferrer">
							GitHub 저장소
							<ExternalLink className="size-4" />
						</CtaAnchor>
					</div>
				</div>
				<HeroMock />
			</Section>

			{/* Problem stats */}
			<Section className="border-t border-border">
				<SectionHeading
					eyebrow="배경 및 필요성"
					title="약 40명의 통신중계사가 연간 40만 건 이상을 중계합니다"
					desc="정형화된 통화까지 사람이 24시간 교대로 처리하는 인력 의존적 구조 — 최근 실시간 Voice AI 기술로 반복 업무를 줄일 수 있는 환경이 만들어졌습니다."
				/>
				<div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
					{IMPACT_STATS.map((stat) => (
						<Card key={stat.label} className="items-center gap-1 py-6 text-center">
							<p className="font-heading text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
								{stat.value}
							</p>
							<p className="px-2 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
						</Card>
					))}
				</div>
				<p className="mt-4 text-center text-xs text-muted-foreground">
					출처: 김나정, 「손말이음센터 운영실태와 개선과제」, 국회입법조사처 NARS 현장실태조사
					제7호, 2023.
				</p>

				<div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-5">
					{NEEDS.map(({ icon: Icon, label }) => (
						<div
							key={label}
							className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-5 text-center"
						>
							<div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
								<Icon className="size-5" />
							</div>
							<span className="text-sm font-medium">{label}</span>
						</div>
					))}
				</div>
				<p className="mt-4 text-center text-sm text-muted-foreground">
					말을 하기 어렵거나 듣기 어려운 청각·언어장애인도 비장애인과 통화하려면 여전히 수어통역사를
					통한 중계가 필요합니다.
				</p>
			</Section>

			{/* Before / After */}
			<Section className="border-t border-border">
				<SectionHeading
					eyebrow="나루 도입 전후"
					title="사람이 모든 통화를 떠맡는 구조에서, AI가 먼저 받는 구조로"
					desc="※ 아래 비교는 도입 목표를 보여주는 개념도이며, 실제 효과는 기관 PoC를 통해 검증할 예정입니다."
				/>
				<div className="mt-10 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
					<Card className="gap-4 border-2 border-dashed border-border bg-muted/40 p-6">
						<p className="text-xs font-semibold text-muted-foreground">BEFORE — 도입 전</p>
						<ul className="space-y-3 text-sm">
							<li>모든 통화를 통신중계사가 1:1로 직접 중계</li>
							<li>약 40명이 24시간 365일 교대, 연간 40만 건 이상 처리</li>
							<li>정형 문의도 대기시간 발생, 야간·감정노동 누적</li>
						</ul>
					</Card>
					<div className="flex justify-center text-muted-foreground">
						<div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
							<ArrowRight className="size-5" />
						</div>
					</div>
					<Card className="gap-4 border-2 border-primary/30 bg-accent/40 p-6">
						<p className="text-xs font-semibold text-primary">AFTER — 나루 도입 후</p>
						<ul className="space-y-3 text-sm">
							<li>정형·반복 통화는 AI Agent가 우선 처리</li>
							<li>통신중계사는 비정형·고위험 상황(Human Fallback)에 집중</li>
							<li>대기시간 감소, 중계사의 신체·감정적 부담 완화</li>
						</ul>
					</Card>
				</div>
			</Section>

			{/* How it works */}
			<Section className="border-t border-border">
				<SectionHeading
					eyebrow="작동 방식"
					title="멀티모달 입력을 하나의 대화 흐름으로"
					desc="텍스트·음성·수어 입력을 통합해 상대방에게 음성으로 전달하고, 상대방의 음성은 실시간 자막으로 돌려받는 양방향 중계입니다."
				/>
				<div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{FLOW_STEPS.map(({ icon: Icon, title, desc }, i) => (
						<div key={title} className="relative">
							<Card className="h-full gap-3 p-5">
								<div className="flex items-center gap-3">
									<div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
										<Icon className="size-4.5" />
									</div>
									<span className="text-xs font-semibold text-muted-foreground">STEP {i + 1}</span>
								</div>
								<p className="font-semibold">{title}</p>
								<p className="text-sm text-muted-foreground">{desc}</p>
							</Card>
							{i < FLOW_STEPS.length - 1 && (
								<ArrowRight className="absolute top-1/2 -right-2.5 hidden size-4 -translate-y-1/2 text-muted-foreground lg:block" />
							)}
						</div>
					))}
				</div>
			</Section>

			{/* Features */}
			<Section className="border-t border-border">
				<SectionHeading eyebrow="핵심 기능" title="정형 업무는 AI에게, 예외는 사람에게" />
				<div className="mt-10 grid gap-4 sm:grid-cols-2">
					{FEATURES.map(({ icon: Icon, title, desc }) => (
						<Card key={title} className="flex-row items-start gap-4 p-5">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
								<Icon className="size-5" />
							</div>
							<div>
								<p className="font-semibold">{title}</p>
								<p className="mt-1 text-sm text-muted-foreground">{desc}</p>
							</div>
						</Card>
					))}
				</div>
			</Section>

			{/* Comparison */}
			<Section className="border-t border-border">
				<SectionHeading eyebrow="국내 서비스 비교" title="나루는 무엇이 다른가요" />
				<div className="mt-10 overflow-x-auto rounded-2xl border border-border">
					<table className="w-full min-w-[640px] border-collapse text-sm">
						<thead>
							<tr className="bg-muted/60 text-left">
								<th className="w-32 px-4 py-3 font-semibold">구분</th>
								<th className="px-4 py-3 font-semibold">손말이음센터</th>
								<th className="px-4 py-3 font-semibold">소보로</th>
								<th className="px-4 py-3 font-semibold text-primary">나루</th>
							</tr>
						</thead>
						<tbody>
							{COMPARISON.map((row, idx) => (
								<tr key={row.label} className={idx % 2 === 1 ? "bg-muted/20" : undefined}>
									<td className="border-t border-border px-4 py-3 font-medium">{row.label}</td>
									{row.values.map((value, i) => (
										<td
											key={COMPARISON_COLUMNS[i]}
											className={cn(
												"border-t border-border px-4 py-3 align-top text-muted-foreground",
												i === 2 && "font-medium text-foreground",
											)}
										>
											{value}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Section>

			{/* Business model */}
			<Section className="border-t border-border">
				<SectionHeading
					eyebrow="사업화 전략"
					title="손말이음센터를 시작으로 한 B2B·B2G 확장"
					desc="최종 사용자인 청각·언어장애인은 무료로 이용하고, 접근성 운영기관에 플랫폼 이용료와 사용량 기반 과금을 적용합니다."
				/>
				<div className="mt-10 grid gap-4 sm:grid-cols-3">
					{BUSINESS_STEPS.map((step, i) => (
						<Card key={step.phase} className="gap-3 p-5">
							<span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
								{i + 1}
							</span>
							<p className="font-semibold">{step.phase}</p>
							<p className="text-sm text-muted-foreground">{step.desc}</p>
						</Card>
					))}
				</div>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
					<Building2 className="size-4" />
					<span>병원 · 공공기관 · 지자체 · 복지기관 → 금융기관 · 대규모 고객센터로 확대</span>
				</div>
			</Section>

			{/* Roadmap */}
			<Section className="border-t border-border">
				<SectionHeading eyebrow="사업 추진 일정" title="2026.09 – 2028.06 로드맵" />
				<div className="mt-10 space-y-4">
					{ROADMAP.map((item) => (
						<div
							key={item.title}
							className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:gap-6"
						>
							<span className="shrink-0 text-sm font-semibold text-primary sm:w-40">
								{item.period}
							</span>
							<div>
								<p className="font-semibold">{item.title}</p>
								<p className="mt-0.5 text-sm text-muted-foreground">{item.desc}</p>
							</div>
						</div>
					))}
				</div>
			</Section>

			{/* Team */}
			<Section className="border-t border-border">
				<SectionHeading eyebrow="팀 열린창문" title="나루를 만드는 사람들" />
				<div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{TEAM.map((member) => (
						<Card key={member.name} className="items-center gap-2 p-5 text-center">
							<div className="flex size-14 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-bold text-primary">
								{member.name.slice(0, 1)}
							</div>
							<p className="font-semibold">{member.name}</p>
							<p className="text-xs text-muted-foreground">{member.dept}</p>
							<p className="mt-1 text-sm text-foreground/80">{member.role}</p>
						</Card>
					))}
				</div>
			</Section>

			{/* CTA */}
			<Section className="border-t border-border">
				<Card className="items-center gap-4 p-10 text-center sm:p-14">
					<Accessibility className="size-9 text-primary" />
					<h2 className="text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
						장애 여부와 관계없이, 누구나 전화할 수 있는 세상
					</h2>
					<p className="max-w-lg text-pretty text-muted-foreground">
						나루의 MVP는 두 기기 간 실시간 통신으로 핵심 중계 흐름을 구현했습니다. 지금
						체험해보세요.
					</p>
					<div className="mt-2 flex flex-wrap items-center justify-center gap-3">
						<CtaLink to="/">
							나루 체험하기
							<ArrowRight className="size-4" />
						</CtaLink>
						<CtaAnchor variant="outline" href={GITHUB_URL} target="_blank" rel="noreferrer">
							<Radio className="size-4" />
							기술 산출물 보기
						</CtaAnchor>
					</div>
				</Card>
			</Section>

			<footer className="border-t border-border px-6 py-8">
				<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
					<span>© 2026 팀 열린창문 · 나루</span>
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 hover:text-foreground"
					>
						GitHub
						<ExternalLink className="size-3.5" />
					</a>
				</div>
			</footer>
		</div>
	);
}
