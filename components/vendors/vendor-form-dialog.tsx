"use client";

import { ReusableDialog } from "@/components/reusable-dialog";
import { VendorForm } from "@/components/vendors/vendor-form";
import type { Supplier } from "@/types/supplier";

type VendorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  onSaved: () => Promise<void> | void;
};

export function VendorFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: VendorFormDialogProps) {
  return (
    <ReusableDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Update vendor"
      description="Update vendor identity and contact details."
    >
      <VendorForm
        mode="update"
        supplier={supplier}
        supplierId={supplier.id}
        onSaved={async () => {
          await onSaved();
          onOpenChange(false);
        }}
      />
    </ReusableDialog>
  );
}
