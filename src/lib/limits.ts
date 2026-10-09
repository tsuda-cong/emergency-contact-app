// 入力の上限。DB の制約（supabase/migrations/0015_input_limits.sql）と同じ値にそろえる。
// フォーム側の制限は使いやすさのためで、本当の守りは DB の制約。
export const LIMITS = {
  name: 30,
  nameKana: 60,
  address: 100,
  relationship: 20,
  phone: 20,
  // 同居人・緊急連絡先は、それぞれ1世帯あたりこの人数まで
  members: 10,
} as const;
