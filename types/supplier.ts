import type { Timestamp } from "firebase/firestore";

export enum SupplierType {
  COMPANY = "COMPANY",
  INDIVIDUAL = "INDIVIDUAL",
  PARTNERSHIP = "PARTNERSHIP",
}

export interface Address {
  line1: string;
  line2?: string;
  zip?: string;
  city: string;
  state?: string;
  country: string;
}

export interface SupplierDocument {
  code: string;
  name: string;
  type: SupplierType;
  email?: string;
  phone: string;
  address?: Address;
  taxNumber?: string;
  registrationNumber?: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Supplier extends SupplierDocument {
  id: string;
}

export type CreateSupplierInput = Pick<SupplierDocument, "name" | "type" | "phone"> &
  Partial<
    Pick<
      SupplierDocument,
      "email" | "taxNumber" | "registrationNumber" | "address"
    >
  >;

export type UpdateSupplierInput = Partial<CreateSupplierInput>;
