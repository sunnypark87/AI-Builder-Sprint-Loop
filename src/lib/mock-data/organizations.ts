export type Organization = {
  id: string;
  name: string;
  category: string;
  summary: string;
  location: string;
  verifiedItems: number;
  totalItems: number;
  latestReport: string;
  tags: string[];
  allocation: { label: string; value: number }[];
};

export const organizations: Organization[] = [
  {
    id: 'haebom',
    name: '해봄재단',
    category: '아동·청소년',
    summary: '돌봄 공백 아동의 방과 후 배움과 식사를 지원합니다.',
    location: '서울',
    verifiedItems: 8,
    totalItems: 9,
    latestReport: '2026. 07. 24.',
    tags: ['월간 집행 공개', '외부 회계 검토'],
    allocation: [
      { label: '교육 프로그램', value: 55 },
      { label: '급식 지원', value: 30 },
      { label: '운영', value: 15 },
    ],
  },
  {
    id: 'green-tomorrow',
    name: '푸른내일',
    category: '환경',
    summary: '지역 주민과 함께 하천 생태계를 회복하고 기록합니다.',
    location: '부산',
    verifiedItems: 7,
    totalItems: 9,
    latestReport: '2026. 07. 18.',
    tags: ['증빙 공개', '분기 보고'],
    allocation: [
      { label: '생태 복원', value: 62 },
      { label: '시민 교육', value: 25 },
      { label: '운영', value: 13 },
    ],
  },
  {
    id: 'warm-table',
    name: '따뜻한식탁',
    category: '지역사회',
    summary: '취약계층 어르신에게 지역 식재료로 만든 식사를 전합니다.',
    location: '대구',
    verifiedItems: 9,
    totalItems: 9,
    latestReport: '2026. 07. 27.',
    tags: ['영수증 공개', '월간 보고'],
    allocation: [
      { label: '식재료', value: 70 },
      { label: '배송', value: 20 },
      { label: '운영', value: 10 },
    ],
  },
];

export function getOrganization(id: string) {
  return organizations.find((organization) => organization.id === id);
}
