"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Stethoscope,
  User,
  Calendar,
  Clock,
  Pill,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Printer,
  Edit,
  Search,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  expiryDate: string;
}

interface PrescriptionItem {
  id: string;
  medicineName: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  quantityPrescribed: number;
  quantityDispensed: number;
  dosage: string;
  frequency: string;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  substitutionAllowed: boolean;
  isControlled: boolean;
  scheduleClass: string | null;
}

interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientName: string;
  patientPhone: string | null;
  patientAge: number | null;
  patientGender: string | null;
  patientAddress: string | null;
  diagnosis: string | null;
  status: string;
  priority: string;
  issueDate: string;
  expiryDate: string;
  refillsAllowed: number;
  refillsUsed: number;
  prescriptionNotes: string | null;
  pharmacistNotes: string | null;
  prescriber: {
    id: string;
    name: string;
    registrationNumber: string;
    councilType: string;
    facility: string | null;
    phone: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
  items: PrescriptionItem[];
  dispensings: Array<{
    id: string;
    dispensedBy: string;
    dispensedByName: string;
    dispensingNotes: string | null;
    counselingProvided: boolean;
    createdAt: string;
    items: Array<{
      id: string;
      medicineName: string;
      batchNumber: string;
      quantityDispensed: number;
      unitPrice: number;
      isSubstitution: boolean;
    }>;
  }>;
  createdAt: string;
}

interface DispenseFormItem {
  prescriptionItemId: string;
  medicineName: string;
  quantityRemaining: number;
  quantityToDispense: number;
  medicineId: string;
  batchNumber: string;
  unitPrice: number;
  isSubstitution: boolean;
  matchedMedicines: Medicine[];
  selectedMedicine: Medicine | null;
}

export default function PrescriptionDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDispense = searchParams.get("dispense") === "true";

  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispenseModalOpen, setDispenseModalOpen] = useState(showDispense);
  const [dispenseItems, setDispenseItems] = useState<DispenseFormItem[]>([]);
  const [dispensingNotes, setDispensingNotes] = useState("");
  const [counselingProvided, setCounselingProvided] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [searchingMedicines, setSearchingMedicines] = useState<string | null>(null);

  const fetchPrescription = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prescriptions/${id}`);
      const data = await res.json();
      if (res.ok) {
        setPrescription(data.prescription);
        // Initialize dispense items
        const items: DispenseFormItem[] = data.prescription.items
          .filter((item: PrescriptionItem) => item.quantityDispensed < item.quantityPrescribed)
          .map((item: PrescriptionItem) => ({
            prescriptionItemId: item.id,
            medicineName: item.medicineName,
            quantityRemaining: item.quantityPrescribed - item.quantityDispensed,
            quantityToDispense: item.quantityPrescribed - item.quantityDispensed,
            medicineId: "",
            batchNumber: "",
            unitPrice: 0,
            isSubstitution: false,
            matchedMedicines: [],
            selectedMedicine: null,
          }));
        setDispenseItems(items);
      } else {
        toast.error(data.error || "Failed to fetch prescription");
      }
    } catch {
      toast.error("Failed to fetch prescription");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrescription();
  }, [fetchPrescription]);

  const searchMedicines = async (itemIndex: number, query: string) => {
    if (query.length < 2) {
      const newItems = [...dispenseItems];
      newItems[itemIndex].matchedMedicines = [];
      setDispenseItems(newItems);
      return;
    }

    setSearchingMedicines(itemIndex.toString());
    try {
      const res = await fetch(`/api/medicines?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (res.ok) {
        const newItems = [...dispenseItems];
        newItems[itemIndex].matchedMedicines = data.medicines.filter((m: Medicine) => m.quantity > 0);
        setDispenseItems(newItems);
      }
    } catch {
      console.error("Failed to search medicines");
    } finally {
      setSearchingMedicines(null);
    }
  };

  const selectMedicine = (itemIndex: number, medicine: Medicine) => {
    const newItems = [...dispenseItems];
    newItems[itemIndex].selectedMedicine = medicine;
    newItems[itemIndex].medicineId = medicine.id;
    newItems[itemIndex].batchNumber = medicine.batchNumber;
    newItems[itemIndex].unitPrice = medicine.unitPrice;
    newItems[itemIndex].matchedMedicines = [];
    // Check if it's a substitution (different name)
    newItems[itemIndex].isSubstitution = 
      medicine.name.toLowerCase() !== newItems[itemIndex].medicineName.toLowerCase();
    setDispenseItems(newItems);
  };

  const updateDispenseItem = (index: number, field: keyof DispenseFormItem, value: unknown) => {
    const newItems = [...dispenseItems];
    (newItems[index] as unknown as Record<string, unknown>)[field] = value;
    setDispenseItems(newItems);
  };

  const handleDispense = async () => {
    // Validate
    const itemsToDispense = dispenseItems.filter(item => item.quantityToDispense > 0);
    if (itemsToDispense.length === 0) {
      toast.error("Please select at least one item to dispense");
      return;
    }

    for (const item of itemsToDispense) {
      if (!item.medicineId || !item.batchNumber) {
        toast.error(`Please select medicine from inventory for ${item.medicineName}`);
        return;
      }
      if (item.quantityToDispense > item.quantityRemaining) {
        toast.error(`Cannot dispense more than remaining quantity for ${item.medicineName}`);
        return;
      }
      if (item.selectedMedicine && item.quantityToDispense > item.selectedMedicine.quantity) {
        toast.error(`Insufficient stock for ${item.medicineName}`);
        return;
      }
    }

    setDispensing(true);
    try {
      const res = await fetch(`/api/prescriptions/${id}/dispense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToDispense.map(item => ({
            prescriptionItemId: item.prescriptionItemId,
            medicineId: item.medicineId,
            medicineName: item.selectedMedicine?.name || item.medicineName,
            batchNumber: item.batchNumber,
            quantityDispensed: item.quantityToDispense,
            unitPrice: item.unitPrice,
            isSubstitution: item.isSubstitution,
          })),
          dispensingNotes,
          counselingProvided,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Items dispensed successfully");
        setDispenseModalOpen(false);
        fetchPrescription();
      } else {
        toast.error(data.error || "Failed to dispense");
      }
    } catch {
      toast.error("Failed to dispense");
    } finally {
      setDispensing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case "PARTIAL":
        return <Badge className="bg-blue-100 text-blue-700">Partial</Badge>;
      case "DISPENSED":
        return <Badge className="bg-green-100 text-green-700">Dispensed</Badge>;
      case "EXPIRED":
        return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
      case "CANCELLED":
        return <Badge className="bg-gray-100 text-gray-700">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const isExpired = prescription ? new Date(prescription.expiryDate) < new Date() : false;
  const canDispense = prescription && 
    (prescription.status === "PENDING" || prescription.status === "PARTIAL") && 
    !isExpired;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <Card className="p-12 text-center">
        <XCircle className="w-12 h-12 mx-auto text-red-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Prescription not found</h3>
        <Link href="/prescriptions">
          <Button variant="outline">Back to Prescriptions</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/prescriptions">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">
                {prescription.prescriptionNumber}
              </h1>
              {getStatusBadge(prescription.status)}
              {prescription.priority !== "NORMAL" && (
                <Badge className={prescription.priority === "STAT" ? "bg-red-600 text-white" : "bg-orange-100 text-orange-700"}>
                  {prescription.priority}
                </Badge>
              )}
              {prescription.items.some(i => i.isControlled) && (
                <Badge className="bg-purple-100 text-purple-700">Controlled</Badge>
              )}
            </div>
            <p className="text-gray-500">Created {formatDateTime(prescription.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          {canDispense && (
            <Button
              onClick={() => setDispenseModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Package className="w-4 h-4 mr-2" />
              Dispense
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {isExpired && prescription.status !== "DISPENSED" && prescription.status !== "CANCELLED" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">Prescription Expired</h4>
            <p className="text-sm text-red-700">This prescription expired on {formatDate(prescription.expiryDate)} and cannot be dispensed.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Prescriber */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="w-5 h-5" />
                Prescriber
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{prescription.prescriber.name}</p>
              <p className="text-sm text-gray-500">
                {prescription.prescriber.councilType}: {prescription.prescriber.registrationNumber}
              </p>
              {prescription.prescriber.facility && (
                <p className="text-sm text-gray-500">{prescription.prescriber.facility}</p>
              )}
              {prescription.prescriber.phone && (
                <p className="text-sm text-gray-500">Tel: {prescription.prescriber.phone}</p>
              )}
            </CardContent>
          </Card>

          {/* Patient */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{prescription.patientName}</p>
              {prescription.patientAge && prescription.patientGender && (
                <p className="text-sm text-gray-500">
                  {prescription.patientAge} years, {prescription.patientGender}
                </p>
              )}
              {prescription.patientPhone && (
                <p className="text-sm text-gray-500">Tel: {prescription.patientPhone}</p>
              )}
              {prescription.patientAddress && (
                <p className="text-sm text-gray-500">{prescription.patientAddress}</p>
              )}
              {prescription.diagnosis && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-500">Diagnosis:</p>
                  <p className="font-medium">{prescription.diagnosis}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Validity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Issue Date:</span>
                <span>{formatDate(prescription.issueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expiry Date:</span>
                <span className={isExpired ? "text-red-600 font-medium" : ""}>
                  {formatDate(prescription.expiryDate)}
                </span>
              </div>
              {prescription.refillsAllowed > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Refills:</span>
                  <span>{prescription.refillsUsed} / {prescription.refillsAllowed}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Medicines & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prescribed Medicines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pill className="w-5 h-5" />
                Prescribed Medicines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-lg ${
                      item.isControlled ? "border-purple-300 bg-purple-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.medicineName}</span>
                          {item.strength && <span className="text-gray-500">{item.strength}</span>}
                          {item.isControlled && (
                            <Badge className="bg-purple-100 text-purple-700">
                              {item.scheduleClass || "Controlled"}
                            </Badge>
                          )}
                        </div>
                        {item.genericName && (
                          <p className="text-sm text-gray-500">{item.genericName}</p>
                        )}
                        <p className="text-sm mt-1">
                          {item.dosage} | {item.frequency} | {item.route}
                          {item.duration && ` | ${item.duration}`}
                        </p>
                        {item.instructions && (
                          <p className="text-sm text-gray-500 italic mt-1">{item.instructions}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">
                            {item.quantityDispensed}/{item.quantityPrescribed}
                          </span>
                          {item.quantityDispensed >= item.quantityPrescribed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : item.quantityDispensed > 0 ? (
                            <Clock className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {item.quantityPrescribed - item.quantityDispensed} remaining
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dispensing History */}
          {prescription.dispensings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5" />
                  Dispensing History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {prescription.dispensings.map((disp) => (
                    <div key={disp.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Dispensed by {disp.dispensedByName}</span>
                        <span className="text-sm text-gray-500">{formatDateTime(disp.createdAt)}</span>
                      </div>
                      <div className="space-y-1">
                        {disp.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span>
                              {item.medicineName}
                              {item.isSubstitution && (
                                <Badge className="ml-2 bg-blue-100 text-blue-700">Substitution</Badge>
                              )}
                            </span>
                            <span className="text-gray-500">
                              {item.quantityDispensed} × KES {item.unitPrice.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {disp.dispensingNotes && (
                        <p className="text-sm text-gray-500 mt-2 italic">Note: {disp.dispensingNotes}</p>
                      )}
                      {disp.counselingProvided && (
                        <Badge className="mt-2 bg-green-100 text-green-700">Counseling Provided</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dispense Modal */}
      <Dialog open={dispenseModalOpen} onOpenChange={setDispenseModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispense Prescription Items</DialogTitle>
            <DialogDescription>
              Select medicines from inventory and specify quantities to dispense
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {dispenseItems.map((item, index) => (
              <div key={item.prescriptionItemId} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{item.medicineName}</h4>
                    <p className="text-sm text-gray-500">
                      Remaining: {item.quantityRemaining}
                    </p>
                  </div>
                </div>

                {/* Medicine Search */}
                <div className="space-y-2">
                  <Label>Select from Inventory</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search medicine in stock..."
                      onChange={(e) => searchMedicines(index, e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {searchingMedicines === index.toString() && (
                    <p className="text-sm text-gray-500">Searching...</p>
                  )}
                  {item.matchedMedicines.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto">
                      {item.matchedMedicines.map((med) => (
                        <button
                          key={med.id}
                          onClick={() => selectMedicine(index, med)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="flex justify-between">
                            <div>
                              <span className="font-medium">{med.name}</span>
                              {med.genericName && (
                                <span className="text-sm text-gray-500 ml-2">({med.genericName})</span>
                              )}
                            </div>
                            <span className="text-emerald-600 font-medium">KES {med.unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Batch: {med.batchNumber} | Stock: {med.quantity} | Exp: {formatDate(med.expiryDate)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Medicine */}
                {item.selectedMedicine && (
                  <div className="bg-emerald-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-emerald-800">{item.selectedMedicine.name}</span>
                        {item.isSubstitution && (
                          <Badge className="ml-2 bg-blue-100 text-blue-700">Substitution</Badge>
                        )}
                      </div>
                      <span className="text-emerald-700">KES {item.unitPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-emerald-600">
                      Batch: {item.batchNumber} | Available: {item.selectedMedicine.quantity}
                    </p>
                  </div>
                )}

                {/* Quantity */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity to Dispense</Label>
                    <Input
                      type="number"
                      min="0"
                      max={Math.min(item.quantityRemaining, item.selectedMedicine?.quantity || 0)}
                      value={item.quantityToDispense}
                      onChange={(e) => updateDispenseItem(index, "quantityToDispense", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateDispenseItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {dispenseItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                All items have been fully dispensed
              </div>
            )}

            {/* Notes & Counseling */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Dispensing Notes</Label>
                <Textarea
                  value={dispensingNotes}
                  onChange={(e) => setDispensingNotes(e.target.value)}
                  placeholder="Any notes about this dispensing..."
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="counseling"
                  checked={counselingProvided}
                  onCheckedChange={(c) => setCounselingProvided(!!c)}
                />
                <Label htmlFor="counseling">Patient counseling provided</Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setDispenseModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDispense}
                disabled={dispensing || dispenseItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {dispensing ? "Dispensing..." : "Dispense Items"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
