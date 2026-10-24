export interface FamilyMemberNeed {
  id: string;
  member: string; // "حيدر" | "إيمان" | "رقية" | "قنوت" | "إيڤا" | "العائلة"
  title: string;
  type?: "need" | "duty" | "expense";
  category: string;
  quantity?: number;
  estimatedPrice?: number;
  priority?: "عاجل" | "مهم" | "متوسط" | "عادي" | string;
  notes?: string;
  status: "pending" | "available" | "completed";
  createdAt: string;
  expenseId?: string;
  expenseDate?: string;
}

export interface HealthMedicationItem {
  id?: string;
  name: string;
  dosage?: string;
  duration?: string;
  notes?: string;
}

export interface FamilyHealthRecord {
  id: string;
  member: string; // "حيدر" | "إيمان" | "رقية" | "قنوت" | "إيڤا" | "العائلة"
  title: string;
  type: "sonar" | "medication" | "lab" | "report" | "other";
  typeNameArabic?: string;
  date: string; // YYYY-MM-DD
  doctorOrClinic?: string;
  diagnosisOrReason?: string;
  findings?: string;
  instructions?: string;
  cost?: number;
  medications?: HealthMedicationItem[];
  imageUrl?: string;
  imageThumbnail?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}
