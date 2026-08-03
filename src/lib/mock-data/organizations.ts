export type Organization = {
  id: string;
  name: string;
  category: string;
  summary: string;
  donationPurpose: string;
  location: string;
};

export const organizations: Organization[] = [
  {
    id: 'loop-foundation',
    name: 'Loop 재단',
    category: '지역사회',
    summary: '기부의 약속부터 집행과 보고까지 신뢰의 흐름을 연결합니다.',
    donationPurpose: '지역사회 문제 해결을 위한 공익 프로젝트 지원',
    location: '서울',
  },
  {
    id: 'haebom',
    name: '해봄재단',
    category: '아동·청소년',
    summary: '돌봄 공백 아동의 방과 후 배움과 식사를 지원합니다.',
    donationPurpose: '돌봄 공백 아동 교육 프로그램 운영',
    location: '서울',
  },
  {
    id: 'green-tomorrow',
    name: '푸른내일',
    category: '환경',
    summary: '지역 주민과 함께 하천 생태계를 회복하고 기록합니다.',
    donationPurpose: '하천 생태계 복원과 시민 기록 활동',
    location: '부산',
  },
  {
    id: 'warm-table',
    name: '따뜻한식탁',
    category: '지역사회',
    summary: '취약계층 어르신에게 지역 식재료로 만든 식사를 전합니다.',
    donationPurpose: '취약계층 어르신 식사 지원',
    location: '대구',
  },
];

export function getOrganization(id: string) {
  return organizations.find((organization) => organization.id === id);
}
