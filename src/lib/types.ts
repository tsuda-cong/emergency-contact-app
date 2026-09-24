export type Shelter = {
  id: string;
  name: string;
  sort_order: number;
};

export type CohabitantInput = {
  name: string;
  nameKana: string;
  relationship: string;
  phone: string;
  isJw: boolean;
};

export type EmergencyContactInput = {
  name: string;
  nameKana: string;
  relationship: string;
  phones: string[];
  isJw: boolean;
};

export type HouseholdFormValues = {
  name: string;
  nameKana: string;
  address: string;
  phones: string[];
  birthdate: string;
  shelterId: string;
  cohabitants: CohabitantInput[];
  emergencyContacts: EmergencyContactInput[];
  consent: boolean;
};

export type RegistrationPayload = {
  name: string;
  nameKana: string;
  nameKanaRomaji: string;
  address: string;
  phones: string[];
  birthdate: string;
  shelterId: string;
  consent: boolean;
  cohabitants: (CohabitantInput & { sortOrder: number })[];
  emergencyContacts: (EmergencyContactInput & { sortOrder: number })[];
};

export type HouseholdRow = {
  id: string;
  name: string;
  name_kana: string;
  name_kana_romaji: string;
  address: string;
  phones: string[];
  birthdate: string;
  shelter_id: string | null;
  consent_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CohabitantRow = {
  id: string;
  household_id: string;
  name: string;
  name_kana: string;
  relationship: string;
  phone: string | null;
  is_jw: boolean;
  sort_order: number;
};

export type EmergencyContactRow = {
  id: string;
  household_id: string;
  name: string;
  name_kana: string;
  relationship: string;
  phones: string[];
  is_jw: boolean;
  sort_order: number;
};

export type Profile = {
  id: string;
  display_name: string | null;
  role: "editor" | "viewer";
};
