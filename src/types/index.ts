export interface ISettings {
  id?: string;
  _id?: string;
  userId: string;
  monthlyBudget: number;
  dailyBudget: number;
  currency: string;
  currentMonth: string;
  theme: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IExpense {
  id?: string;
  _id?: string;
  userId: string;
  date: string;
  limit: number;
  spent: number;
  saved: number;
  note: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
